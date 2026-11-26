
import dotenv from "dotenv";

import {
    startDetectionConsumer,
    stopDetectionConsumer
} from "./consumers/detectionConsumer.js";

import { stopCorrelationCleanup } from "./correlation/correlationEngine.js";

dotenv.config();

let shuttingDown = false;

const shutdown = async (signal) => {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    console.log(`[THREAT] ${signal} received; shutting down`);

    try {
        await stopDetectionConsumer();
        stopCorrelationCleanup();

        if (redisIsConnected()) {
            await closeRedis();
        }

        console.log("[THREAT] Shutdown completed");
        process.exitCode = 0;
    } catch (error) {
        console.error(
            "[THREAT] Shutdown failed:",
            error.code || "SHUTDOWN_ERROR"
        );

        process.exitCode = 1;
    }
};

const redisIsConnected = () => redis.status !== "end";

const closeRedis = async () => {
    await redis.quit();
};

import redis from "./config/redis.js";

process.once("SIGINT", () => {
    void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
});

const startService = async () => {
    try {
        console.log("Starting SentinelIDS Threat Scoring Service...");
        await startDetectionConsumer();
    } catch (error) {
        console.error(
            "[THREAT] Failed to start:",
            error.code || "THREAT_STARTUP_FAILED"
        );

        process.exitCode = 1;
    }
};

void startService();
