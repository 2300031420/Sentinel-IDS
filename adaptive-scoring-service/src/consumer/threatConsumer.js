import redis from "../config/redis.js";

const THREAT_STREAM =
    process.env.THREAT_STREAM || "ids:threats";

const REDIS_GROUP =
    process.env.REDIS_GROUP || "adaptive-scoring-group";

const REDIS_CONSUMER =
    process.env.REDIS_CONSUMER || "adaptive-scoring-1";

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
            `[ADAPTIVE] Consumer group created: ${REDIS_GROUP}`
        );
    } catch (error) {
        if (!error.message.includes("BUSYGROUP")) {
            throw error;
        }

        console.log(
            `[ADAPTIVE] Consumer group already exists: ${REDIS_GROUP}`
        );
    }
};

export const startThreatConsumer = async () => {
    await ensureConsumerGroup();

    console.log(
        `[ADAPTIVE] Listening to ${THREAT_STREAM}`
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
                    const threatIndex =
                        fields.indexOf("threat");

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
                        "[ADAPTIVE] Threat received:",
                        threat
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
                "[ADAPTIVE] Consumer error:",
                error
            );
        }
    }
};