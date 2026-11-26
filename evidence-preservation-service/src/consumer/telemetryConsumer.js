import redis from "../config/redis.js";

import {
    updateTelemetry
} from "../telemetry/telemetryCache.js";


const TELEMETRY_STREAM =
    process.env.TELEMETRY_STREAM ||
    "ids:telemetry";

const TELEMETRY_GROUP =
    process.env.TELEMETRY_GROUP ||
    "evidence-telemetry-group";

const TELEMETRY_CONSUMER =
    process.env.TELEMETRY_CONSUMER ||
    "evidence-telemetry-service-1";


// --------------------------------------------------
// Ensure Redis Consumer Group
// --------------------------------------------------

const ensureConsumerGroup = async () => {

    try {

        await redis.xgroup(
            "CREATE",
            TELEMETRY_STREAM,
            TELEMETRY_GROUP,
            "$",
            "MKSTREAM"
        );

        console.log(
            `[EVIDENCE] Telemetry consumer group created: ${TELEMETRY_GROUP}`
        );

    } catch (error) {

        if (!error.message.includes("BUSYGROUP")) {
            throw error;
        }

        console.log(
            `[EVIDENCE] Telemetry consumer group already exists: ${TELEMETRY_GROUP}`
        );
    }
};


// --------------------------------------------------
// Reset consumer group to current stream position
// --------------------------------------------------

const moveGroupToLatest = async () => {

    try {

        await redis.xgroup(
            "SETID",
            TELEMETRY_STREAM,
            TELEMETRY_GROUP,
            "$"
        );

        console.log(
            `[EVIDENCE] Telemetry consumer group moved to latest stream position`
        );

    } catch (error) {

        console.error(
            "[EVIDENCE] Failed to move telemetry consumer group:",
            error.message
        );

        throw error;
    }
};


// --------------------------------------------------
// Telemetry Consumer
// --------------------------------------------------

export const startTelemetryConsumer = async () => {

    await ensureConsumerGroup();

    /*
     * The Evidence Service only needs recent telemetry.
     *
     * The Redis stream may contain historical telemetry
     * from previous runs. Move the group to the current
     * end of the stream so that old telemetry is not replayed.
     */
    await moveGroupToLatest();


    console.log(
        `[EVIDENCE] Listening to ${TELEMETRY_STREAM}`
    );


    while (true) {

        try {

            const result =
                await redis.xreadgroup(
                    "GROUP",
                    TELEMETRY_GROUP,
                    TELEMETRY_CONSUMER,
                    "BLOCK",
                    5000,
                    "COUNT",
                    10,
                    "STREAMS",
                    TELEMETRY_STREAM,
                    ">"
                );


            if (!result) {
                continue;
            }


            for (const [, messages] of result) {

                for (
                    const [messageId, fields]
                    of messages
                ) {

                    const dataIndex =
                        fields.indexOf("data");


                    // ------------------------------------------
                    // Invalid stream message
                    // ------------------------------------------

                    if (dataIndex === -1) {

                        await redis.xack(
                            TELEMETRY_STREAM,
                            TELEMETRY_GROUP,
                            messageId
                        );

                        continue;
                    }


                    let telemetry;


                    // ------------------------------------------
                    // Parse telemetry
                    // ------------------------------------------

                    try {

                        telemetry =
                            JSON.parse(
                                fields[
                                    dataIndex + 1
                                ]
                            );

                    } catch (error) {

                        console.error(
                            `[EVIDENCE] Invalid telemetry JSON ${messageId}:`,
                            error.message
                        );


                        await redis.xack(
                            TELEMETRY_STREAM,
                            TELEMETRY_GROUP,
                            messageId
                        );

                        continue;
                    }


                    // ------------------------------------------
                    // Cache telemetry
                    // ------------------------------------------

                    console.log(
                        `[EVIDENCE] Telemetry timestamp: ${telemetry.timestamp}`
                    );


                    updateTelemetry(
                        telemetry
                    );


                    // ------------------------------------------
                    // Acknowledge message
                    // ------------------------------------------

                    await redis.xack(
                        TELEMETRY_STREAM,
                        TELEMETRY_GROUP,
                        messageId
                    );
                }
            }

        } catch (error) {

            console.error(
                "[EVIDENCE] Telemetry consumer error:",
                error
            );
        }
    }
};