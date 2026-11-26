
import dotenv from "dotenv";
dotenv.config();

import Redis from "ioredis";

const password = process.env.REDIS_PASSWORD;

if (!password) {
    throw new Error(
        "[EVIDENCE] REDIS_PASSWORD is missing"
    );
}

const redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    username: "default",
    password,
    maxRetriesPerRequest: null
});

redis.on("connect", () => {
    console.log("[EVIDENCE] Redis TCP connection established");
});

redis.on("ready", () => {
    console.log("[EVIDENCE] Redis authenticated and ready");
});

redis.on("error", (error) => {
    console.error(
        "[EVIDENCE] Redis error:",
        error.message
    );
});

export default redis;
