
import redisClient from "../config/redis.js";

const STREAM = process.env.REDIS_STREAM;
const GROUP = process.env.REDIS_GROUP;
const CONSUMER = process.env.REDIS_CONSUMER;

const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));
let stopping = false;

const shouldStop = () => stopping;

process.once("SIGINT", () => {
    stopping = true;
});

process.once("SIGTERM", () => {
    stopping = true;
});
const validateConfig = () => {
    if (![STREAM, GROUP, CONSUMER].every(
        (value) => typeof value === "string" && value.trim()
    )) {
        throw new Error(
            "[EVENT] REDIS_STREAM, REDIS_GROUP and REDIS_CONSUMER are required"
        );
    }
};

const isValidEvent = (event) =>
    event !== null &&
    typeof event === "object" &&
    !Array.isArray(event) &&
    typeof event.requestId === "string" &&
    event.requestId.length > 0 &&
    event.requestId.length <= 200 &&
    typeof event.method === "string" &&
    event.method.length <= 20 &&
    typeof event.path === "string" &&
    event.path.length <= 4096;

export const initializeStream = async () => {
    validateConfig();

    try {
        await redisClient.xGroupCreate(
            STREAM,
            GROUP,
            "0",
            { MKSTREAM: true }
        );

        console.log("[EVENT] Consumer group created");
    } catch (error) {
        if (error.message?.includes("BUSYGROUP")) {
            console.log("[EVENT] Consumer group already exists");
            return;
        }

        throw error;
    }
};

export const consumeTrafficEvents = async () => {
    let retryDelay = 500;

    console.log("[EVENT] Traffic consumer started");

    while (!shouldStop()) {
        try {
            if (!redisClient.isReady) {
                await sleep(retryDelay);
                retryDelay = Math.min(retryDelay * 2, 10000);
                continue;
            }
            const response = await redisClient.xReadGroup(
                GROUP,
                CONSUMER,
                [{ key: STREAM, id: ">" }],
                { COUNT: 10, BLOCK: 5000 }
            );

            retryDelay = 500;

            if (!response) {
                continue;
            }

            for (const stream of response) {
                for (const message of stream.messages) {
                    const rawEvent = message.message.event;
                    let event;

                    try {
                        event = JSON.parse(rawEvent);
                    } catch {
                        console.warn(
                            `[EVENT] Invalid JSON; discarding message ${message.id}`
                        );

                        // This consumer is observational, not a forwarding stage.
                        await redisClient.xAck(
                            STREAM, GROUP, message.id
                        );
                        continue;
                    }

                    if (!isValidEvent(event)) {
                        console.warn(
                            `[EVENT] Invalid event schema; discarding message ${message.id}`
                        );

                        await redisClient.xAck(
                            STREAM, GROUP, message.id
                        );
                        continue;
                    }

                    // Log identifiers only; never dump the complete event.
                    console.log(
                        `[EVENT] Received message ${message.id} | Request: ${event.requestId}`
                    );

                    if (typeof event.correlationId === "string") {
                        console.log(
                            `[CORRELATION] Correlation ID: ${event.correlationId.slice(0, 200)}`
                        );
                    }

                    // Acknowledge only after this consumer's checks and logging.
                    await redisClient.xAck(
                        STREAM, GROUP, message.id
                    );
                }
            }
        } catch (error) {
            console.error(
                "[EVENT] Stream processing failed:",
                error.code || "STREAM_PROCESSING_ERROR"
            );

            await sleep(retryDelay);
            retryDelay = Math.min(retryDelay * 2, 10000);
        }
    }

    console.warn("[EVENT] Redis client is not ready; consumer stopped");
};
