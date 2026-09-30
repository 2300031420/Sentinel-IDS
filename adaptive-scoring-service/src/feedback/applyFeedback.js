import {
    getWeight,
    setWeight
} from "../scoring/weightStore.js";

import {
    updateWeightFromFeedback
} from "./weightUpdater.js";

export const applyFeedback = async (
    detectionType,
    feedback
) => {
    const currentWeight = getWeight(detectionType);

    if (currentWeight === null) {
        return null;
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
        detectionType,
        oldWeight: currentWeight,
        newWeight,
        outcome: feedback.outcome
    };
};