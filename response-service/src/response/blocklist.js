import redis from "../config/redis.js";

const BLOCK_TTL_SECONDS = 600;
const BLOCK_KEY_PREFIX = "ids:block:";

const getBlockKey = (sourceIp) =>
    `${BLOCK_KEY_PREFIX}${sourceIp}`;

export const blockIp = async (
    sourceIp,
    {
        detectionType = "UNKNOWN",
        requestId = null,
        activityId = null,
        incidentId = null
    } = {}
) => {
    if (!sourceIp) {
        return false;
    }

    const key = getBlockKey(sourceIp);

    const blockData = {
        detectionType,
        requestId,
        activityId,
        incidentId,
        blockedAt: new Date().toISOString()
    };

    await redis.set(
        key,
        JSON.stringify(blockData),
        "EX",
        BLOCK_TTL_SECONDS
    );

    console.log(
        `[RESPONSE] IP blocked: ${sourceIp} | Reason: ${detectionType} | Activity: ${activityId} | Incident: ${incidentId} | TTL: ${BLOCK_TTL_SECONDS}s`
    );

    return true;
};

export const getBlockReason = async (sourceIp) => {
    if (!sourceIp) {
        return null;
    }

    const key = getBlockKey(sourceIp);

    const value = await redis.get(key);

    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return {
            detectionType: value,
            requestId: null,
            activityId: null,
            incidentId: null
        };
    }
};

export const isIpBlocked = async (sourceIp) => {
    if (!sourceIp) {
        return false;
    }

    const key = getBlockKey(sourceIp);

    return (await redis.exists(key)) === 1;
};

export const unblockIp = async (sourceIp) => {
    if (!sourceIp) {
        return false;
    }

    const key = getBlockKey(sourceIp);

    await redis.del(key);

    console.log(
        `[RESPONSE] IP unblocked: ${sourceIp}`
    );

    return true;
};