import dotenv from "dotenv";

import { connectDatabase } from "./config/database.js";

import {
    startThreatConsumer
} from "./consumers/threatConsumers.js";

dotenv.config();

const startService = async () => {
    try {
        console.log(
            "Starting SentinelIDS Incident Service..."
        );

        await connectDatabase();

        await startThreatConsumer();

    } catch (error) {
        console.error(
            "[INCIDENT] Failed to start:",
            error.message
        );

        process.exit(1);
    }
};

startService();