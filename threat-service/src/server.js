import dotenv from "dotenv";

import {
    startDetectionConsumer
} from "./consumers/detectionConsumer.js";

dotenv.config();

const startService = async () => {
    try {
        console.log(
            "Starting SentinelIDS Threat Scoring Service..."
        );

        await startDetectionConsumer();
    } catch (error) {
        console.error(
            "[THREAT] Failed to start:",
            error.message
        );

        process.exit(1);
    }
};

startService();