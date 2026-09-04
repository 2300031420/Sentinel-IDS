import dotenv from "dotenv";

import { startTrafficConsumer } from "./consumers/trafficConsumer.js";

dotenv.config();

const startService = async () => {
    console.log(
        "Starting SentinelIDS Signature Detection Service..."
    );

    await startTrafficConsumer();
};

startService();