import pool from "../db/mysql.js";

export const saveEvidence = async (evidence) => {
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
            incident_status,
            evidence_timestamp
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        evidence.evidenceId,
        evidence.incidentId,
        evidence.requestId,
        evidence.correlationId,
        evidence.activityId,
        evidence.trigger?.severity || "UNKNOWN",
        evidence.trigger?.threatScore || 0,
        evidence.trigger?.correlationScore || 0,
        evidence.trigger?.correlationConfidence || "LOW",
        evidence.request?.sourceIp || null,
        evidence.request?.method || null,
        evidence.request?.path || null,
        JSON.stringify(evidence.detections || []),
        evidence.incidentStatus || null,
        new Date(evidence.timestamp)
    ];

    await pool.execute(query, values);

    console.log(
        `[EVIDENCE] Evidence stored: ${evidence.evidenceId}`
    );
};