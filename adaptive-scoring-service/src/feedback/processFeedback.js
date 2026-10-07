import { evaluateFeedback } from "./feedbackEvaluator.js";
import { applyFeedback } from "./applyFeedback.js";

export const processFeedback = async ({
    requestId,
    activityId,
    incidentId,
    detectionType,
    feedback
}) => {
    const evaluated = evaluateFeedback(feedback);

    if (evaluated.outcome === "UNKNOWN") {
        return {
            requestId,
            activityId,
            incidentId,
            detectionType,
            ...evaluated
        };
    }

    return await applyFeedback(
        detectionType,
        evaluated,
        {
            requestId,
            activityId,
            incidentId
        }
    );
};