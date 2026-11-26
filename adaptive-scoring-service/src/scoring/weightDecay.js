import {
    getAllWeights,
    setWeight
} from "./weightStore.js";

import { decayWeight } from "./weightModel.js";

const DECAY_INTERVAL_MS = 5 * 60 * 1000;

export const runWeightDecay = async () => {
    const weights = getAllWeights();

    for (const [detectionType, currentWeight] of Object.entries(weights)) {
        const newWeight = decayWeight(
            detectionType,
            currentWeight
        );

        if (newWeight !== currentWeight) {
            await setWeight(
                detectionType,
                newWeight
            );

            console.log(
                `[ADAPTIVE] Weight decayed: ${detectionType} ${currentWeight} → ${newWeight}`
            );
        }
    }
};

export const startWeightDecay = () => {
    console.log(
        `[ADAPTIVE] Weight decay enabled: every ${DECAY_INTERVAL_MS / 1000}s`
    );

    setInterval(async () => {
        try {
            await runWeightDecay();
        } catch (error) {
            console.error(
                "[ADAPTIVE] Weight decay error:",
                error.message
            );
        }
    }, DECAY_INTERVAL_MS);
};