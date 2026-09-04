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

    consumeTrafficEvents();

    console.log("Event Service started successfully");
};

startServer();