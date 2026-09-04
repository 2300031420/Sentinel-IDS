import redis from "../config/redis.js";

import {
    analyzeBehavior
} from "../engine/behaviorEngine.js";

const TRAFFIC_STREAM =
    process.env.TRAFFIC_STREAM || "ids:traffic";

const DETECTION_STREAM =
    process.env.DETECTION_STREAM || "ids:detections";

const GROUP_NAME =
    process.env.REDIS_GROUP ||
    "behavior-detection-group";

const CONSUMER_NAME =
    process.env.REDIS_CONSUMER ||
    "behavior-service-1";

const createConsumerGroup = async () => {
    try {
        await redis.xgroup(
            "CREATE",
            TRAFFIC_STREAM,
            GROUP_NAME,
            "0",
            "MKSTREAM"
        );

        console.log(
            `[BEHAVIOR] Consumer group "${GROUP_NAME}" created`
        );
    } catch (error) {
        if (error.message.includes("BUSYGROUP")) {
            console.log(
                `[BEHAVIOR] Consumer group "${GROUP_NAME}" already exists`
            );
        } else {
            throw error;
        }
    }
};

const publishDetection = async (
    event,
    detections
) => {
    const detectionEvent = {
        requestId: event.requestId,

        timestamp: new Date().toISOString(),

        sourceIp: event.sourceIp,

        method: event.method,

        path: event.path,

        detected: detections.length > 0,

        detections
    };

    await redis.xadd(
        DETECTION_STREAM,
        "*",
        "detection",
        JSON.stringify(detectionEvent)
    );

    console.log(
        `[BEHAVIOR BUS] Published ${event.requestId}`
    );
};

export const startTrafficConsumer = async () => {
    await createConsumerGroup();

    console.log(
        `[BEHAVIOR] Listening to ${TRAFFIC_STREAM}`
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
                TRAFFIC_STREAM,
                ">"
            );

            if (!result) {
                continue;
            }

            for (const [, messages] of result) {
                for (const [messageId, fields] of messages) {

                    const eventIndex =
                        fields.indexOf("event");

                    if (eventIndex === -1) {
                        continue;
                    }

                    const event = JSON.parse(
                        fields[eventIndex + 1]
                    );

                    const detections =
                        await analyzeBehavior(event);

                    if (detections.length === 0) {
                        console.log(
                            `[BEHAVIOR] No behavioral anomaly: ${event.requestId}`
                        );
                    } else {
                        console.log(
                            "[BEHAVIOR] THREAT DETECTED:",
                            detections
                        );
                    }

                    await publishDetection(
                        event,
                        detections
                    );

                    await redis.xack(
                        TRAFFIC_STREAM,
                        GROUP_NAME,
                        messageId
                    );
                }
            }
        } catch (error) {
            console.error(
                "[BEHAVIOR] Consumer error:",
                error.message
            );
        }
    }
};