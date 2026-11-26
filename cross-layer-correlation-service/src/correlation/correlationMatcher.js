import {
    getAllContexts,
    addHostObservation
} from "./correlationContext.js";

const CORRELATION_WINDOW_MS =
    Number(process.env.CORRELATION_WINDOW_MS) || 60000;

export const matchHostTelemetry = (telemetry) => {
    const contexts = getAllContexts();

    const telemetryTime =
        new Date(telemetry.timestamp).getTime();

    const matches = [];

    for (const [activityId, context] of contexts.entries()) {

        /*
         * Find the host associated with the
         * web activity.
         */
        const webHostIds =
            context.webObservations
                .map(
                    observation =>
                        observation.hostId
                )
                .filter(Boolean);

        /*
         * A web activity without a host identity
         * cannot be safely correlated with host
         * telemetry.
         */
        if (
            webHostIds.length === 0 ||
            !telemetry.hostId
        ) {
            continue;
        }

        /*
         * Host identity must match.
         */
        const sameHost =
            webHostIds.includes(
                telemetry.hostId
            );

        if (!sameHost) {
            continue;
        }

        const firstSeen =
            context.firstSeen;

        const lastSeen =
            context.lastSeen;

        /*
         * Telemetry must also fall within the
         * configured correlation window.
         */
        const afterActivity =
            telemetryTime >=
            firstSeen - CORRELATION_WINDOW_MS;

        const beforeExpiry =
            telemetryTime <=
            lastSeen + CORRELATION_WINDOW_MS;

        if (
            afterActivity &&
            beforeExpiry
        ) {
            addHostObservation(
                activityId,
                telemetry
            );

            matches.push(activityId);

            console.log(
                `[CROSS-LAYER] Host telemetry matched | Activity: ${activityId} | Host: ${telemetry.hostId}`
            );
        }
    }

    return matches;
};