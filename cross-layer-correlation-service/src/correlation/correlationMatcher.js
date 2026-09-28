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
        const firstSeen = context.firstSeen;
        const lastSeen = context.lastSeen;

        const afterActivity =
            telemetryTime >= firstSeen - CORRELATION_WINDOW_MS;

        const beforeExpiry =
            telemetryTime <= lastSeen + CORRELATION_WINDOW_MS;

        if (afterActivity && beforeExpiry) {
            addHostObservation(
                activityId,
                telemetry
            );

            matches.push(activityId);
        }
    }

    return matches;
};