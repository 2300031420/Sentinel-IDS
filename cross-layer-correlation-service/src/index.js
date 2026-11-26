import "dotenv/config";

import { startThreatConsumer } from "./consumer/threatConsumer.js";
import { startTelemetryConsumer } from "./consumer/telemetryConsumer.js";

console.log(
    "[CROSS-LAYER] Cross-Layer Correlation Service started"
);

await Promise.all([
    startThreatConsumer(),
    startTelemetryConsumer()
]);