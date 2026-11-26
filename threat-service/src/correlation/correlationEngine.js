
const correlationStore = new Map();

const CORRELATION_WINDOW_MS = 60 * 1000;
const CLEANUP_INTERVAL_MS = 30 * 1000;
const MAX_REQUEST_ID_LENGTH = 200;
const MAX_CORRELATION_ID_LENGTH = 200;
const MAX_OBSERVATIONS_PER_ACTIVITY = 1000;
const MAX_EVIDENCE_LENGTH = 4096;

const VALID_SEVERITIES = new Set([
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL"
]);

/*
 * Validate incoming detection records before storing them.
 */
const isValidDetection = (detection) => {
    return (
        detection !== null &&
        typeof detection === "object" &&
        !Array.isArray(detection) &&
        typeof detection.type === "string" &&
        detection.type.trim().length > 0 &&
        detection.type.length <= 100 &&
        VALID_SEVERITIES.has(detection.severity) &&
        Number.isFinite(detection.score) &&
        detection.score >= 0 &&
        detection.score <= 100 &&
        (
            detection.evidence == null ||
            (
                typeof detection.evidence === "string" &&
                detection.evidence.length <= MAX_EVIDENCE_LENGTH
            )
        )
    );
};

/*
 * Calculate confidence for a security activity.
 */
const calculateCorrelationConfidence = (context) => {
    let score = 0;
    const factors = [];
    const observations = context.observations;
    const requestCount = context.requestCount;

    // Factor 1: Source identity exists.
    if (context.sourceIp) {
        score += 20;

        factors.push({
            factor: "SAME_SOURCE_IP",
            weight: 20,
            description:
                "Security observations are associated with the same source IP"
        });
    }

    // Factor 2: Multiple suspicious requests.
    if (requestCount >= 2) {
        score += 20;

        factors.push({
            factor: "REPEATED_REQUEST",
            weight: 20,
            description:
                "Multiple suspicious requests occurred within the correlation window"
        });
    }

    const types = observations.map(
        (observation) => observation.type
    );

    const uniqueTypes = new Set(types);

    // Factor 3: Repeated detection type.
    const hasRepeatedType = types.length > uniqueTypes.size;

    if (hasRepeatedType) {
        score += 15;

        factors.push({
            factor: "REPEATED_DETECTION_TYPE",
            weight: 15,
            description:
                "The same detection type occurred multiple times"
        });
    }

    // Factor 4: Multiple attack techniques.
    if (uniqueTypes.size >= 2) {
        score += 25;

        factors.push({
            factor: "MULTIPLE_DETECTION_TYPES",
            weight: 25,
            description:
                "Multiple different detection types were observed in the same activity"
        });
    }

    // Factor 5: Behavioral anomaly.
    const hasBehavioralDetection = observations.some(
        (observation) =>
            observation.type === "HIGH_REQUEST_RATE"
    );

    if (hasBehavioralDetection) {
        score += 20;

        factors.push({
            factor: "BEHAVIORAL_DETECTION",
            weight: 20,
            description:
                "Behavioral analysis detected an abnormal request pattern"
        });
    }

    score = Math.min(score, 100);

    let confidence;

    if (score >= 90) {
        confidence = "CRITICAL";
    } else if (score >= 70) {
        confidence = "HIGH";
    } else if (score >= 40) {
        confidence = "MEDIUM";
    } else {
        confidence = "LOW";
    }

    return {
        score,
        confidence,
        factors
    };
};

/*
 * Remove expired activities.
 */
export const cleanupExpiredCorrelations = () => {
    const now = Date.now();
    let removedCount = 0;

    for (const [activityId, context] of correlationStore.entries()) {
        const lastSeen = Date.parse(context.lastSeen);

        if (!Number.isFinite(lastSeen)) {
            correlationStore.delete(activityId);
            removedCount++;
            continue;
        }

        if (now - lastSeen > CORRELATION_WINDOW_MS) {
            correlationStore.delete(activityId);
            removedCount++;
        }
    }

    if (removedCount > 0) {
        console.log(
            `[CORRELATION] Cleaned ${removedCount} expired activities`
        );
    }

    return removedCount;
};

/*
 * Periodically clean expired in-memory activities.
 */
const cleanupTimer = setInterval(
    cleanupExpiredCorrelations,
    CLEANUP_INTERVAL_MS
);

cleanupTimer.unref();

/*
 * Stop the cleanup timer during graceful shutdown.
 */
export const stopCorrelationCleanup = () => {
    clearInterval(cleanupTimer);
};

/*
 * Find an existing activity from the same source IP.
 */
const findRelatedActivity = (detectionEvent) => {
    const now = Date.now();

    // Do not correlate unrelated requests when the source IP is missing.
    if (
        typeof detectionEvent.sourceIp !== "string" ||
        detectionEvent.sourceIp.length === 0
    ) {
        return null;
    }

    for (const context of correlationStore.values()) {
        const lastSeen = Date.parse(context.lastSeen);

        if (!Number.isFinite(lastSeen)) {
            continue;
        }

        const withinWindow =
            now - lastSeen <= CORRELATION_WINDOW_MS;

        const sameSource =
            context.sourceIp === detectionEvent.sourceIp;

        if (withinWindow && sameSource) {
            return context;
        }
    }

    return null;
};

/*
 * Add validated detections to a correlation activity.
 *
 * Duplicate observations are ignored. Each request contributes at
 * most once to requestCount, even when detections arrive in batches.
 */
export const addObservation = (detectionEvent) => {
    if (
        !detectionEvent ||
        typeof detectionEvent !== "object" ||
        Array.isArray(detectionEvent)
    ) {
        return null;
    }

    const {
        correlationId,
        requestId,
        sourceIp,
        method,
        path,
        detections
    } = detectionEvent;

    if (
        typeof correlationId !== "string" ||
        correlationId.trim().length === 0 ||
        correlationId.length > MAX_CORRELATION_ID_LENGTH
    ) {
        return null;
    }

    if (
        !Array.isArray(detections) ||
        detections.length === 0 ||
        typeof requestId !== "string" ||
        requestId.trim().length === 0 ||
        requestId.length > MAX_REQUEST_ID_LENGTH
    ) {
        return null;
    }

    // Reject the event before creating state if every detection is invalid.
    const validDetections = detections.filter(isValidDetection);

    if (validDetections.length === 0) {
        return null;
    }

    cleanupExpiredCorrelations();

    const now = Date.now();

    // First try the supplied correlation ID.
    let context = correlationStore.get(correlationId);

    // Otherwise, find a recent activity from the same source IP.
    if (!context) {
        context = findRelatedActivity(detectionEvent);
    }

    // Create a new activity if no related context exists.
    if (!context) {
        context = {
            activityId: correlationId,
            sourceIp:
                typeof sourceIp === "string" ? sourceIp : null,
            firstSeen: new Date(now).toISOString(),
            lastSeen: new Date(now).toISOString(),
            requestCount: 0,
            requestIds: new Set(),
            observations: [],
            observationKeys: new Set(),
            correlationScore: 0,
            confidence: "LOW",
            correlationFactors: []
        };

        correlationStore.set(context.activityId, context);
    } else {
        context.lastSeen = new Date(now).toISOString();

        // Support contexts created before these sets were introduced.
        if (!(context.observationKeys instanceof Set)) {
            context.observationKeys = new Set();
        }

        if (!(context.requestIds instanceof Set)) {
            context.requestIds = new Set();
        }

        // Rebuild deduplication state if a legacy context has observations.
        if (context.observationKeys.size === 0) {
            for (const observation of context.observations || []) {
                context.observationKeys.add(
                    JSON.stringify([
                        observation.requestId,
                        observation.type,
                        observation.severity ?? null,
                        observation.score ?? null,
                        observation.evidence ?? null
                    ])
                );
            }
        }

        if (context.requestIds.size === 0) {
            for (const observation of context.observations || []) {
                if (typeof observation.requestId === "string") {
                    context.requestIds.add(observation.requestId);
                }
            }

            context.requestCount = context.requestIds.size;
        }
    }

    const addedTypes = new Set();
    let addedObservation = false;

    for (const detection of validDetections) {
        const observationKey = JSON.stringify([
            requestId,
            detection.type,
            detection.severity,
            detection.score,
            detection.evidence ?? null
        ]);

        if (context.observationKeys.has(observationKey)) {
            continue;
        }

        // Bound memory usage for each activity.
        if (
            context.observations.length >=
            MAX_OBSERVATIONS_PER_ACTIVITY
        ) {
            console.warn(
                `[CORRELATION] Observation limit reached for activity ${context.activityId}`
            );
            break;
        }

        context.observationKeys.add(observationKey);
        addedTypes.add(detection.type);
        addedObservation = true;

        context.observations.push({
            requestId,
            correlationId,
            sourceIp:
                typeof sourceIp === "string" ? sourceIp : null,
            method:
                typeof method === "string" ? method.slice(0, 20) : null,
            path:
                typeof path === "string" ? path.slice(0, 4096) : null,
            type: detection.type,
            severity: detection.severity,
            score: detection.score,
            evidence: detection.evidence ?? null,
            timestamp: new Date(now).toISOString()
        });
    }

    // Count a request only when it contributed a new observation.
    if (
        addedObservation &&
        !context.requestIds.has(requestId)
    ) {
        context.requestIds.add(requestId);
        context.requestCount = context.requestIds.size;
    }

    // Recalculate confidence after valid processing.
    const confidence = calculateCorrelationConfidence(context);

    context.correlationScore = confidence.score;
    context.confidence = confidence.confidence;
    context.correlationFactors = confidence.factors;

    return context;
};

/*
 * Retrieve a correlation context by activity ID.
 */
export const getCorrelationContext = (activityId) => {
    return correlationStore.get(activityId) || null;
};

/*
 * Remove a correlation context by activity ID.
 */
export const removeCorrelationContext = (activityId) => {
    correlationStore.delete(activityId);
};
