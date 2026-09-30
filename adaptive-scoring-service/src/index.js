import "dotenv/config";

import { startThreatConsumer } from "./consumer/threatConsumer.js";
import { startFeedbackConsumer } from "./consumer/feedbackConsumer.js";
import { initializeWeights } from "./scoring/weightStore.js";

console.log("[ADAPTIVE] Adaptive Scoring Service started");

await initializeWeights();

await Promise.all([
    startThreatConsumer(),
    startFeedbackConsumer()
]);