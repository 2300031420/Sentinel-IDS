import redis from "../config/redis.js";

import {
    FEEDBACK_STREAM
} from "../config/feedbackConfig.js";

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
        `[ADAPTIVE] Feedback published: ${messageId}`
    );

    return messageId;
};