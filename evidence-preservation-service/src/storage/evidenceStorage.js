
import pool from "../db/mysql.js";
import {
    calculateEvidenceHash,
    serializeEvidence
} from "../evidence/evidenceBuilder.js";

export const saveEvidence = async (evidence) => {
    const { integrity, ...payload } = evidence;

    // Recalculate instead of trusting a hash received through Redis.
    const evidencePayload = serializeEvidence(payload);
    const evidenceHash = calculateEvidenceHash(payload);

    if (
        integrity?.algorithm !== "SHA-256" ||
        integrity?.hash !== evidenceHash
    ) {
        throw new Error(
            `Evidence integrity check failed before storage: ${evidence.evidenceId}`
        );
    }

    const query = `
        INSERT INTO evidence (
            evidence_id,
            incident_id,
            request_id,
            correlation_id,
            activity_id,
            severity,
            threat_score,
            correlation_score,
            correlation_confidence,
            source_ip,
            method,
            path,
            detections,
            host_id,
            host_cpu_usage,
            host_memory_usage,
            host_process_count,
            host_platform,
            host_architecture,
            host_telemetry_timestamp,
            incident_status,
            evidence_timestamp,
            evidence_hash,
            hash_algorithm,
            evidence_payload
        )
        VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    `;

    const values = [
        evidence.evidenceId,
        evidence.incidentId,
        evidence.requestId,
        evidence.correlationId,
        evidence.activityId,

        payload.trigger?.severity || "UNKNOWN",
        payload.trigger?.threatScore ?? 0,
        payload.trigger?.correlationScore ?? 0,
        payload.trigger?.correlationConfidence || "LOW",

        payload.request?.sourceIp || null,
        payload.request?.method || null,
        payload.request?.path || null,

        JSON.stringify(payload.detections || []),

        payload.hostTelemetry?.hostId || null,
        payload.hostTelemetry?.cpuUsage ?? null,
        payload.hostTelemetry?.memoryUsage ?? null,
        payload.hostTelemetry?.processCount ?? null,
        payload.hostTelemetry?.platform || null,
        payload.hostTelemetry?.architecture || null,

        payload.hostTelemetry?.timestamp
            ? new Date(payload.hostTelemetry.timestamp)
            : null,

        payload.incidentStatus || null,
        new Date(payload.timestamp),

        evidenceHash,
        "SHA-256",
        evidencePayload
    ];

    await pool.execute(query, values);

    console.log(
        `[EVIDENCE] Evidence stored with verified hash: ${evidence.evidenceId}`
    );
};
