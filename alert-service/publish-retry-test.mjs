import "dotenv/config";
import crypto from "node:crypto";
import pool from "./src/config/database.js";
import redis from "./src/config/redis.js";

const incidentId = "7e5e13d7-de3a-42f7-bb51-fe8965ffafef";
const requestId = "47bbcd5c-23a7-438b-be5f-a4e311bf308c";

try {
    const [rows] = await pool.execute(
        `SELECT incident_id, request_id, correlation_id, activity_id,
                correlation_score, correlation_confidence, source_ip,
                method, Path AS path, Threat_score AS threatScore,
                severity, status, Detections AS detections
         FROM incidents
         WHERE incident_id = ? AND request_id = ?`,
        [incidentId, requestId]
    );

    if (rows.length !== 1) {
        throw new Error("Expected exactly one matching test incident.");
    }

    const row = rows[0];
    const incident = {
        incidentId: row.incident_id,
        requestId: row.request_id,
        correlationId: row.correlation_id,
        activityId: row.activity_id,
        correlationScore: row.correlation_score,
        correlationConfidence: row.correlation_confidence,
        sourceIp: row.source_ip,
        method: row.method,
        path: row.path,
        threatScore: row.threatScore,
        severity: row.severity,
        status: row.status,
        detections: typeof row.detections === "string"
            ? JSON.parse(row.detections)
            : row.detections,
        timestamp: new Date().toISOString(),
        retryTestId: crypto.randomUUID()
    };

    const streamId = await redis.xadd(
        "ids:incidents", "*", "incident", JSON.stringify(incident)
    );

    console.log("Republished test incident:", incidentId);
    console.log("New Redis stream entry:", streamId);
} catch (error) {
    console.error("Retry event publish failed:", error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
    await redis.quit();
}
