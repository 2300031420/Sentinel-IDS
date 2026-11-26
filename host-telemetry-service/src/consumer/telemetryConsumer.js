import redis from "../config/redis.js";

const TELEMETRY_STREAM =
    process.env.TELEMETRY_STREAM || "ids:telemetry";

const REDIS_GROUP =
    process.env.REDIS_GROUP || "host-telemetry-group";

const REDIS_CONSUMER =
    process.env.REDIS_CONSUMER || "host-telemetry-1";

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
            `[HOST TELEMETRY] Consumer group created: ${REDIS_GROUP}`
        );
    } catch (error) {
        if (!error.message.includes("BUSYGROUP")) {
            throw error;
        }

        console.log(
            `[HOST TELEMETRY] Consumer group already exists: ${REDIS_GROUP}`
        );
    }
};

export const startTelemetryConsumer = async () => {
    await ensureConsumerGroup();

    console.log(
        `[HOST TELEMETRY] Listening to ${TELEMETRY_STREAM}`
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

            if (!result) {
                continue;
            }

            for (const [, messages] of result) {
                for (const [messageId, fields] of messages) {
                    const dataIndex = fields.indexOf("data");

                    if (dataIndex === -1) {
                        continue;
                    }

                    const telemetry = JSON.parse(
                        fields[dataIndex + 1]
                    );

                    console.log(
                        "[HOST TELEMETRY] Received:",
                        telemetry
                    );

                    await redis.xack(
                        TELEMETRY_STREAM,
                        REDIS_GROUP,
                        messageId
                    );
                }
            }
        } catch (error) {
            console.error(
                "[HOST TELEMETRY] Consumer error:",
                error
            );
        }
    }
};