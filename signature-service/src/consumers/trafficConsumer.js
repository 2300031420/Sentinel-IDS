import redis from "../config/redis.js";
import { analyzeRequest } from "../engine/detectionEngine.js";
import { publishDetectionResults } from "../service/detectionPublisher.js";
const STREAM_NAME = process.env.REDIS_STREAM || "ids:traffic";
const GROUP_NAME =
    process.env.REDIS_GROUP || "signature-detection-group";
const CONSUMER_NAME =
    process.env.REDIS_CONSUMER || "signature-service-1";

const createConsumerGroup = async () => {
    try {
        await redis.xgroup(
            "CREATE",
            STREAM_NAME,
            GROUP_NAME,
            "0",
            "MKSTREAM"
        );

        console.log(
            `[SIGNATURE] Consumer group "${GROUP_NAME}" created`
        );
    } catch (error) {
        if (error.message.includes("BUSYGROUP")) {
            console.log(
                `[SIGNATURE] Consumer group "${GROUP_NAME}" already exists`
            );
        } else {
            throw error;
        }
    }
};

export const startTrafficConsumer = async () => {
    await createConsumerGroup();

    console.log(
        `[SIGNATURE] Listening to ${STREAM_NAME}`
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
                STREAM_NAME,
                ">"
            );

            if (!result) {
                continue;
            }

            for (const [, messages] of result) {
                for (const [messageId, fields] of messages) {
                    const eventIndex = fields.indexOf("event");

                    if (eventIndex === -1) {
                        continue;
                    }

                    const event = JSON.parse(
                        fields[eventIndex + 1]
                    );

                    const detections = analyzeRequest(event);
                    

                    console.log(
                        "\n[SIGNATURE] Request:",
                        event.requestId
                    );

                    if (detections.length === 0) {
                        console.log(
                            "[SIGNATURE] No signature detected"
                        );
                    } else {
                        console.log(
                            "[SIGNATURE] THREATS DETECTED:",
                            detections
                        );
                    }
                    await publishDetectionResults({
                        event,
                        detections
                    });

                    await redis.xack(
                        STREAM_NAME,
                        GROUP_NAME,
                        messageId
                    );
                }
            }
        } catch (error) {
            console.error(
                "[SIGNATURE] Consumer error:",
                error.message
            );
        }
    }
};