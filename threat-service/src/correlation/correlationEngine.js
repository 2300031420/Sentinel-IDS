const correlationStore = new Map();

const CORRELATION_WINDOW_MS = 60 * 1000;


/*
 * Calculate confidence for a security activity.
 *
 * This is separate from the existing threat score.
 */
const calculateCorrelationConfidence = (context) => {

    let score = 0;

    const observations =
        context.observations;

    const requestCount =
        context.requestCount;


    /*
     * Same source IP
     *
     * Every activity already represents
     * observations from the same source.
     */
    if (context.sourceIp) {
        score += 20;
    }


    /*
     * Multiple requests indicate
     * repeated activity.
     */
    if (requestCount >= 2) {
        score += 20;
    }


    /*
     * Repeated attack type.
     */
    const types =
        observations.map(
            observation => observation.type
        );

    const uniqueTypes =
        new Set(types);


    const hasRepeatedType =
        types.length > uniqueTypes.size;

    if (hasRepeatedType) {
        score += 15;
    }


    /*
     * Multiple different detection types
     * indicate a broader attack pattern.
     */
    if (uniqueTypes.size >= 2) {
        score += 25;
    }


    /*
     * Behavioral detections provide
     * an additional correlation signal.
     */
    const hasBehavioralDetection =
        observations.some(
            observation =>
                observation.type ===
                "HIGH_REQUEST_RATE"
        );

    if (hasBehavioralDetection) {
        score += 20;
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
        confidence
    };
};


const findRelatedActivity = (
    detectionEvent
) => {

    const now = Date.now();


    for (
        const context
        of correlationStore.values()
    ) {

        const lastSeen =
            new Date(
                context.lastSeen
            ).getTime();


        const withinWindow =
            now - lastSeen <=
            CORRELATION_WINDOW_MS;


        const sameSource =
            context.sourceIp ===
            detectionEvent.sourceIp;


        if (
            withinWindow &&
            sameSource
        ) {

            return context;
        }
    }


    return null;
};


export const addObservation = (
    detectionEvent
) => {

    const {
        correlationId,
        requestId,
        sourceIp,
        method,
        path,
        detections
    } = detectionEvent;


    if (!correlationId) {
        return null;
    }


    /*
     * Ignore events that contain
     * no actual security detection.
     */
    if (
        !detections ||
        detections.length === 0
    ) {

        return null;
    }


    const now = Date.now();


    /*
     * First try the request's
     * correlation ID.
     */
    let context =
        correlationStore.get(
            correlationId
        );


    /*
     * If this is a new request-level
     * correlation ID, search for an
     * existing security activity.
     */
    if (!context) {

        context =
            findRelatedActivity(
                detectionEvent
            );
    }


    /*
     * No existing activity.
     * Create a new one.
     */
    if (!context) {

        context = {

            activityId:
                correlationId,

            sourceIp,

            firstSeen:
                new Date(
                    now
                ).toISOString(),

            lastSeen:
                new Date(
                    now
                ).toISOString(),

            requestCount: 0,

            observations: [],

            correlationScore: 0,

            confidence: "LOW"
        };


        correlationStore.set(
            context.activityId,
            context
        );

    } else {

        context.lastSeen =
            new Date(
                now
            ).toISOString();
    }


    /*
     * Count this request.
     */
    context.requestCount += 1;


    /*
     * Store every actual
     * security observation.
     */
    for (
        const detection
        of detections
    ) {

        context.observations.push({

            requestId,

            correlationId,

            sourceIp,

            method,

            path,

            type:
                detection.type,

            severity:
                detection.severity,

            score:
                detection.score,

            evidence:
                detection.evidence,

            timestamp:
                new Date(
                    now
                ).toISOString()
        });
    }


    /*
     * Recalculate confidence
     * after adding observations.
     */
    const confidence =
        calculateCorrelationConfidence(
            context
        );


    context.correlationScore =
        confidence.score;

    context.confidence =
        confidence.confidence;


    return context;
};


export const getCorrelationContext = (
    activityId
) => {

    return (
        correlationStore.get(
            activityId
        ) || null
    );
};


export const removeCorrelationContext = (
    activityId
) => {

    correlationStore.delete(
        activityId
    );
};


export const cleanupExpiredCorrelations = () => {

    const now = Date.now();


    for (
        const [
            activityId,
            context
        ]
        of correlationStore.entries()
    ) {

        const lastSeen =
            new Date(
                context.lastSeen
            ).getTime();


        if (
            now - lastSeen >
            CORRELATION_WINDOW_MS
        ) {

            correlationStore.delete(
                activityId
            );
        }
    }
};