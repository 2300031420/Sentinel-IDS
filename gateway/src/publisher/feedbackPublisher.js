import redis from "../config/redis.js";

const FEEDBACK_STREAM =
    process.env.FEEDBACK_STREAM || "ids:feedback";

export const publishFeedback = async ({
    requestId,
    activityId,
    incidentId,
    detectionType,
    responseStatus
}) => {
    const feedback = {
        requestId: requestId || null,
        activityId: activityId || null,
        incidentId: incidentId || null,
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
        `[GATEWAY] Feedback published: ${messageId}`,
        feedback
    );

    return messageId;
};