import redis from "../config/redis.js";

const WINDOW_SECONDS = 60;
const REQUEST_THRESHOLD = 100;

export const detectRequestRate = async (event) => {
    const key = `behavior:requests:${event.sourceIp}`;

    const count = await redis.incr(key);

    if (count === 1) {
        await redis.expire(
            key,
            WINDOW_SECONDS
        );
    }

    if (count > REQUEST_THRESHOLD) {
        return {
            detected: true,
            type: "HIGH_REQUEST_RATE",
            severity: "HIGH",
            score: 30,
            description:
                "Unusually high request rate detected",
            evidence: {
                sourceIp: event.sourceIp,
                requests: count,
                windowSeconds: WINDOW_SECONDS
            }
        };
    }

    return {
        detected: false,
        type: null,
        severity: null,
        score: 0,
        description: null,
        evidence: null
    };
};