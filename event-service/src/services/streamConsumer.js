import redisClient from "../config/redis.js";

const STREAM = process.env.REDIS_STREAM;
const GROUP = process.env.REDIS_GROUP;
const CONSUMER = process.env.REDIS_CONSUMER;

export const initializeStream = async () => {
    try {
        await redisClient.xGroupCreate(
            STREAM,
            GROUP,
            "0",
            {
                MKSTREAM: true
            }
        );

        console.log(
            `Redis consumer group created: ${GROUP}`
        );
    } catch (error) {
        if (error.message.includes("BUSYGROUP")) {
            console.log(
                `Redis consumer group already exists: ${GROUP}`
            );
        } else {
            throw error;
        }
    }
};

export const consumeTrafficEvents = async () => {
    console.log(
        `Listening to Redis stream: ${STREAM}`
    );

    while (true) {
        try {
            const response = await redisClient.xReadGroup(
                GROUP,
                CONSUMER,
                [
                    {
                        key: STREAM,
                        id: ">"
                    }
                ],
                {
                    COUNT: 10,
                    BLOCK: 5000
                }
            );

            if (!response) {
                continue;
            }

            for (const stream of response) {
                for (const message of stream.messages) {
                    console.log(
                        "Traffic event received:",
                        message
                    );

                    await redisClient.xAck(
                        STREAM,
                        GROUP,
                        message.id
                    );
                }
            }
        } catch (error) {
            console.error(
                "Redis stream error:",
                error.message
            );
        }
    }
};