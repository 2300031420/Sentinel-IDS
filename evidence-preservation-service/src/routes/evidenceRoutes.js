
import express from "express";
import {
    authenticate,
    authorizeEvidenceVerification
} from "../middleware/authMiddleware.js";
import {
    verifyEvidenceIntegrity
} from "../storage/evidenceVerification.js";

const router = express.Router();

router.get(
    "/:evidenceId/verify",
    authenticate,
    authorizeEvidenceVerification,
    async (req, res) => {
        const { evidenceId } = req.params;

        // Evidence IDs are generated as UUIDs.
        const uuidPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuidPattern.test(evidenceId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid evidence ID"
            });
        }

        try {
            const result =
                await verifyEvidenceIntegrity(evidenceId);

            if (result.reason === "EVIDENCE_NOT_FOUND") {
                return res.status(404).json({
                    success: false,
                    ...result
                });
            }

            if (!result.verified) {
                return res.status(409).json({
                    success: false,
                    ...result
                });
            }

            return res.status(200).json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error(
                "[EVIDENCE API] Verification failed:",
                error.code || error.name || "UNKNOWN_ERROR"
            );

            return res.status(500).json({
                success: false,
                message: "Evidence verification failed"
            });
        }
    }
);

export default router;
