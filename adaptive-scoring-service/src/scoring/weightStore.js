import { getDefaultWeights } from "./weightModel.js";
import { loadWeights, saveWeight } from "./weightPersistence.js";

const weights = getDefaultWeights();

export const initializeWeights = async () => {
    const storedWeights = await loadWeights();

    for (const [type, weight] of Object.entries(storedWeights)) {
        weights[type] = weight;
    }

    console.log(
        "[ADAPTIVE] Weights initialized:",
        weights
    );
};

export const getWeight = (detectionType) => {
    return weights[detectionType] ?? null;
};

export const setWeight = async (
    detectionType,
    weight
) => {
    weights[detectionType] = weight;

    await saveWeight(
        detectionType,
        weight
    );
};

export const getAllWeights = () => {
    return { ...weights };
};