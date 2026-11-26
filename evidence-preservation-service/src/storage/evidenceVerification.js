
import crypto from "node:crypto";
import pool from "../db/mysql.js";
import { calculateEvidenceHash } from "../evidence/evidenceBuilder.js";

export const verifyEvidenceIntegrityWithPool = async (
    evidenceId,
    dbPool
) => {
    const [rows] = await dbPool.execute(
        `SELECT evidence_payload, evidence_hash, hash_algorithm
         FROM evidence
         WHERE evidence_id = ?
         LIMIT 1`,
        [evidenceId]
    );

    if (!rows.length) {
        return {
            verified: false,
            reason: "EVIDENCE_NOT_FOUND"
        };
    }

    const row = rows[0];

    if (
        row.hash_algorithm !== "SHA-256" ||
        !row.evidence_hash ||
        !row.evidence_payload
    ) {
        return {
            verified: false,
            reason: "INTEGRITY_METADATA_MISSING"
        };
    }

    let payload;

    try {
        payload = JSON.parse(row.evidence_payload);
    } catch {
        return {
            verified: false,
            reason: "INVALID_EVIDENCE_PAYLOAD"
        };
    }

    const calculatedHash = calculateEvidenceHash(payload);
    const storedHash = String(row.evidence_hash);

    if (!/^[a-f0-9]{64}$/.test(storedHash)) {
        return {
            verified: false,
            evidenceId,
            algorithm: "SHA-256",
            reason: "HASH_MISMATCH"
        };
    }

    const verified = crypto.timingSafeEqual(
        Buffer.from(calculatedHash, "hex"),
        Buffer.from(storedHash, "hex")
    );

    return {
        verified,
        evidenceId,
        algorithm: "SHA-256",
        reason: verified ? "HASH_MATCH" : "HASH_MISMATCH"
    };
};

export const verifyEvidenceIntegrity = (evidenceId) =>
    verifyEvidenceIntegrityWithPool(evidenceId, pool);
