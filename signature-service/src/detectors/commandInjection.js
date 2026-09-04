import { createDetectionResult } from "../engine/detectionResult.js";

const COMMAND_PATTERNS = [
    /;\s*(cat|ls|pwd|whoami|id)\b/i,
    /\|\s*(cat|ls|pwd|whoami|id)\b/i,
    /&&\s*(cat|ls|pwd|whoami|id)\b/i,
    /\$\([^)]*\)/i,
    /`[^`]+`/i
];

export const detectCommandInjection = (input) => {
    for (const pattern of COMMAND_PATTERNS) {
        const match = input.match(pattern);

        if (match) {
            return createDetectionResult({
                detected: true,
                type: "COMMAND_INJECTION",
                severity: "CRITICAL",
                score: 50,
                description: "Possible command injection attempt detected",
                evidence: match[0]
            });
        }
    }

    return createDetectionResult({});
};