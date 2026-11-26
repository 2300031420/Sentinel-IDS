
import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.REDIS_PORT || 6379);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("[REDIS] Invalid REDIS_PORT configuration");
}

const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port,
    password: process.env.REDIS_PASSWORD || undefined,

    // Bound how long a command waits for Redis.
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,

    // Fail commands immediately when Redis is not ready.
    // The Gateway's blocklist middleware then returns HTTP 503.
    enableOfflineQueue: false,

    // Continue reconnecting with a capped delay.
    retryStrategy(times) {
        return Math.min(times * 250, 2000);
    }
});

redis.on("connect", () => {
    console.log("[REDIS] Connected");
});

redis.on("ready", () => {
    console.log("[REDIS] Ready to accept commands");
});

redis.on("reconnecting", () => {
    console.warn("[REDIS] Reconnecting");
});

redis.on("error", (error) => {
    console.error(
        "[REDIS] Connection error:",
        error.code || "REDIS_CONNECTION_ERROR"
    );
});

export default redis;
