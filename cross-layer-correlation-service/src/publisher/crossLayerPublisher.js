import redis from "../config/redis.js";

const CORRELATION_STREAM =
    process.env.CORRELATION_STREAM || "ids:cross-layer";

export const publishCrossLayerCorrelation = async (
    context
) => {
    try {
        const message = {
            activityId: context.activityId,

            webObservations: context.webObservations,

            hostObservations: context.hostObservations,

            correlationScore: context.correlationScore,

            correlationConfidence: context.confidence,

            firstSeen: new Date(
                context.firstSeen
            ).toISOString(),

            lastSeen: new Date(
                context.lastSeen
            ).toISOString()
        };

        const messageId = await redis.xadd(
            CORRELATION_STREAM,
            "*",
            "data",
            JSON.stringify(message)
        );

        console.log(
            `[CROSS-LAYER] Published correlation ${messageId}`
        );

        return messageId;
    } catch (error) {
        console.error(
            "[CROSS-LAYER] Failed to publish correlation:",
            error
        );

        throw error;
    }
};