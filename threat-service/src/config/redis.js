
import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const host = process.env.REDIS_HOST || "127.0.0.1";
const port = Number(process.env.REDIS_PORT || 6379);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("[THREAT] Invalid REDIS_PORT configuration");
}

const redis = new Redis({
    host,
    port,
    password: process.env.REDIS_PASSWORD || undefined,

    connectTimeout: 5000,
    maxRetriesPerRequest: 1,

    retryStrategy(times) {
        return Math.min(times * 250, 2000);
    }
});

redis.on("connect", () => {
    console.log("[THREAT] Redis connection established");
});

redis.on("ready", () => {
    console.log("[THREAT] Redis client ready");
});

redis.on("error", (error) => {
    console.error(
        "[THREAT] Redis error:",
        error.code || "REDIS_CONNECTION_ERROR"
    );
});

export default redis;
