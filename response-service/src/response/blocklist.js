import redis from "../config/redis.js";

const BLOCK_TTL_SECONDS = 600;
const BLOCK_KEY_PREFIX = "ids:block:";

const getBlockKey = (sourceIp) =>
    `${BLOCK_KEY_PREFIX}${sourceIp}`;

export const blockIp = async (
    sourceIp,
    detectionType = "UNKNOWN"
) => {
    if (!sourceIp) {
        return false;
    }

    const key = getBlockKey(sourceIp);

    await redis.set(
        key,
        detectionType,
        "EX",
        BLOCK_TTL_SECONDS
    );

    console.log(
        `[RESPONSE] IP blocked: ${sourceIp} | Reason: ${detectionType} | TTL: ${BLOCK_TTL_SECONDS}s`
    );

    return true;
};

export const getBlockReason = async (sourceIp) => {
    if (!sourceIp) {
        return null;
    }

    const key = getBlockKey(sourceIp);

    return await redis.get(key);
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