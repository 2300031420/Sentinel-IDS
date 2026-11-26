import { handleFeedback } from "./feedbackHandler.js";
import { getWeight } from "../scoring/weightStore.js";

const result = await handleFeedback({
    detectionType: "SQL_INJECTION",
    responseStatus: "BLOCKED"
});

console.log("[ADAPTIVE] Persistence check result:", result);
console.log(
    "[ADAPTIVE] Current SQL_INJECTION weight:",
    getWeight("SQL_INJECTION")
);

process.exit(0);