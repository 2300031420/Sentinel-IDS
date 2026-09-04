import { createDetectionResult } from "../engine/detectionResult.js";

const PATH_TRAVERSAL_PATTERNS = [
    /\.\.\//i,
    /\.\.\\/i,
    /%2e%2e%2f/i,
    /%2e%2e%5c/i,
    /%252e%252e%252f/i
];

export const detectPathTraversal = (input) => {
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
        const match = input.match(pattern);

        if (match) {
            return createDetectionResult({
                detected: true,
                type: "PATH_TRAVERSAL",
                severity: "HIGH",
                score: 40,
                description: "Possible path traversal attempt detected",
                evidence: match[0]
            });
        }
    }

    return createDetectionResult({});
};