import redis from "../config/redis.js";

import { matchHostTelemetry } from "../correlation/correlationMatcher.js";
import { calculateCrossLayerCorrelation } from "../correlation/correlationScore.js";
import { publishCrossLayerCorrelation } from "../publisher/crossLayerPublisher.js";
import {
    removeExpiredContexts
} from "../correlation/correlationContext.js";

const TELEMETRY_STREAM =
    process.env.TELEMETRY_STREAM || "ids:telemetry";

const REDIS_GROUP =
    process.env.REDIS_GROUP || "cross-layer-group";

const REDIS_CONSUMER =
    process.env.REDIS_CONSUMER || "cross-layer-service-1";

const ensureConsumerGroup = async () => {
    try {
        await redis.xgroup(
            "CREATE",
            TELEMETRY_STREAM,
            REDIS_GROUP,
            "0",
            "MKSTREAM"
        );

        console.log(
            `[CROSS-LAYER] Consumer group created: ${REDIS_GROUP}`
        );
    } catch (error) {
        if (!error.message.includes("BUSYGROUP")) {
            throw error;
        }

        console.log(
            `[CROSS-LAYER] Consumer group already exists: ${REDIS_GROUP}`
        );
    }
};

export const startTelemetryConsumer = async () => {
    await ensureConsumerGroup();

    console.log(
        `[CROSS-LAYER] Listening to ${TELEMETRY_STREAM}`
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
                TELEMETRY_STREAM,
                ">"
            );

            removeExpiredContexts();

            if (!result) {
                continue;
            }

            for (const [, messages] of result) {
                for (const [messageId, fields] of messages) {
                    const dataIndex = fields.indexOf("data");

                    if (dataIndex === -1) {
                        await redis.xack(
                            TELEMETRY_STREAM,
                            REDIS_GROUP,
                            messageId
                        );

                        continue;
                    }

                    const telemetry = JSON.parse(
                        fields[dataIndex + 1]
                    );

                    console.log(
                        "[CROSS-LAYER] Telemetry received:",
                        telemetry
                    );

                    const matchedActivities =
                        matchHostTelemetry(telemetry);

                    if (matchedActivities.length === 0) {
                        console.log(
                            "[CROSS-LAYER] No matching web activity"
                        );
                    }

                    for (const activityId of matchedActivities) {
                        const context =
                            (await import(
                                "../correlation/correlationContext.js"
                            )).getContext(activityId);

                        if (!context) {
                            continue;
                        }

                        const result =
                            calculateCrossLayerCorrelation(
                                context
                            );

                        context.correlationScore =
                            result.score;

                        context.confidence =
                            result.confidence;

                        await publishCrossLayerCorrelation(
                            context
                        );
                    }

                    await redis.xack(
                        TELEMETRY_STREAM,
                        REDIS_GROUP,
                        messageId
                    );
                }
            }
        } catch (error) {
            console.error(
                "[CROSS-LAYER] Consumer error:",
                error
            );
        }
    }
};