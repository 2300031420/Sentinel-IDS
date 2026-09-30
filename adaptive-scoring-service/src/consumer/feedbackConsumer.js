import redis from "../config/redis.js";

import {
    FEEDBACK_STREAM,
    FEEDBACK_GROUP,
    FEEDBACK_CONSUMER
} from "../config/feedbackConfig.js";

import { handleFeedback } from "../feedback/feedbackHandler.js";

const ensureConsumerGroup = async () => {
    try {
        await redis.xgroup(
            "CREATE",
            FEEDBACK_STREAM,
            FEEDBACK_GROUP,
            "0",
            "MKSTREAM"
        );

        console.log(
            `[ADAPTIVE] Feedback consumer group created: ${FEEDBACK_GROUP}`
        );
    } catch (error) {
        if (!error.message.includes("BUSYGROUP")) {
            throw error;
        }

        console.log(
            `[ADAPTIVE] Feedback consumer group already exists: ${FEEDBACK_GROUP}`
        );
    }
};

export const startFeedbackConsumer = async () => {
    await ensureConsumerGroup();

    console.log(
        `[ADAPTIVE] Listening to ${FEEDBACK_STREAM}`
    );

    while (true) {
        try {
            const result = await redis.xreadgroup(
                "GROUP",
                FEEDBACK_GROUP,
                FEEDBACK_CONSUMER,
                "BLOCK",
                5000,
                "COUNT",
                10,
                "STREAMS",
                FEEDBACK_STREAM,
                ">"
            );

            if (!result) {
                continue;
            }

            for (const [, messages] of result) {
                for (const [messageId, fields] of messages) {
                    const feedbackIndex =
                        fields.indexOf("feedback");

                    if (feedbackIndex === -1) {
                        await redis.xack(
                            FEEDBACK_STREAM,
                            FEEDBACK_GROUP,
                            messageId
                        );

                        continue;
                    }

                    const feedback = JSON.parse(
                        fields[feedbackIndex + 1]
                    );

                    console.log(
                        "[ADAPTIVE] Feedback received:",
                        feedback
                    );

                    const result = await handleFeedback({
                        detectionType: feedback.detectionType,
                        responseStatus: feedback.responseStatus
                    });

                    console.log(
                        "[ADAPTIVE] Weight update:",
                        result
                    );

                    await redis.xack(
                        FEEDBACK_STREAM,
                        FEEDBACK_GROUP,
                        messageId
                    );
                }
            }
        } catch (error) {
            console.error(
                "[ADAPTIVE] Feedback consumer error:",
                error
            );
        }
    }
};