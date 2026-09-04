import redis from "../config/redis.js";

import { createIncident } from "../services/incidentService.js";

const THREAT_STREAM =
    process.env.THREAT_STREAM || "ids:threats";

const GROUP_NAME =
    process.env.REDIS_GROUP || "incident-service-group";

const CONSUMER_NAME =
    process.env.REDIS_CONSUMER || "incident-service-1";

const createConsumerGroup = async () => {
    try {
        await redis.xgroup(
            "CREATE",
            THREAT_STREAM,
            GROUP_NAME,
            "0",
            "MKSTREAM"
        );

        console.log(
            `[INCIDENT] Consumer group "${GROUP_NAME}" created`
        );
    } catch (error) {
        if (error.message.includes("BUSYGROUP")) {
            console.log(
                `[INCIDENT] Consumer group "${GROUP_NAME}" already exists`
            );
        } else {
            throw error;
        }
    }
};

export const startThreatConsumer = async () => {
    await createConsumerGroup();

    console.log(
        `[INCIDENT] Listening to ${THREAT_STREAM}`
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
                THREAT_STREAM,
                ">"
            );

            if (!result) {
                continue;
            }

            for (const [, messages] of result) {
                for (const [messageId, fields] of messages) {

                    const threatIndex =
                        fields.indexOf("threat");

                    if (threatIndex === -1) {
                        continue;
                    }

                    let threat;

                    try {
                        threat = JSON.parse(fields[threatIndex + 1]);
                    } catch (error) {
                        console.error(
                            `[INCIDENT] Invalid threat JSON for message ${messageId}:`,
                            error.message
                        );

                        // Acknowledge malformed messages so they don't
                        // remain pending and repeatedly crash the consumer.
                        await redis.xack(
                            THREAT_STREAM,
                            GROUP_NAME,
                            messageId
                        );

                        continue;
                    }

                    console.log(
                        "\n[INCIDENT] Threat received:",
                        threat
                    );

                    /*
                     * Only persist actual threats.
                     */
                    if (
                        threat.detected === true &&
                        threat.score > 0
                    ) {
                        await createIncident(threat);
                    } else {
                        console.log(
                            "[INCIDENT] No incident created"
                        );
                    }

                    await redis.xack(
                        THREAT_STREAM,
                        GROUP_NAME,
                        messageId
                    );
                }
            }
        } catch (error) {
            console.error(
                "[INCIDENT] Consumer error:",
                error.message
            );
        }
    }
};