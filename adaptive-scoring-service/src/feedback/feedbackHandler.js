import { processFeedback } from "./processFeedback.js";

export const handleFeedback = async ({
    requestId,
    activityId,
    incidentId,
    detectionType,
    responseStatus
}) => {
    const result = await processFeedback({
        requestId,
        activityId,
        incidentId,
        detectionType,
        feedback: {
            responseStatus
        }
    });

    console.log(
        `[ADAPTIVE] Feedback processed:`,
        result
    );

    return result;
};