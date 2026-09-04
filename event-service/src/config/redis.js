import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisClient = createClient({
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT)
    }
});

redisClient.on("error", (error) => {
    console.error("Redis Client Error:", error);
});

export const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log("Redis connected successfully");
    } catch (error) {
        console.error("Redis connection failed:", error.message);
        process.exit(1);
    }
};

export default redisClient;