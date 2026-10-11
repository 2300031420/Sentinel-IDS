
import dotenv from "dotenv";
import crypto from "node:crypto";

dotenv.config({
    path: ".env.test",
    override: true
});
const {
    verifyEvidenceIntegrityWithPool
} = await import("../src/storage/evidenceVerification.js");
const { default: testPool } = await import("../src/db/testMysql.js");

console.log("[TEST] Integrity test started");

const evidenceId = crypto.randomUUID();
const incidentId = crypto.randomUUID();
const requestId = crypto.randomUUID();
const correlationId = crypto.randomUUID();
const activityId = crypto.randomUUID();

const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);

    if (value !== null && typeof value === "object") {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = canonicalize(value[key]);
            return result;
        }, {});
    }

    return value;
};

const hash = (value) =>
    crypto.createHash("sha256")
        .update(JSON.stringify(canonicalize(value)), "utf8")
        .digest("hex");

const payload = {
    evidenceId,
    incidentId,
    requestId,
    correlationId,
    activityId,
    timestamp: new Date().toISOString(),
    trigger: {
        severity: "HIGH",
        threatScore: 40,
        correlationScore: 20,
        correlationConfidence: "LOW"
    },
    request: {
        sourceIp: "127.0.0.1",
        method: "GET",
        path: "/integrity-test"
    },
    detections: [],
    hostTelemetry: null,
    incidentStatus: "OPEN"
};

let inserted = false;

try {
    const payloadJson = JSON.stringify(canonicalize(payload));
    const originalHash = hash(payload);

    await testPool.execute(
        `INSERT INTO evidence (
            evidence_id, incident_id, request_id, correlation_id,
            activity_id, severity, threat_score, correlation_score,
            correlation_confidence, source_ip, method, path, detections,
            incident_status, evidence_timestamp, evidence_hash,
            hash_algorithm, evidence_payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            evidenceId, incidentId, requestId, correlationId, activityId,
            "HIGH", 40, 20, "LOW", "127.0.0.1", "GET",
            "/integrity-test", JSON.stringify([]), "OPEN",
            new Date(payload.timestamp), originalHash, "SHA-256",
            payloadJson
        ]
    );

    inserted = true;
    console.log("[TEST] Disposable evidence inserted:", evidenceId);


   const before = await verifyEvidenceIntegrityWithPool(
    evidenceId,
    testPool
);

console.log("[TEST] Before tampering:", before);

if (!before.verified || before.reason !== "HASH_MATCH") {
    throw new Error("Untampered evidence did not verify");
}

await testPool.execute(
    "UPDATE evidence SET evidence_hash = ? WHERE evidence_id = ?",
    ["0".repeat(64), evidenceId]
);


   const after = await verifyEvidenceIntegrityWithPool(
    evidenceId,
    testPool
);

console.log("[TEST] After tampering:", after);

if (after.verified || after.reason !== "HASH_MISMATCH") {
    throw new Error("Tampered evidence was not detected");
}

console.log("[TEST] PASS: Actual verifier detected tampering.");
} catch (error) {
    console.error("[TEST] FAILED:", error.message);
    process.exitCode = 1;
} finally {
    if (inserted) {
        try {
            await testPool.execute(
                "DELETE FROM evidence WHERE evidence_id = ?",
                [evidenceId]
            );
            console.log("[TEST] Disposable evidence removed");
        } catch (error) {
            console.error(
                "[TEST] CLEANUP FAILED — remove this test record in MySQL Workbench:",
                evidenceId,
                error.message
            );
            process.exitCode = 1;
        }
    }

    await testPool.end();
}
