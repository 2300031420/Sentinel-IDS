import "dotenv/config";

import { startThreatConsumer } from "./consumer/threatConsumer.js";
import { startFeedbackConsumer } from "./consumer/feedbackConsumer.js";
import { initializeWeights } from "./scoring/weightStore.js";
import { startWeightDecay } from "./scoring/weightDecay.js";

console.log("[ADAPTIVE] Adaptive Scoring Service started");

await initializeWeights();

startWeightDecay();

await Promise.all([
    startThreatConsumer(),
    startFeedbackConsumer()
]);