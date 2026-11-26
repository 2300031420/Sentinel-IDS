import "dotenv/config";

import "./config/redis.js";
import { startIncidentConsumer } from "./consumer/incidentConsumer.js";

console.log(
    "[RESPONSE] Response Service started"
);

await startIncidentConsumer();