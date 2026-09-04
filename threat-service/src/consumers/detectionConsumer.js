import redis from "../config/redis.js";
import { calculateThreatScore } from "../services/threatScorer.js";
import {
    addDetection,
    removeDetection
} from "../services/detectionAggregator.js";

const DETECTION_STREAM =
    process.env.DETECTION_STREAM || "ids:detections";

const THREAT_STREAM =
    process.env.THREAT_STREAM || "ids:threats";

const GROUP_NAME =
    process.env.REDIS_GROUP || "threat-scoring-group";

const CONSUMER_NAME =
    process.env.REDIS_CONSUMER || "threat-service-1";

const WINDOW_MS = 2000;

const timers = new Map();

const pendingMessages = new Map();

const createConsumerGroup = async () => {
    try {
        await redis.xgroup(
            "CREATE",
            DETECTION_STREAM,
            GROUP_NAME,
            "0",
            "MKSTREAM"
        );

        console.log(
            `[THREAT] Consumer group "${GROUP_NAME}" created`
        );
    } catch (error) {
        if (error.message.includes("BUSYGROUP")) {
            console.log(
                `[THREAT] Consumer group "${GROUP_NAME}" already exists`
            );
        } else {
            throw error;
        }
    }
};

const publishThreat = async (threat) => {
    await redis.xadd(
        THREAT_STREAM,
        "*",
        "threat",
        JSON.stringify(threat)
    );

    console.log(
        `[THREAT BUS] Published ${threat.requestId}`
    );
};

const finalizeDetection = async (requestId) => {
    try {
        const aggregated = pendingMessages.get(requestId);

        if (!aggregated) {
            return;
        }

        const result = calculateThreatScore(
            aggregated.detections
        );

        const threat = {
            requestId: aggregated.requestId,

            timestamp: new Date().toISOString(),

            sourceIp: aggregated.sourceIp,

            method: aggregated.method,

            path: aggregated.path,

            detected:
                aggregated.detections.length > 0,

            detections:
                aggregated.detections,

            score:
                result.score,

            severity:
                result.severity
        };

        console.log(
            "\n[THREAT] Aggregated Analysis:"
        );

        console.log(threat);

        if (threat.detected) {
            await publishThreat(threat);
        } else {
            console.log(
                `[THREAT] No threat detected for ${requestId}`
            );
        }

        const messages =
            pendingMessages.get(requestId)?.messages || [];

        for (const messageId of messages) {
            await redis.xack(
                DETECTION_STREAM,
                GROUP_NAME,
                messageId
            );
        }

        pendingMessages.delete(requestId);
        timers.delete(requestId);
        removeDetection(requestId);

    } catch (error) {
        console.error(
            `[THREAT] Failed to finalize ${requestId}:`,
            error.message
        );
    }
};

export const startDetectionConsumer = async () => {
    await createConsumerGroup();

    console.log(
        `[THREAT] Listening to ${DETECTION_STREAM}`
    );

    while (true) {
        try {
            const result = await redis.xreadgroup(
                "GROUP",
                GROUP_NAME,
                CONSUMER_NAME,
                "COUNT",
                10,
                "BLOCK",
                5000,
                "STREAMS",
                DETECTION_STREAM,
                ">"
            );

            if (!result) {
                continue;
            }

            for (const [, messages] of result) {
                for (const [messageId, fields] of messages) {

                    const detectionIndex =
                        fields.indexOf("detection");

                    if (detectionIndex === -1) {
                        await redis.xack(
                            DETECTION_STREAM,
                            GROUP_NAME,
                            messageId
                        );

                        continue;
                    }

                    let detectionEvent;

                    try {
                        detectionEvent = JSON.parse(
                            fields[detectionIndex + 1]
                        );
                    } catch (error) {
                        console.error(
                            `[THREAT] Invalid detection JSON for ${messageId}:`,
                            error.message
                        );

                        await redis.xack(
                            DETECTION_STREAM,
                            GROUP_NAME,
                            messageId
                        );

                        continue;
                    }

                    /*
                     * Ignore events that contain
                     * no actual detections.
                     */
                    if (
                        !detectionEvent.detections ||
                        detectionEvent.detections.length === 0
                    ) {
                        await redis.xack(
                            DETECTION_STREAM,
                            GROUP_NAME,
                            messageId
                        );

                        continue;
                    }

                    const requestId =
                        detectionEvent.requestId;

                    const aggregated =
                        addDetection(detectionEvent);

                    if (!pendingMessages.has(requestId)) {
                        pendingMessages.set(requestId, {
                            ...aggregated,
                            messages: []
                        });
                    }

                    const pending =
                        pendingMessages.get(requestId);

                    pending.messages.push(messageId);

                    /*
                     * Reset the timer whenever another
                     * detection for the same request arrives.
                     */
                    if (timers.has(requestId)) {
                        clearTimeout(
                            timers.get(requestId)
                        );
                    }

                    const timer = setTimeout(
                        () => {
                            finalizeDetection(requestId);
                        },
                        WINDOW_MS
                    );

                    timers.set(requestId, timer);
                }
            }

        } catch (error) {
            console.error(
                "[THREAT] Consumer error:",
                error.message
            );
        }
    }
};