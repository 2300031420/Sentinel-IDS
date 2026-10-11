
import crypto from "node:crypto";

export const shouldPreserveEvidence = (incident) => {
    if (!incident) {
        return false;
    }

    return (
        incident.severity === "HIGH" ||
        incident.severity === "CRITICAL"
    );
};

// Sort object keys recursively so equivalent evidence always
// produces the same JSON representation.
const canonicalize = (value) => {
    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }

    if (value !== null && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce((result, key) => {
                result[key] = canonicalize(value[key]);
                return result;
            }, {});
    }

    return value;
};

export const serializeEvidence = (evidence) =>
    JSON.stringify(canonicalize(evidence));

export const calculateEvidenceHash = (evidence) =>
    crypto
        .createHash("sha256")
        .update(serializeEvidence(evidence), "utf8")
        .digest("hex");

export const buildEvidencePackage = (
    incident,
    hostTelemetry = null
) => {
    const evidence = {
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

    // Hash the complete evidence object before adding metadata.
    evidence.integrity = {
        algorithm: "SHA-256",
        hash: calculateEvidenceHash(evidence)
    };

    return evidence;
};
