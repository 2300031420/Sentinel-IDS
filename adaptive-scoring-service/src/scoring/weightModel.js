const DEFAULT_WEIGHTS = {
    SQL_INJECTION: 40,
    XSS: 35,
    PATH_TRAVERSAL: 30,
    COMMAND_INJECTION: 35,
    HIGH_REQUEST_RATE: 30
};

const MIN_WEIGHT = 10;
const MAX_WEIGHT = 60;
const DECAY_STEP = 1;

export const getDefaultWeights = () => ({
    ...DEFAULT_WEIGHTS
});

export const clampWeight = (weight) =>
    Math.min(
        MAX_WEIGHT,
        Math.max(MIN_WEIGHT, weight)
    );

export const adjustWeight = (
    currentWeight,
    adjustment
) => {
    return clampWeight(
        currentWeight + adjustment
    );
};

export const decayWeight = (
    detectionType,
    currentWeight
) => {
    const defaultWeight =
        DEFAULT_WEIGHTS[detectionType];

    if (defaultWeight === undefined) {
        return currentWeight;
    }

    if (currentWeight > defaultWeight) {
        return clampWeight(
            currentWeight - DECAY_STEP
        );
    }

    return currentWeight;
};