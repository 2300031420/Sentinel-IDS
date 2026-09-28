import redis from "../config/redis.js";

import {
    addWebObservation
} from "../correlation/correlationContext.js";

const THREAT_STREAM =
    process.env.THREAT_STREAM || "ids:threats";

const REDIS_GROUP =
    process.env.REDIS_GROUP || "cross-layer-threat-group";

const REDIS_CONSUMER =
    process.env.REDIS_CONSUMER || "cross-layer-threat-1";

const ensureConsumerGroup = async () => {
    try {
        await redis.xgroup(
            "CREATE",
            THREAT_STREAM,
            REDIS_GROUP,
            "0",
            "MKSTREAM"
        );

        console.log(
            `[CROSS-LAYER] Threat consumer group created: ${REDIS_GROUP}`
        );
    } catch (error) {
        if (!error.message.includes("BUSYGROUP")) {
            throw error;
        }

        console.log(
            `[CROSS-LAYER] Threat consumer group already exists: ${REDIS_GROUP}`
        );
    }
};

export const startThreatConsumer = async () => {
    await ensureConsumerGroup();

    console.log(
        `[CROSS-LAYER] Listening to ${THREAT_STREAM}`
    );

    while (true) {
        try {
            const result = await redis.xreadgroup(
                "GROUP",
                REDIS_GROUP,
                REDIS_CONSUMER,
                "BLOCK",
                5000,
                "COUNT",
                10,
                "STREAMS",
                THREAT_STREAM,
                ">"
            );

            if (!result) {
                continue;
            }

            for (const [, messages] of result) {
                for (const [messageId, fields] of messages) {
                    const threatIndex = fields.indexOf("threat");

                    if (threatIndex === -1) {
                        await redis.xack(
                            THREAT_STREAM,
                            REDIS_GROUP,
                            messageId
                        );

                        continue;
                    }

                    const threat = JSON.parse(
                        fields[threatIndex + 1]
                    );

                    console.log(
                        "[CROSS-LAYER] Threat received:",
                        threat
                    );

                    if (!threat.activityId) {
                        console.log(
                            "[CROSS-LAYER] Threat has no activityId"
                        );

                        await redis.xack(
                            THREAT_STREAM,
                            REDIS_GROUP,
                            messageId
                        );

                        continue;
                    }

                    addWebObservation(
                        threat.activityId,
                        {
                            type: "WEB_THREAT",
                            requestId: threat.requestId,
                            sourceIp: threat.sourceIp,
                            path: threat.path,
                            method: threat.method,
                            detections: threat.detections,
                            score: threat.score,
                            severity: threat.severity,
                            timestamp: threat.timestamp
                        }
                    );

                    console.log(
                        `[CROSS-LAYER] Web activity registered: ${threat.activityId}`
                    );

                    await redis.xack(
                        THREAT_STREAM,
                        REDIS_GROUP,
                        messageId
                    );
                }
            }
        } catch (error) {
            console.error(
                "[CROSS-LAYER] Threat consumer error:",
                error
            );
        }
    }
};