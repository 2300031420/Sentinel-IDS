import redis from "../config/redis.js";
import { saveEvidence } from "../storage/evidenceStorage.js";

const EVIDENCE_STREAM =
    process.env.EVIDENCE_STREAM || "ids:evidence";

const REDIS_GROUP =
    process.env.EVIDENCE_STORAGE_GROUP ||
    "evidence-storage-group";

const REDIS_CONSUMER =
    process.env.EVIDENCE_STORAGE_CONSUMER ||
    "evidence-storage-1";

const ensureConsumerGroup = async () => {
    try {
        await redis.xgroup(
            "CREATE",
            EVIDENCE_STREAM,
            REDIS_GROUP,
            "0",
            "MKSTREAM"
        );

        console.log(
            `[EVIDENCE STORAGE] Consumer group created: ${REDIS_GROUP}`
        );
    } catch (error) {
        if (!error.message.includes("BUSYGROUP")) {
            throw error;
        }

        console.log(
            `[EVIDENCE STORAGE] Consumer group already exists: ${REDIS_GROUP}`
        );
    }
};

export const startEvidenceConsumer = async () => {
    await ensureConsumerGroup();

    console.log(
        `[EVIDENCE STORAGE] Listening to ${EVIDENCE_STREAM}`
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
                EVIDENCE_STREAM,
                ">"
            );

            if (!result) {
                continue;
            }

            for (const [, messages] of result) {
                for (const [messageId, fields] of messages) {
                    const evidenceIndex =
                        fields.indexOf("evidence");

                    if (evidenceIndex === -1) {
                        await redis.xack(
                            EVIDENCE_STREAM,
                            REDIS_GROUP,
                            messageId
                        );

                        continue;
                    }

                    const evidence = JSON.parse(
                        fields[evidenceIndex + 1]
                    );

                    console.log(
                        "[EVIDENCE STORAGE] Evidence received:",
                        evidence.evidenceId
                    );

                    await saveEvidence(evidence);

                    await redis.xack(
                        EVIDENCE_STREAM,
                        REDIS_GROUP,
                        messageId
                    );

                    console.log(
                        `[EVIDENCE STORAGE] Evidence acknowledged: ${messageId}`
                    );
                }
            }
        } catch (error) {
            console.error(
                "[EVIDENCE STORAGE] Consumer error:",
                error
            );
        }
    }
};