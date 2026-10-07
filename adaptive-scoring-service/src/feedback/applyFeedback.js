import {
    getWeight,
    setWeight
} from "../scoring/weightStore.js";

import {
    updateWeightFromFeedback
} from "./weightUpdater.js";

export const applyFeedback = async (
    detectionType,
    feedback,
    {
        requestId = null,
        activityId = null,
        incidentId = null
    } = {}
) => {
    const currentWeight = getWeight(detectionType);

    if (currentWeight === null) {
        return {
            requestId,
            activityId,
            incidentId,
            detectionType,
            outcome: "UNKNOWN",
            adjustment: 0
        };
    }

    const newWeight = updateWeightFromFeedback({
        currentWeight,
        adjustment: feedback.adjustment
    });

    await setWeight(
        detectionType,
        newWeight
    );

    return {
        requestId,
        activityId,
        incidentId,
        detectionType,
        oldWeight: currentWeight,
        newWeight,
        outcome: feedback.outcome
    };
};