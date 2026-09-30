const SEVERITY_WEIGHTS = {
    LOW: 10,
    MEDIUM: 20,
    HIGH: 30,
    CRITICAL: 40
};

const SEVERITY_RANK = {
    NONE: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4
};

export const calculateThreatScore = (
    detections,
    adaptiveWeights = {}
) => {
    if (!detections || detections.length === 0) {
        return {
            score: 0,
            severity: "NONE"
        };
    }

    let score = 0;
    let highestSeverity = "NONE";

    for (const detection of detections) {
        const adaptiveWeight =
            adaptiveWeights[detection.type];

        const detectionScore =
            adaptiveWeight ??
            detection.score ??
            SEVERITY_WEIGHTS[detection.severity] ??
            0;

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