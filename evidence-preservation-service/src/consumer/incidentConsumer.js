import redis from "../config/redis.js";
import {
    shouldPreserveEvidence,
    buildEvidencePackage
} from "../evidence/evidenceBuilder.js";
import { publishEvidence } from "../publisher/evidencePublisher.js";
const INCIDENT_STREAM =
    process.env.INCIDENT_STREAM || "ids:incidents";

const REDIS_GROUP =
    process.env.REDIS_GROUP || "evidence-preservation-group";

const REDIS_CONSUMER =
    process.env.REDIS_CONSUMER || "evidence-service-1";

const ensureConsumerGroup = async () => {
    try {
        await redis.xgroup(
            "CREATE",
            INCIDENT_STREAM,
            REDIS_GROUP,
            "0",
            "MKSTREAM"
        );

        console.log(
            `[EVIDENCE] Consumer group created: ${REDIS_GROUP}`
        );
    } catch (error) {
        if (!error.message.includes("BUSYGROUP")) {
            throw error;
        }

        console.log(
            `[EVIDENCE] Consumer group already exists: ${REDIS_GROUP}`
        );
    }
};

export const startIncidentConsumer = async () => {
    await ensureConsumerGroup();

    console.log(
        `[EVIDENCE] Listening to ${INCIDENT_STREAM}`
    );

    while (true) {
        try {
            const result = await redis.xreadgroup(
                "GROUP",
                REDIS_GROUP,
                REDIS_CONSUMER,
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
                    const incidentIndex = fields.indexOf("incident");

                    if (incidentIndex === -1) {
                        await redis.xack(
                            INCIDENT_STREAM,
                            REDIS_GROUP,
                            messageId
                        );

                        continue;
                    }

                    const incident = JSON.parse(
                        fields[incidentIndex + 1]
                    );

                    console.log(
                        "[EVIDENCE] Incident received:",
                        incident
                    );
                    if (shouldPreserveEvidence(incident)) {
                        const evidence = buildEvidencePackage(incident);

                        console.log(
                            "[EVIDENCE] Evidence preservation triggered:"
                        );

                        console.log(
                            JSON.stringify(evidence, null, 2)
                        );
                        await publishEvidence(evidence);
                    }

                    await redis.xack(
                        INCIDENT_STREAM,
                        REDIS_GROUP,
                        messageId
                    );
                }
            }
        } catch (error) {
            console.error(
                "[EVIDENCE] Consumer error:",
                error
            );
        }
    }
};