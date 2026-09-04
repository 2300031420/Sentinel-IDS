import { createDetectionResult } from "../engine/detectionResult.js";

const XSS_PATTERNS = [
    /<script\b[^>]*>/i,
    /javascript\s*:/i,
    /onerror\s*=/i,
    /onload\s*=/i,
    /onclick\s*=/i,
    /<iframe\b/i,
    /<img\b[^>]*onerror/i
];

export const detectXss = (input) => {
    for (const pattern of XSS_PATTERNS) {
        const match = input.match(pattern);

        if (match) {
            return createDetectionResult({
                detected: true,
                type: "XSS",
                severity: "HIGH",
                score: 35,
                description: "Possible cross-site scripting attempt detected",
                evidence: match[0]
            });
        }
    }

    return createDetectionResult({});
};