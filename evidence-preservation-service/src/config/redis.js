import Redis from "ioredis";

const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379
});

redis.on("connect", () => {
    console.log("[EVIDENCE] Redis connected");
});

redis.on("error", (error) => {
    console.error("[EVIDENCE] Redis error:", error);
});

export default redis;