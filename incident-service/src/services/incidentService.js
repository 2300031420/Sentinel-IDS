import crypto from "crypto";
import pool from "../config/database.js";
import redis from "../config/redis.js";

export const createIncident = async (threat) => {
    // Check if an incident already exists for this request
    const [existingIncidents] = await pool.execute(
        `
        SELECT incident_id
        FROM incidents
        WHERE request_id = ?
        LIMIT 1
        `,
        [threat.requestId]
    );

    if (existingIncidents.length > 0) {
        const existingIncidentId = existingIncidents[0].incident_id;

        console.log(
            `[INCIDENT] Duplicate request detected: ${threat.requestId}`
        );

        console.log(
            `[INCIDENT] Existing incident: ${existingIncidentId}`
        );

        return existingIncidentId;
    }

    const incidentId = crypto.randomUUID();

    const query = `
        INSERT INTO incidents (
            incident_id,
            request_id,
            source_ip,
            method,
            path,
            threat_score,
            severity,
            status,
            detections
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        incidentId,
        threat.requestId,
        threat.sourceIp,
        threat.method,
        threat.path,
        threat.score,
        threat.severity,
        "OPEN",
        JSON.stringify(threat.detections)
    ];

    try {
        await pool.execute(query, values);

        console.log(`[INCIDENT] Created incident ${incidentId}`);

        await redis.xadd(
            "ids:incidents",
            "*",
            "incident",
            JSON.stringify({
                incidentId,
                requestId: threat.requestId,
                sourceIp: threat.sourceIp,
                method: threat.method,
                path: threat.path,
                threatScore: threat.score,
                severity: threat.severity,
                status: "OPEN",
                detections: threat.detections,
                timestamp: new Date().toISOString()
            })
        );

        console.log(
            `[INCIDENT BUS] Published incident ${incidentId}`
        );

        return incidentId;

    } catch (error) {

        // Handles a race condition where another process
        // creates the same request_id between SELECT and INSERT
        if (error.code === "ER_DUP_ENTRY") {

            const [existing] = await pool.execute(
                `
                SELECT incident_id
                FROM incidents
                WHERE request_id = ?
                LIMIT 1
                `,
                [threat.requestId]
            );

            if (existing.length > 0) {

                console.log(
                    `[INCIDENT] Duplicate prevented for request ${threat.requestId}`
                );

                return existing[0].incident_id;
            }
        }

        throw error;
    }
};