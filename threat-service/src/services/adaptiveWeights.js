import redis from "../config/redis.js";

const WEIGHT_KEY = "adaptive:weights";

const MIN_WEIGHT = 0;
const MAX_WEIGHT = 100;

export const getAdaptiveWeights = async () => {
    const storedWeights =
        await redis.hgetall(WEIGHT_KEY);

    const weights = {};

    for (const [type, value] of Object.entries(storedWeights)) {
        const numericWeight = Number(value);

        if (!Number.isFinite(numericWeight)) {
            console.warn(
                `[ADAPTIVE] Ignoring invalid weight for ${type}: ${value}`
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
                `[ADAPTIVE] Clamped weight for ${type}: ${numericWeight} → ${safeWeight}`
            );
        }

        weights[type] = safeWeight;
    }

    return weights;
};

export const saveWeight = async (
    detectionType,
    weight
) => {
    const numericWeight = Number(weight);

    if (!Number.isFinite(numericWeight)) {
        throw new Error(
            `Invalid adaptive weight: ${weight}`
        );
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
            `[ADAPTIVE] Clamping persisted weight for ${detectionType}: ${numericWeight} → ${safeWeight}`
        );
    }

    await redis.hset(
        WEIGHT_KEY,
        detectionType,
        safeWeight
    );

    console.log(
        `[ADAPTIVE] Weight persisted: ${detectionType}=${safeWeight}`
    );
};