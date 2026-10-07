import "dotenv/config";
import { startTelemetryConsumer } from "./consumer/telemetryConsumer.js";

import { startIncidentConsumer } from "./consumer/incidentConsumer.js";
import { startEvidenceConsumer } from "./consumer/evidenceConsumer.js";

console.log(
    "[EVIDENCE] Evidence Preservation Service started"
);

await Promise.all([
    startIncidentConsumer(),
    startEvidenceConsumer(),
        startTelemetryConsumer()

]);