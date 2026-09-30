import {
    adjustWeight
} from "../scoring/weightModel.js";

export const updateWeightFromFeedback = ({
    currentWeight,
    adjustment
}) => {
    return adjustWeight(
        currentWeight,
        adjustment
    );
};