import "dotenv/config";

import { startIncidentConsumer } from "./consumer/incidentConsumer.js";
import { startEvidenceConsumer } from "./consumer/evidenceConsumer.js";

console.log(
    "[EVIDENCE] Evidence Preservation Service started"
);

await Promise.all([
    startIncidentConsumer(),
    startEvidenceConsumer()
]);