import crypto from "crypto";

export const shouldPreserveEvidence = (incident) => {
    if (!incident) {
        return false;
    }

    return (
        incident.severity === "HIGH" ||
        incident.severity === "CRITICAL"
    );
};

export const buildEvidencePackage = (
    incident,
    hostTelemetry = null
) => {
    return {
        evidenceId: crypto.randomUUID(),

        incidentId: incident.incidentId,
        requestId: incident.requestId,
        correlationId: incident.correlationId,
        activityId: incident.activityId,

        timestamp: new Date().toISOString(),

        trigger: {
            severity: incident.severity,
            threatScore: incident.threatScore,
            correlationScore: incident.correlationScore,
            correlationConfidence:
                incident.correlationConfidence
        },

        request: {
            sourceIp: incident.sourceIp,
            method: incident.method,
            path: incident.path
        },

        detections: incident.detections || [],

        hostTelemetry: hostTelemetry
            ? {
                hostId: hostTelemetry.hostId,
                cpuUsage: hostTelemetry.cpuUsage,
                memoryUsage: hostTelemetry.memoryUsage,
                processCount: hostTelemetry.processCount,
                platform: hostTelemetry.platform,
                architecture: hostTelemetry.architecture,
                timestamp: hostTelemetry.timestamp
            }
            : null,

        incidentStatus: incident.status
    };
};