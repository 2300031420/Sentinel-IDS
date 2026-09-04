import { detectRequestRate } from "../detectors/requestRateDetector.js";

export const analyzeBehavior = async (event) => {
    const detectors = [
        detectRequestRate
    ];

    const detections = [];

    for (const detector of detectors) {
        const result = await detector(event);

        if (result.detected) {
            detections.push(result);
        }
    }

    return detections;
};