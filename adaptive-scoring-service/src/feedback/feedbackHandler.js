import { processFeedback } from "./processFeedback.js";

export const handleFeedback = async ({
    detectionType,
    responseStatus
}) => {
    const result = await processFeedback({
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