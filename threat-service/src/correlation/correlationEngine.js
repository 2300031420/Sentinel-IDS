const correlationStore = new Map();

const CORRELATION_WINDOW_MS = 60 * 1000;
const CLEANUP_INTERVAL_MS = 30 * 1000;


/*
 * Calculate confidence for a security activity.
 */
const calculateCorrelationConfidence = (context) => {

    let score = 0;

    const factors = [];

    const observations =
        context.observations;

    const requestCount =
        context.requestCount;


    /*
     * Factor 1: Source identity exists
     */
    if (context.sourceIp) {

        score += 20;

        factors.push({
            factor: "SAME_SOURCE_IP",
            weight: 20,
            description:
                "Security observations are associated with the same source IP"
        });
    }


    /*
     * Factor 2: Multiple suspicious requests
     */
    if (requestCount >= 2) {

        score += 20;

        factors.push({
            factor: "REPEATED_REQUEST",
            weight: 20,
            description:
                "Multiple suspicious requests occurred within the correlation window"
        });
    }


    const types =
        observations.map(
            observation => observation.type
        );


    const uniqueTypes =
        new Set(types);


    /*
     * Factor 3: Repeated detection type
     */
    const hasRepeatedType =
        types.length > uniqueTypes.size;


    if (hasRepeatedType) {

        score += 15;

        factors.push({
            factor: "REPEATED_DETECTION_TYPE",
            weight: 15,
            description:
                "The same detection type occurred multiple times"
        });
    }


    /*
     * Factor 4: Multiple attack techniques
     */
    if (uniqueTypes.size >= 2) {

        score += 25;

        factors.push({
            factor: "MULTIPLE_DETECTION_TYPES",
            weight: 25,
            description:
                "Multiple different detection types were observed in the same activity"
        });
    }


    /*
     * Factor 5: Behavioral anomaly
     */
    const hasBehavioralDetection =
        observations.some(
            observation =>
                observation.type ===
                "HIGH_REQUEST_RATE"
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


    score =
        Math.min(
            score,
            100
        );


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


        /*
         * Remove invalid timestamps
         * instead of keeping corrupted
         * contexts forever.
         */
        if (!Number.isFinite(lastSeen)) {

            correlationStore.delete(
                activityId
            );

            removedCount++;

            continue;
        }


        if (
            now - lastSeen >
            CORRELATION_WINDOW_MS
        ) {

            correlationStore.delete(
                activityId
            );

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
 * Automatically clean the in-memory
 * correlation store.
 *
 * Runs every 30 seconds.
 */
const cleanupTimer =
    setInterval(
        cleanupExpiredCorrelations,
        CLEANUP_INTERVAL_MS
    );


/*
 * Prevent the cleanup timer from
 * keeping the Node.js process alive
 * during shutdown.
 */
cleanupTimer.unref();


/*
 * Graceful cleanup for application shutdown.
 */
export const stopCorrelationCleanup = () => {

    clearInterval(
        cleanupTimer
    );
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


        if (!Number.isFinite(lastSeen)) {
            continue;
        }


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


    if (
        !detections ||
        detections.length === 0
    ) {

        return null;
    }


    /*
     * Remove stale contexts before
     * attempting correlation.
     */
    cleanupExpiredCorrelations();


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
     * Otherwise search for an
     * existing activity from the
     * same source IP.
     */
    if (!context) {

        context =
            findRelatedActivity(
                detectionEvent
            );
    }


    /*
     * Create a new activity.
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

            confidence: "LOW",

            correlationFactors: []
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


    context.requestCount += 1;


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


    const confidence =
        calculateCorrelationConfidence(
            context
        );


    context.correlationScore =
        confidence.score;

    context.confidence =
        confidence.confidence;


    context.correlationFactors =
        confidence.factors;

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