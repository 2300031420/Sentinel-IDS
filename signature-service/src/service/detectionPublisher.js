import redis from "../config/redis.js";

const DETECTION_STREAM =
    process.env.DETECTION_STREAM || "ids:detections";

export const publishDetectionResults = async ({
    event,
    detections
}) => {
    const detectionEvent = {
        requestId: event.requestId,
        correlationId: event.correlationId,

        // Preserve the host that generated the traffic
        hostId: event.hostId,

        timestamp: event.timestamp ||
            new Date().toISOString(),

        sourceIp: event.sourceIp,
        method: event.method,
        path: event.path,

        detected: detections.length > 0,

        detections
    };

    await redis.xadd(
        DETECTION_STREAM,
        "*",
        "detection",
        JSON.stringify(detectionEvent)
    );

    console.log(
        `[DETECTION BUS] Published ${event.requestId} | Host: ${event.hostId}`
    );
};