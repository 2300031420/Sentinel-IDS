import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379)
});

redis.on("connect", () => {
    console.log("[INCIDENT] Redis connected successfully");
});

redis.on("error", (error) => {
    console.error(
        "[INCIDENT] Redis error:",
        error.message
    );
});

export default redis;