import { detectSqlInjection } from "../detectors/sqlInjection.js";
import { detectXss } from "../detectors/xss.js";
import { detectPathTraversal } from "../detectors/pathTraversal.js";
import { detectCommandInjection } from "../detectors/commandInjection.js";

const safeDecode = (value) => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

export const analyzeRequest = (event) => {
    const input = [
        safeDecode(event.path || ""),
        safeDecode(event.query || ""),
        safeDecode(event.body || ""),
        safeDecode(event.userAgent || "")
    ].join(" ");

    const detectors = [
        detectSqlInjection,
        detectXss,
        detectPathTraversal,
        detectCommandInjection
    ];

    const detections = [];

    for (const detector of detectors) {
        const result = detector(input);

        if (result.detected) {
            detections.push(result);
        }
    }

    return detections;
};