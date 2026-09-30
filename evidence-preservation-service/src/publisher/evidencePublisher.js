import redis from "../config/redis.js";

const EVIDENCE_STREAM =
    process.env.EVIDENCE_STREAM || "ids:evidence";

export const publishEvidence = async (evidence) => {
    try {
        const messageId = await redis.xadd(
            EVIDENCE_STREAM,
            "*",
            "evidence",
            JSON.stringify(evidence)
        );

        console.log(
            `[EVIDENCE] Evidence published ${messageId}`
        );

        return messageId;
    } catch (error) {
        console.error(
            "[EVIDENCE] Failed to publish evidence:",
            error
        );

        throw error;
    }
};