import redis from "../config/redis.js";

const FEEDBACK_STREAM =
    process.env.FEEDBACK_STREAM || "ids:feedback";

export const publishFeedback = async ({
    detectionType,
    responseStatus
}) => {
    const feedback = {
        detectionType,
        responseStatus
    };

    const messageId = await redis.xadd(
        FEEDBACK_STREAM,
        "*",
        "feedback",
        JSON.stringify(feedback)
    );

    console.log(
        `[ALERT] Feedback published: ${messageId}`
    );

    return messageId;
};