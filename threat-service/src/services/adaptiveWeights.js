import redis from "../config/redis.js";

const WEIGHT_KEY = "adaptive:weights";

export const getAdaptiveWeights = async () => {
    const storedWeights = await redis.hgetall(
        WEIGHT_KEY
    );

    const weights = {};

    for (const [type, value] of Object.entries(storedWeights)) {
        weights[type] = Number(value);
    }

    return weights;
};