import crypto from "node:crypto";
import { createIncident } from "./src/services/incidentService.js";
import pool from "./src/config/database.js";
import redis from "./src/config/redis.js";

const requestId = crypto.randomUUID();

const threat = {
    requestId,
    correlationId: crypto.randomUUID(),
    activityId: crypto.randomUUID(),
    correlationScore: 75,
    correlationConfidence: "HIGH",
    hostId: "sentinel-reliability-test",
    sourceIp: "127.0.0.1",
    method: "GET",
    path: "/sentinel-retry-audit-test",
    score: 75,
    severity: "HIGH",
    detections: [
        {
            type: "RELIABILITY_TEST",
            severity: "HIGH",
            score: 75,
            description: "Isolated alert retry reliability test"
        }
    ]
};

try {
    const incidentId = await createIncident(threat);
    console.log(JSON.stringify({ incidentId, requestId }, null, 2));
} catch (error) {
    console.error("TEST FAILED:", error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
    await redis.quit();
}
