import { getDefaultWeights } from "./weightModel.js";
import { loadWeights, saveWeight } from "./weightPersistence.js";

const MIN_WEIGHT = 0;
const MAX_WEIGHT = 100;

const weights = getDefaultWeights();

export const initializeWeights = async () => {
    const storedWeights = await loadWeights();

    for (const [type, weight] of Object.entries(storedWeights)) {
        const numericWeight = Number(weight);

        if (!Number.isFinite(numericWeight)) {
            console.warn(
                `[ADAPTIVE] Ignoring invalid stored weight for ${type}: ${weight}`
            );

            continue;
        }

        const safeWeight = Math.min(
            MAX_WEIGHT,
            Math.max(
                MIN_WEIGHT,
                numericWeight
            )
        );

        if (safeWeight !== numericWeight) {
            console.warn(
                `[ADAPTIVE] Clamped stored weight for ${type}: ${numericWeight} → ${safeWeight}`
            );
        }

        weights[type] = safeWeight;
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
    const numericWeight = Number(weight);

    if (!Number.isFinite(numericWeight)) {
        console.warn(
            `[ADAPTIVE] Rejected invalid weight for ${detectionType}: ${weight}`
        );

        return false;
    }

    const safeWeight = Math.min(
        MAX_WEIGHT,
        Math.max(
            MIN_WEIGHT,
            numericWeight
        )
    );

    if (safeWeight !== numericWeight) {
        console.warn(
            `[ADAPTIVE] Clamped weight for ${detectionType}: ${numericWeight} → ${safeWeight}`
        );
    }

    weights[detectionType] = safeWeight;

    await saveWeight(
        detectionType,
        safeWeight
    );

    return true;
};

export const getAllWeights = () => {
    return { ...weights };
};