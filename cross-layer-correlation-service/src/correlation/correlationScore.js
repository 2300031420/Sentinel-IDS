const calculateHostAnomalyScore = (observation) => {
    let score = 0;

    if (observation.cpuUsage >= 80) {
        score += 30;
    }

    if (observation.memoryUsage >= 90) {
        score += 30;
    }

    return Math.min(score, 60);
};

export const calculateCrossLayerCorrelation = (context) => {
    if (!context) {
        return {
            score: 0,
            confidence: "LOW"
        };
    }

    if (
        context.webObservations.length === 0 ||
        context.hostObservations.length === 0
    ) {
        return {
            score: 0,
            confidence: "LOW"
        };
    }

    let score = 0;

    // Evidence that a suspicious web activity exists.
    score += 30;

    // Evaluate host-side anomalies.
    const hostScores = context.hostObservations.map(
        calculateHostAnomalyScore
    );

    const highestHostScore =
        hostScores.length > 0
            ? Math.max(...hostScores)
            : 0;

    score += highestHostScore;

    // Multiple host observations strengthen temporal correlation.
    if (context.hostObservations.length >= 2) {
        score += 10;
    }

    // Multiple web observations strengthen the activity context.
    if (context.webObservations.length >= 2) {
        score += 10;
    }

    score = Math.min(score, 100);

    let confidence;

    if (score >= 80) {
        confidence = "CRITICAL";
    } else if (score >= 60) {
        confidence = "HIGH";
    } else if (score >= 30) {
        confidence = "MEDIUM";
    } else {
        confidence = "LOW";
    }

    return {
        score,
        confidence
    };
};