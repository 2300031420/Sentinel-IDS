
import redis from "../config/redis.js";
import { calculateThreatScore } from "../services/threatScorer.js";
import { getAdaptiveWeights } from "../services/adaptiveWeights.js";
import {
    addDetection,
    removeDetection
} from "../services/detectionAggregator.js";
import { createHash } from "node:crypto";

const DETECTION_STREAM =
    process.env.DETECTION_STREAM || "ids:detections";

const THREAT_STREAM =
    process.env.THREAT_STREAM || "ids:threats";

const GROUP_NAME =
    process.env.REDIS_GROUP || "threat-scoring-group";

const CONSUMER_NAME =
    process.env.REDIS_CONSUMER || "threat-service-1";

const WINDOW_MS = 2000;
const RECOVERY_IDLE_MS = 10000;
const RECOVERY_INTERVAL_MS = 5000;
const RECOVERY_BATCH_SIZE = 10;

const finalizing = new Map();
const timers = new Map();
const pendingMessages = new Map();
const deferredMessages = new Map();

let stopping = false;
let recoveryTimer = null;
let recoveryInProgress = false;

const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

const FINALIZE_THREAT_SCRIPT = `
local detected = ARGV[2] == "1"
local threatJson = ARGV[3]
local messageCount = tonumber(ARGV[4])

if not messageCount or messageCount < 1 then
    return redis.error_reply("INVALID_MESSAGE_COUNT")
end

if detected and redis.call("EXISTS", KEYS[2]) == 0 then
    redis.call("XADD", KEYS[1], "*", "threat", threatJson)
    redis.call("SET", KEYS[2], "1")
end

for i = 1, messageCount do
    redis.call("XACK", KEYS[3], ARGV[1], ARGV[4 + i])
end

return 1
`;

const createConsumerGroup = async () => {
    try {
        await redis.xgroup(
            "CREATE",
            DETECTION_STREAM,
            GROUP_NAME,
            "0",
            "MKSTREAM"
        );

        console.log(
            `[THREAT] Consumer group "${GROUP_NAME}" created`
        );
    } catch (error) {
        if (error.message?.includes("BUSYGROUP")) {
            console.log(
                `[THREAT] Consumer group "${GROUP_NAME}" already exists`
            );
            return;
        }

        throw error;
    }
};

const publishAndAcknowledge = async (threat, messageIds) => {
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
        throw new Error("NO_SOURCE_MESSAGES_TO_ACKNOWLEDGE");
    }

    // Stable key for retries of the exact same source-message batch.
    const batchIdentity = [
        DETECTION_STREAM,
        GROUP_NAME,
        ...messageIds.slice().sort()
    ].join("|");

    const batchHash = createHash("sha256")
        .update(batchIdentity)
        .digest("hex");

    const idempotencyKey = `ids:threat-published:${batchHash}`;

    const result = await redis.eval(
        FINALIZE_THREAT_SCRIPT,
        3,
        THREAT_STREAM,
        idempotencyKey,
        DETECTION_STREAM,
        GROUP_NAME,
        threat.detected ? "1" : "0",
        JSON.stringify(threat),
        String(messageIds.length),
        ...messageIds
    );

    if (result !== 1) {
        throw new Error("ATOMIC_FINALIZATION_FAILED");
    }

    if (threat.detected) {
        console.log(
            `[THREAT BUS] Finalized ${threat.requestId} | Host: ${threat.hostId}`
        );
    } else {
        console.log(
            `[THREAT] No threat detected for ${threat.requestId}`
        );
    }
};

const parseDetectionEvent = (fields) => {
    const detectionIndex = fields.indexOf("detection");

    if (
        detectionIndex < 0 ||
        typeof fields[detectionIndex + 1] !== "string"
    ) {
        return null;
    }

    let event;

    try {
        event = JSON.parse(fields[detectionIndex + 1]);
    } catch {
        return null;
    }

    if (
        !event ||
        typeof event !== "object" ||
        Array.isArray(event) ||
        typeof event.requestId !== "string" ||
        !event.requestId.trim() ||
        event.requestId.length > 200 ||
        !Array.isArray(event.detections)
    ) {
        return null;
    }

    return event;
};

/*
 * Buffer messages independently while a request is finalizing.
 * Do not mutate the current batch or shared detection aggregation
 * until the active batch has succeeded.
 */
const bufferDetection = (event, messageId) => {
    const requestId = event.requestId;

    if (finalizing.has(requestId)) {
        let deferred = deferredMessages.get(requestId);

        if (!deferred) {
            deferred = {
                messages: [],
                messageIds: new Set()
            };

            deferredMessages.set(requestId, deferred);
        }

        if (!deferred.messageIds.has(messageId)) {
            deferred.messageIds.add(messageId);
            deferred.messages.push({ event, messageId });
        }

        return;
    }

    const aggregated = addDetection(event);

    if (!aggregated) {
        throw new Error("DETECTION_AGGREGATION_FAILED");
    }

    if (!pendingMessages.has(requestId)) {
        pendingMessages.set(requestId, {
            ...aggregated,
            messages: [],
            messageIds: new Set()
        });
    }

    const pending = pendingMessages.get(requestId);

    pending.correlationId = aggregated.correlationId;
    pending.activityId = aggregated.activityId;
    pending.correlationScore = aggregated.correlationScore;
    pending.confidence = aggregated.confidence;
    pending.hostId = aggregated.hostId || pending.hostId;
    pending.sourceIp = aggregated.sourceIp || pending.sourceIp;
    pending.method = aggregated.method || pending.method;
    pending.path = aggregated.path || pending.path;

    if (
        aggregated.timestamp &&
        (
            !pending.timestamp ||
            new Date(aggregated.timestamp).getTime() <
                new Date(pending.timestamp).getTime()
        )
    ) {
        pending.timestamp = aggregated.timestamp;
    }

    if (!pending.messageIds.has(messageId)) {
        pending.messageIds.add(messageId);
        pending.messages.push(messageId);
    }

    if (timers.has(requestId)) {
        clearTimeout(timers.get(requestId));
    }

    const timer = setTimeout(() => {
        timers.delete(requestId);
        void finalizeDetection(requestId);
    }, WINDOW_MS);

    timers.set(requestId, timer);
};

/*
 * Finalize a request once at a time.
 *
 * finalizeDetectionOnce returns true only when the batch was completed.
 * On failure, deferred messages stay deferred until a retry succeeds.
 */
const finalizeDetection = (requestId) => {
    const existing = finalizing.get(requestId);

    if (existing) {
        return existing;
    }

    const task = finalizeDetectionOnce(requestId);

    const trackedTask = task
        .then((succeeded) => {
            if (succeeded && !stopping) {
                replayDeferredMessages(requestId);
            }

            return succeeded;
        })
        .catch((error) => {
            // Keep an unexpected failure from becoming an unhandled
            // rejection. The source messages remain in Redis pending.
            console.error(
                `[THREAT] Unexpected finalization failure for ${requestId}:`,
                error.code || "FINALIZATION_ERROR"
            );

            return false;
        })
        .finally(() => {
            finalizing.delete(requestId);
        });

    finalizing.set(requestId, trackedTask);

    return trackedTask;
};

/*
 * Move deferred messages into a fresh batch after successful
 * finalization. During shutdown, leave them in Redis pending so
 * recovery can process them after restart.
 */
const replayDeferredMessages = (requestId) => {
    if (stopping || finalizing.has(requestId)) {
        return;
    }

    const deferred = deferredMessages.get(requestId);

    if (!deferred) {
        return;
    }

    deferredMessages.delete(requestId);

    for (const item of deferred.messages) {
        try {
            bufferDetection(item.event, item.messageId);
        } catch (error) {
            console.error(
                "[THREAT] Deferred message buffering failed:",
                error.code || "DEFERRED_BUFFER_ERROR"
            );

            // Put failed-to-buffer messages back into the deferred queue.
            let remaining = deferredMessages.get(requestId);

            if (!remaining) {
                remaining = {
                    messages: [],
                    messageIds: new Set()
                };

                deferredMessages.set(requestId, remaining);
            }

            if (!remaining.messageIds.has(item.messageId)) {
                remaining.messageIds.add(item.messageId);
                remaining.messages.push(item);
            }
        }
    }
};

/*
 * Snapshot message IDs and detections before the first await.
 * The current batch cannot be changed by newly arriving messages.
 */
const finalizeDetectionOnce = async (requestId) => {
    const pending = pendingMessages.get(requestId);

    if (!pending || pending.messages.length === 0) {
        return true;
    }

    const existingTimer = timers.get(requestId);

    if (existingTimer) {
        clearTimeout(existingTimer);
        timers.delete(requestId);
    }

    const messageIds = [...pending.messages];

    const detections = pending.detections.map(
        (detection) => ({ ...detection })
    );

    const snapshot = {
        requestId: pending.requestId,
        correlationId: pending.correlationId,
        activityId: pending.activityId,
        correlationScore: pending.correlationScore,
        confidence: pending.confidence,
        hostId: pending.hostId,
        timestamp: pending.timestamp,
        sourceIp: pending.sourceIp,
        method: pending.method,
        path: pending.path,
        detections
    };

    try {
        const adaptiveWeights = await getAdaptiveWeights();

        const result = calculateThreatScore(
            snapshot.detections,
            adaptiveWeights
        );

        const threat = {
            requestId: snapshot.requestId,
            correlationId: snapshot.correlationId,
            activityId: snapshot.activityId,
            correlationScore: snapshot.correlationScore,
            correlationConfidence: snapshot.confidence,
            hostId: snapshot.hostId,
            timestamp: snapshot.timestamp || new Date().toISOString(),
            sourceIp: snapshot.sourceIp,
            method: snapshot.method,
            path: snapshot.path,
            detected: snapshot.detections.length > 0,
            detections: snapshot.detections,
            score: result.score,
            severity: result.severity
        };

        await publishAndAcknowledge(threat, messageIds);

        // Only clear the aggregation after Redis finalization succeeds.
        pendingMessages.delete(requestId);
        removeDetection(requestId);

        return true;
    } catch (error) {
        console.error(
            `[THREAT] Finalization failed for ${requestId}:`,
            error.code || "FINALIZATION_ERROR"
        );

        // Preserve the original batch for retry. Do not replay deferred
        // messages into this batch until it has completed successfully.
        if (!stopping && pendingMessages.has(requestId)) {
            const timer = setTimeout(() => {
                timers.delete(requestId);
                void finalizeDetection(requestId);
            }, RECOVERY_INTERVAL_MS);

            timers.set(requestId, timer);
        }

        return false;
    }
};

/*
 * Recover source messages left in the Redis pending-entry list.
 */
const recoverPendingMessages = async () => {
    if (recoveryInProgress || stopping) {
        return;
    }

    recoveryInProgress = true;

    try {
        let cursor = "0-0";

        do {
            const result = await redis.xautoclaim(
                DETECTION_STREAM,
                GROUP_NAME,
                CONSUMER_NAME,
                RECOVERY_IDLE_MS,
                cursor,
                "COUNT",
                RECOVERY_BATCH_SIZE
            );

            cursor = result[0];

            const messages = result[1] || [];

            for (const [messageId, fields] of messages) {
                if (stopping) {
                    break;
                }

                const event = parseDetectionEvent(fields);

                if (!event) {
                    console.warn(
                        `[THREAT] Discarding invalid recovered message ${messageId}`
                    );

                    await redis.xack(
                        DETECTION_STREAM,
                        GROUP_NAME,
                        messageId
                    );

                    continue;
                }

                bufferDetection(event, messageId);
            }

            if (cursor === "0-0" || messages.length === 0) {
                break;
            }
        } while (!stopping);
    } catch (error) {
        console.error(
            "[THREAT] Pending-message recovery failed:",
            error.code || "RECOVERY_ERROR"
        );
    } finally {
        recoveryInProgress = false;
    }
};

export const startDetectionConsumer = async () => {
    await createConsumerGroup();

    console.log(
        `[THREAT] Listening to ${DETECTION_STREAM}`
    );

    await recoverPendingMessages();

    recoveryTimer = setInterval(() => {
        void recoverPendingMessages();
    }, RECOVERY_INTERVAL_MS);

    recoveryTimer.unref();

    while (!stopping) {
        try {
            const result = await redis.xreadgroup(
                "GROUP",
                GROUP_NAME,
                CONSUMER_NAME,
                "COUNT",
                10,
                "BLOCK",
                5000,
                "STREAMS",
                DETECTION_STREAM,
                ">"
            );

            if (!result) {
                continue;
            }

            for (const [, messages] of result) {
                for (const [messageId, fields] of messages) {
                    if (stopping) {
                        break;
                    }

                    const event = parseDetectionEvent(fields);

                    if (!event) {
                        console.warn(
                            `[THREAT] Discarding invalid message ${messageId}`
                        );

                        await redis.xack(
                            DETECTION_STREAM,
                            GROUP_NAME,
                            messageId
                        );

                        continue;
                    }

                    bufferDetection(event, messageId);
                }
            }
        } catch (error) {
            console.error(
                "[THREAT] Consumer read failed:",
                error.code || "CONSUMER_READ_ERROR"
            );

            if (!stopping) {
                await sleep(1000);
            }
        }
    }
};

/*
 * Stop reading new work and wait for in-flight finalization.
 * Unfinished Redis messages remain pending for recovery after restart.
 */
export const stopDetectionConsumer = async () => {
    if (stopping) {
        return;
    }

    stopping = true;

    if (recoveryTimer) {
        clearInterval(recoveryTimer);
        recoveryTimer = null;
    }

    for (const timer of timers.values()) {
        clearTimeout(timer);
    }

    timers.clear();

    // Include requests currently being finalized as well as buffered ones.
    const requestIds = new Set([
        ...pendingMessages.keys(),
        ...finalizing.keys()
    ]);

    await Promise.allSettled(
        [...requestIds].map((requestId) =>
            finalizeDetection(requestId)
        )
    );

    console.log("[THREAT] Consumer shutdown completed");
};
