
import dotenv from "dotenv";
import { connectRedis } from "./config/redis.js";
import {
    initializeStream,
    consumeTrafficEvents
} from "./services/streamConsumer.js";

dotenv.config();

const startServer = async () => {
    await connectRedis();
    await initializeStream();

    // Keep the consumer running and handle unexpected failures.
    await consumeTrafficEvents();
};

startServer().catch((error) => {
    console.error(
        "[EVENT] Startup failed:",
        error?.code || "EVENT_SERVICE_STARTUP_FAILED"
    );

    process.exitCode = 1;
});
