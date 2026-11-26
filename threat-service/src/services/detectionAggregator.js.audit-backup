import {
    addObservation
} from "../correlation/correlationEngine.js";

const detectionStore = new Map();

export const addDetection = (detectionEvent) => {

    const requestId =
        detectionEvent.requestId;

    /*
     * Send the detection event to the
     * correlation engine first.
     */
    const correlationContext =
        addObservation(detectionEvent);

    /*
     * Existing request-level aggregation
     */
    if (!detectionStore.has(requestId)) {
        detectionStore.set(requestId, {
            requestId,

            correlationId:
                detectionEvent.correlationId,

            activityId:
                correlationContext?.activityId || null,

            correlationScore:
                correlationContext?.correlationScore || 0,

            confidence:
                correlationContext?.confidence || "LOW",

            /*
             * Preserve the host that generated
             * the original traffic event.
             */
            hostId:
                detectionEvent.hostId || null,

            /*
             * Preserve the original event timestamp.
             */
            timestamp:
                detectionEvent.timestamp ||
                new Date().toISOString(),

            sourceIp:
                detectionEvent.sourceIp,

            method:
                detectionEvent.method,

            path:
                detectionEvent.path,

            detections: []
        });
    }

    const stored =
        detectionStore.get(requestId);

    /*
     * Add actual detections
     */
    if (
        detectionEvent.detections?.length > 0
    ) {
        stored.detections.push(
            ...detectionEvent.detections
        );
    }

    /*
     * Preserve host/timestamp if the
     * aggregated request already exists.
     */
    if (!stored.hostId && detectionEvent.hostId) {
        stored.hostId =
            detectionEvent.hostId;
    }

    if (
        detectionEvent.timestamp &&
        (
            !stored.timestamp ||
            new Date(detectionEvent.timestamp).getTime() <
            new Date(stored.timestamp).getTime()
        )
    ) {
        stored.timestamp =
            detectionEvent.timestamp;
    }

    /*
     * Update correlation information.
     */
    if (correlationContext) {
        stored.activityId =
            correlationContext.activityId;

        stored.correlationScore =
            correlationContext.correlationScore;

        stored.confidence =
            correlationContext.confidence;
    }

    /*
     * Log correlation activity
     */
    if (correlationContext) {

        console.log(
            "\n[CORRELATION] Security activity updated:"
        );

        console.log({

            activityId:
                correlationContext.activityId,

            sourceIp:
                correlationContext.sourceIp,

            requestCount:
                correlationContext.requestCount,

            observations:
                correlationContext.observations.length,

            correlationScore:
                correlationContext.correlationScore,

            confidence:
                correlationContext.confidence,
            correlationFactors: 
                correlationContext.correlationFactors,

            firstSeen:
                correlationContext.firstSeen,

            lastSeen:
                correlationContext.lastSeen
        });
    }

    return stored;
};

export const removeDetection = (
    requestId
) => {
    detectionStore.delete(
        requestId
    );
};