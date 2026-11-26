import redis from "../config/redis.js";

const MAX_HISTORY = 30;

const TELEMETRY_MATCH_WINDOW_MS = 120000;

const TELEMETRY_STREAM =
    process.env.TELEMETRY_STREAM || "ids:telemetry";

const telemetryHistory = new Map();


// --------------------------------------------------
// Store telemetry in memory
// --------------------------------------------------

export const updateTelemetry = (telemetry) => {
    if (!telemetry?.hostId) {
        return;
    }

    const hostId = telemetry.hostId;

    if (!telemetryHistory.has(hostId)) {
        telemetryHistory.set(hostId, []);
    }

    const history =
        telemetryHistory.get(hostId);

    history.push(telemetry);

    if (history.length > MAX_HISTORY) {
        history.shift();
    }

    console.log(
        `[EVIDENCE] Telemetry cached for host ${hostId} | History: ${history.length}`
    );
};


// --------------------------------------------------
// Find closest telemetry in memory
// --------------------------------------------------

const findClosestTelemetry = (
    history,
    incidentTime,
    maxAgeMs
) => {

    let closestTelemetry = null;
    let closestDifference = Infinity;

    for (const telemetry of history) {

        const telemetryTime =
            new Date(
                telemetry.timestamp
            ).getTime();

        if (Number.isNaN(telemetryTime)) {
            continue;
        }

        const difference =
            Math.abs(
                incidentTime - telemetryTime
            );

        if (
            difference <= maxAgeMs &&
            difference < closestDifference
        ) {
            closestDifference = difference;
            closestTelemetry = telemetry;
        }
    }

    return {
        telemetry: closestTelemetry,
        difference: closestDifference
    };
};


// --------------------------------------------------
// Redis fallback
// --------------------------------------------------

const findTelemetryFromRedis = async (
    hostId,
    incidentTime,
    maxAgeMs
) => {

    try {

        const messages =
            await redis.xrevrange(
                TELEMETRY_STREAM,
                "+",
                "-",
                "COUNT",
                50
            );

        let closestTelemetry = null;
        let closestDifference = Infinity;

        for (const [, fields] of messages) {

            const dataIndex =
                fields.indexOf("data");

            if (dataIndex === -1) {
                continue;
            }

            let telemetry;

            try {
                telemetry =
                    JSON.parse(
                        fields[dataIndex + 1]
                    );
            } catch {
                continue;
            }

            if (
                telemetry.hostId !== hostId
            ) {
                continue;
            }

            const telemetryTime =
                new Date(
                    telemetry.timestamp
                ).getTime();

            if (Number.isNaN(telemetryTime)) {
                continue;
            }

            const difference =
                Math.abs(
                    incidentTime -
                    telemetryTime
                );

            if (
                difference <= maxAgeMs &&
                difference < closestDifference
            ) {
                closestDifference =
                    difference;

                closestTelemetry =
                    telemetry;
            }
        }

        if (closestTelemetry) {

            console.log(
                `[EVIDENCE] Redis telemetry fallback matched | Incident: ${new Date(incidentTime).toISOString()} | Telemetry: ${closestTelemetry.timestamp} | Difference: ${closestDifference}ms`
            );
        }

        return closestTelemetry;

    } catch (error) {

        console.error(
            "[EVIDENCE] Redis telemetry lookup failed:",
            error.message
        );

        return null;
    }
};


// --------------------------------------------------
// Find telemetry near incident
// --------------------------------------------------

export const getTelemetryNearIncident = async (
    hostId,
    incidentTimestamp,
    maxAgeMs = TELEMETRY_MATCH_WINDOW_MS
) => {

    if (
        !hostId ||
        !incidentTimestamp
    ) {
        return null;
    }

    const incidentTime =
        new Date(
            incidentTimestamp
        ).getTime();

    if (Number.isNaN(incidentTime)) {
        return null;
    }


    // ----------------------------------------------
    // 1. Try in-memory cache
    // ----------------------------------------------

    const history =
        telemetryHistory.get(hostId);

    if (
        history &&
        history.length > 0
    ) {

        const result =
            findClosestTelemetry(
                history,
                incidentTime,
                maxAgeMs
            );

        if (result.telemetry) {

            console.log(
                `[EVIDENCE] Memory telemetry matched | Difference: ${result.difference}ms`
            );

            return result.telemetry;
        }
    }


    // ----------------------------------------------
    // 2. Redis fallback
    // ----------------------------------------------

    console.log(
        `[EVIDENCE] Memory telemetry unavailable | Checking Redis`
    );

    return await findTelemetryFromRedis(
        hostId,
        incidentTime,
        maxAgeMs
    );
};


// --------------------------------------------------
// Get complete telemetry cache
// --------------------------------------------------

export const getTelemetryCache = () => {

    return new Map(
        Array.from(
            telemetryHistory.entries()
        ).map(
            ([hostId, history]) => [
                hostId,
                [...history]
            ]
        )
    );
};