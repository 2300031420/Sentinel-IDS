import redis from "../config/redis.js";

const WEIGHT_KEY = "adaptive:weights";

export const loadWeights = async () => {
    const storedWeights = await redis.hgetall(WEIGHT_KEY);

    const weights = {};

    for (const [type, value] of Object.entries(storedWeights)) {
        weights[type] = Number(value);
    }

    return weights;
};

export const saveWeight = async (
    detectionType,
    weight
) => {
    await redis.hset(
        WEIGHT_KEY,
        detectionType,
        weight
    );

    console.log(
        `[ADAPTIVE] Weight persisted: ${detectionType}=${weight}`
    );
};