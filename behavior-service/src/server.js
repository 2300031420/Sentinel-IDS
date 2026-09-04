import dotenv from "dotenv";

import {
    startTrafficConsumer
} from "./consumers/trafficConsumers.js";

dotenv.config();

const startService = async () => {
    try {
        console.log(
            "Starting SentinelIDS Behavioral Detection Service..."
        );

        await startTrafficConsumer();

    } catch (error) {
        console.error(
            "[BEHAVIOR] Failed to start:",
            error.message
        );

        process.exit(1);
    }
};

startService();