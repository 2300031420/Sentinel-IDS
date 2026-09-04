const detectionStore = new Map();

export const addDetection = (detectionEvent) => {
    const requestId = detectionEvent.requestId;

    if (!detectionStore.has(requestId)) {
        detectionStore.set(requestId, {
            requestId,
            sourceIp: detectionEvent.sourceIp,
            method: detectionEvent.method,
            path: detectionEvent.path,
            detections: []
        });
    }

    const stored = detectionStore.get(requestId);

    if (detectionEvent.detections?.length > 0) {
        stored.detections.push(
            ...detectionEvent.detections
        );
    }

    return stored;
};

export const removeDetection = (requestId) => {
    detectionStore.delete(requestId);
};