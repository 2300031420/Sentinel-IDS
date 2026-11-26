
import redis from "../config/redis.js";
import { processIncident } from "../services/alertServices.js";

const INCIDENT_STREAM =
    process.env.INCIDENT_STREAM || "ids:incidents";

const GROUP_NAME =
    process.env.REDIS_GROUP || "alert-service-group";

const CONSUMER_NAME =
    process.env.REDIS_CONSUMER || "alert-service-1";

const CLAIM_IDLE_MS = 60_000;
const CLAIM_COUNT = 10;
const READ_COUNT = 10;
const BLOCK_MS = 5_000;

const createConsumerGroup = async () => {
    try {
        await redis.xgroup(
            "CREATE",
            INCIDENT_STREAM,
            GROUP_NAME,
            "0",
            "MKSTREAM"
        );

        console.log(
            `[ALERT] Consumer group "${GROUP_NAME}" created`
        );
    } catch (error) {
        if (error.message.includes("BUSYGROUP")) {
            console.log(
                `[ALERT] Consumer group "${GROUP_NAME}" already exists`
            );
        } else {
            throw error;
        }
    }
};

const acknowledge = async (messageId) => {
    await redis.xack(
        INCIDENT_STREAM,
        GROUP_NAME,
        messageId
    );
};

const processMessage = async (messageId, fields, io) => {
    const incidentIndex = fields.indexOf("incident");

    // Poison messages must not remain pending forever.
    if (
        incidentIndex === -1 ||
        typeof fields[incidentIndex + 1] !== "string"
    ) {
        console.error(
            `[ALERT] Malformed message ${messageId}: missing incident field`
        );
        await acknowledge(messageId);
        return;
    }

    let incident;

    try {
        incident = JSON.parse(fields[incidentIndex + 1]);

        if (
            !incident ||
            typeof incident !== "object" ||
            !incident.incidentId
        ) {
            throw new Error("Invalid incident payload");
        }
    } catch (error) {
        console.error(
            `[ALERT] Invalid incident payload in ${messageId}:`,
            error.message
        );
        await acknowledge(messageId);
        return;
    }

    console.log(`[ALERT] Processing incident ${incident.incidentId}`);

    const alertResult = await processIncident(incident);

    // processIncident can return ALERT_FAILED instead of throwing.
if (
    alertResult?.status === "ALERT_FAILED" ||
    alertResult?.status === "ALERT_ALREADY_CLAIMED"
) {
    console.warn(
        `[ALERT] ${alertResult.status} for ${incident.incidentId}; leaving ${messageId} pending`
    );
    return;
}

    if (alertResult?.alertRequired && alertResult.alertId) {
        io.emit("new-alert", { alert: alertResult });

        console.log(
            `[ALERT WS] New alert emitted for ${alertResult.alertId}`
        );
    }

    await acknowledge(messageId);
};

const processMessages = async (messages, io) => {
    for (const [messageId, fields] of messages) {
        try {
            await processMessage(messageId, fields, io);
        } catch (error) {
            // Leave the message pending so a later recovery can retry it.
            console.error(
                `[ALERT] Message ${messageId} failed; leaving pending:`,
                error.message
            );
        }
    }
};

const reclaimPendingMessages = async (io) => {
    let startId = "0-0";

    do {
        const result = await redis.xautoclaim(
            INCIDENT_STREAM,
            GROUP_NAME,
            CONSUMER_NAME,
            CLAIM_IDLE_MS,
            startId,
            "COUNT",
            CLAIM_COUNT
        );

        const [nextStartId, messages] = result;

        if (messages.length > 0) {
            console.log(
                `[ALERT] Reclaimed ${messages.length} pending message(s)`
            );

            await processMessages(messages, io);
        }

        startId = nextStartId;
    } while (startId !== "0-0");
};

export const startIncidentConsumer = async (io) => {
    await createConsumerGroup();

    console.log(`[ALERT] Listening to ${INCIDENT_STREAM}`);

    while (true) {
        try {
            await reclaimPendingMessages(io);

            const result = await redis.xreadgroup(
                "GROUP",
                GROUP_NAME,
                CONSUMER_NAME,
                "COUNT",
                READ_COUNT,
                "BLOCK",
                BLOCK_MS,
                "STREAMS",
                INCIDENT_STREAM,
                ">"
            );

            if (!result) {
                continue;
            }

            for (const [, messages] of result) {
                await processMessages(messages, io);
            }
        } catch (error) {
            console.error(
                "[ALERT] Consumer loop error:",
                error.message
            );

            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
};