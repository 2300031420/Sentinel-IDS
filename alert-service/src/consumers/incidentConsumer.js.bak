import redis from "../config/redis.js";

import {
    processIncident
} from "../services/alertServices.js";

const INCIDENT_STREAM =
    process.env.INCIDENT_STREAM || "ids:incidents";

const GROUP_NAME =
    process.env.REDIS_GROUP || "alert-service-group";

const CONSUMER_NAME =
    process.env.REDIS_CONSUMER || "alert-service-1";

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

export const startIncidentConsumer = async (io) => {
    await createConsumerGroup();

    console.log(
        `[ALERT] Listening to ${INCIDENT_STREAM}`
    );

    while (true) {
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
                INCIDENT_STREAM,
                ">"
            );

            if (!result) {
                continue;
            }

            for (const [, messages] of result) {
                for (const [messageId, fields] of messages) {

                    const incidentIndex =
                        fields.indexOf("incident");

                    if (incidentIndex === -1) {
                        continue;
                    }

                    const incident =
                        JSON.parse(
                            fields[incidentIndex + 1]
                        );

                    console.log(
                        "\n[ALERT] Incident received:",
                        incident
                    );

                    const alertResult = await processIncident(
                        incident
                    );

                    if (alertResult.alertRequired && alertResult.alertId) {

                        io.emit("new-alert", {
                            alert: alertResult
                        });

                        console.log(
                            `[ALERT WS] New alert emitted for ${alertResult.alertId}`
                        );
                    }

                    await redis.xack(
                        INCIDENT_STREAM,
                        GROUP_NAME,
                        messageId
                    );
                }
            }
        } catch (error) {
            console.error(
                "[ALERT] Consumer error:",
                error.message
            );
        }
    }
};