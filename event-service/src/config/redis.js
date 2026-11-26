
import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const host = process.env.REDIS_HOST || "127.0.0.1";
const port = Number(process.env.REDIS_PORT || 6379);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("[REDIS] Invalid REDIS_PORT configuration");
}

const redisClient = createClient({
    socket: {
        host,
        port,
        connectTimeout: 5000,
        reconnectStrategy(retries) {
            return Math.min(retries * 250, 2000);
        }
    },
    password: process.env.REDIS_PASSWORD || undefined
});

redisClient.on("error", (error) => {
    console.error(
        "[REDIS] Client error:",
        error.code || "REDIS_CONNECTION_ERROR"
    );
});

export const connectRedis = async () => {
    if (redisClient.isOpen) {
        return;
    }

    try {
        await redisClient.connect();
        console.log("[REDIS] Connected successfully");
    } catch (error) {
        console.error(
            "[REDIS] Initial connection failed:",
            error.code || "REDIS_CONNECTION_FAILED"
        );
        throw error;
    }
};

export default redisClient;
