
const SEVERITY_WEIGHTS = Object.freeze({
    LOW: 10,
    MEDIUM: 20,
    HIGH: 30,
    CRITICAL: 40
});

const SEVERITY_RANK = Object.freeze({
    NONE: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4
});

const VALID_SEVERITIES = new Set([
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL"
]);

const isValidDetection = (detection) =>
    detection !== null &&
    typeof detection === "object" &&
    !Array.isArray(detection) &&
    typeof detection.type === "string" &&
    detection.type.trim().length > 0 &&
    detection.type.length <= 100 &&
    VALID_SEVERITIES.has(detection.severity) &&
    Number.isFinite(detection.score) &&
    detection.score >= 0 &&
    detection.score <= 100;

export const calculateThreatScore = (
    detections,
    adaptiveWeights = {}
) => {
    if (!Array.isArray(detections)) {
        throw new TypeError(
            "Threat detections must be an array"
        );
    }

    if (
        adaptiveWeights === null ||
        typeof adaptiveWeights !== "object" ||
        Array.isArray(adaptiveWeights)
    ) {
        throw new TypeError(
            "Adaptive weights must be an object"
        );
    }

    if (detections.length === 0) {
        return {
            score: 0,
            severity: "NONE"
        };
    }

    let score = 0;
    let highestSeverity = "NONE";

    for (const detection of detections) {
        if (!isValidDetection(detection)) {
            throw new TypeError(
                "Invalid detection record supplied to threat scorer"
            );
        }

        const adaptiveWeight =
            adaptiveWeights[detection.type];

        if (
            adaptiveWeight !== undefined &&
            (
                typeof adaptiveWeight !== "number" ||
                !Number.isFinite(adaptiveWeight) ||
                adaptiveWeight < 0 ||
                adaptiveWeight > 100
            )
        ) {
            throw new TypeError(
                "Invalid adaptive weight supplied to threat scorer"
            );
        }

        const detectionScore =
            adaptiveWeight ??
            detection.score ??
            SEVERITY_WEIGHTS[detection.severity];

        score += detectionScore;

        if (
            SEVERITY_RANK[detection.severity] >
            SEVERITY_RANK[highestSeverity]
        ) {
            highestSeverity = detection.severity;
        }
    }

    score = Math.min(score, 100);

    let severity;

    if (score >= 80) {
        severity = "CRITICAL";
    } else if (score >= 50) {
        severity = "HIGH";
    } else if (score >= 20) {
        severity = "MEDIUM";
    } else {
        severity = "LOW";
    }

    if (
        SEVERITY_RANK[highestSeverity] >
        SEVERITY_RANK[severity]
    ) {
        severity = highestSeverity;
    }

    return {
        score,
        severity
    };
};
