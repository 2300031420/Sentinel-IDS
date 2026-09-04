import { createDetectionResult } from "../engine/detectionResult.js";

const SQL_PATTERNS = [
    /\bOR\b\s+\d+\s*=\s*\d+/i,
    /\bAND\b\s+\d+\s*=\s*\d+/i,
    /\bUNION\b\s+(ALL\s+)?SELECT\b/i,
    /\bSELECT\b.+\bFROM\b/i,
    /\bINSERT\b.+\bINTO\b/i,
    /\bUPDATE\b.+\bSET\b/i,
    /\bDELETE\b.+\bFROM\b/i,
    /\bDROP\b.+\bTABLE\b/i,
    /(%27)|(\')|(--)|(%23)|(#)/i
];

export const detectSqlInjection = (input) => {
    for (const pattern of SQL_PATTERNS) {
        const match = input.match(pattern);

        if (match) {
            return createDetectionResult({
                detected: true,
                type: "SQL_INJECTION",
                severity: "HIGH",
                score: 40,
                description: "Possible SQL injection attempt detected",
                evidence: match[0]
            });
        }
    }

    return createDetectionResult({});
};