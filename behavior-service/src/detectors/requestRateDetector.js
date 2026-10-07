import redis from "../config/redis.js";

const WINDOW_SECONDS = 60;
const REQUEST_THRESHOLD = 100;

const DETECTION_COOLDOWN_SECONDS = 60;

export const detectRequestRate = async (event) => {
    const sourceIp = event.sourceIp;

    const requestKey =
        `behavior:requests:${sourceIp}`;

    const detectionKey =
        `behavior:detected:${sourceIp}:HIGH_REQUEST_RATE`;

    const count =
        await redis.incr(requestKey);

    if (count === 1) {
        await redis.expire(
            requestKey,
            WINDOW_SECONDS
        );
    }

    /*
     * Request-rate threshold has not been crossed yet.
     */
    if (count <= REQUEST_THRESHOLD) {
        return {
            detected: false,
            type: null,
            severity: null,
            score: 0,
            description: null,
            evidence: null
        };
    }

    /*
     * Prevent repeated HIGH_REQUEST_RATE detections
     * for the same IP during the current cooldown.
     *
     * NX makes this atomic, so concurrent requests
     * cannot all create a detection.
     */
    const detectionCreated =
        await redis.set(
            detectionKey,
            "1",
            "EX",
            DETECTION_COOLDOWN_SECONDS,
            "NX"
        );

    /*
     * Detection already generated for this
     * high-rate activity.
     */
    if (detectionCreated !== "OK") {
        return {
            detected: false,
            type: null,
            severity: null,
            score: 0,
            description: null,
            evidence: null
        };
    }

    /*
     * First request that crosses the threshold.
     */
    return {
        detected: true,
        type: "HIGH_REQUEST_RATE",
        severity: "HIGH",
        score: 30,
        description:
            "Unusually high request rate detected",
        evidence: {
            sourceIp,
            requests: count,
            windowSeconds: WINDOW_SECONDS
        }
    };
};