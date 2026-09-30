import { evaluateFeedback } from "./feedbackEvaluator.js";
import { applyFeedback } from "./applyFeedback.js";

export const processFeedback = async ({
    detectionType,
    feedback
}) => {
    const evaluated = evaluateFeedback(feedback);

    if (evaluated.outcome === "UNKNOWN") {
        return {
            detectionType,
            ...evaluated
        };
    }

    return await applyFeedback(
        detectionType,
        evaluated
    );
};