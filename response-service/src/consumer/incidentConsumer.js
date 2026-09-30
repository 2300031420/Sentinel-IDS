import redis from "../config/redis.js";
import { shouldMitigate } from "../response/responseEngine.js";
import { blockIp } from "../response/blocklist.js";
const INCIDENT_STREAM =
    process.env.INCIDENT_STREAM || "ids:incidents";

const GROUP_NAME =
    process.env.REDIS_GROUP || "response-service-group";

const CONSUMER_NAME =
    process.env.REDIS_CONSUMER || "response-service-1";

const ensureConsumerGroup = async () => {
    try {
        await redis.xgroup(
            "CREATE",
            INCIDENT_STREAM,
            GROUP_NAME,
            "0",
            "MKSTREAM"
        );

        console.log(
            `[RESPONSE] Consumer group created: ${GROUP_NAME}`
        );
    } catch (error) {
        if (!error.message.includes("BUSYGROUP")) {
            throw error;
        }

        console.log(
            `[RESPONSE] Consumer group already exists: ${GROUP_NAME}`
        );
    }
};

export const startIncidentConsumer = async () => {
    await ensureConsumerGroup();

    console.log(
        `[RESPONSE] Listening to ${INCIDENT_STREAM}`
    );

    while (true) {
        try {
            const result = await redis.xreadgroup(
                "GROUP",
                GROUP_NAME,
                CONSUMER_NAME,
                "BLOCK",
                5000,
                "COUNT",
                10,
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
                        await redis.xack(
                            INCIDENT_STREAM,
                            GROUP_NAME,
                            messageId
                        );

                        continue;
                    }

                    let incident;

                    try {
                        incident = JSON.parse(
                            fields[incidentIndex + 1]
                        );
                    } catch (error) {
                        console.error(
                            `[RESPONSE] Invalid incident JSON ${messageId}:`,
                            error.message
                        );

                        await redis.xack(
                            INCIDENT_STREAM,
                            GROUP_NAME,
                            messageId
                        );

                        continue;
                    }

                    console.log(
                        "[RESPONSE] Incident received:",
                        incident
                    );
                    const mitigationRequired =
                        shouldMitigate(incident);

                    console.log(
                        "[RESPONSE] Mitigation required:",
                        mitigationRequired
                    );

                    if (mitigationRequired) {
                        const detectionType =
                            incident.detections?.[0]?.type || "UNKNOWN";

                        const blocked =
                            await blockIp(
                                incident.sourceIp,
                                detectionType
                            );
                        console.log(
                            "[RESPONSE] Block result:",
                            blocked
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
                "[RESPONSE] Consumer error:",
                error.message
            );
        }
    }
};