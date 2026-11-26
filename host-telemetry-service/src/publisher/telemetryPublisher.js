import redis from "../config/redis.js";

const TELEMETRY_STREAM =
    process.env.TELEMETRY_STREAM || "ids:telemetry";

export const publishTelemetry = async (telemetry) => {
    try {
        const messageId = await redis.xadd(
            TELEMETRY_STREAM,
            "*",
            "data",
            JSON.stringify(telemetry)
        );

        console.log(
            `[HOST TELEMETRY] Published ${messageId}`
        );

        return messageId;
    } catch (error) {
        console.error(
            "[HOST TELEMETRY] Failed to publish telemetry:",
            error
        );

        throw error;
    }
};