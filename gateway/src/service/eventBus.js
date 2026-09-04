import redis from "../config/redis.js";

const STREAM_NAME = process.env.REDIS_STREAM || "ids:traffic";

export const publishTrafficEvent = async (event) => {
    await redis.xadd(
        STREAM_NAME,
        "*",
        "event",
        JSON.stringify(event)
    );

    console.log(
        `[EVENT BUS] Published event ${event.requestId}`
    );
};