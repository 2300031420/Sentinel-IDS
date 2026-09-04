import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379)
});

redis.on("connect", () => {
    console.log("[REDIS] Connected successfully");
});

redis.on("error", (error) => {
    console.error("[REDIS] Connection error:", error.message);
});

export default redis;