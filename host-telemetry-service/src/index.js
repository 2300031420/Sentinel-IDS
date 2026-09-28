import "dotenv/config";

import { collectSystemTelemetry } from "./telemetry/systemTelemetry.js";
import { publishTelemetry } from "./publisher/telemetryPublisher.js";
import { startTelemetryConsumer } from "./consumer/telemetryConsumer.js";

const TELEMETRY_INTERVAL =
    Number(process.env.TELEMETRY_INTERVAL) || 5000;

const collectAndPublish = async () => {
    try {
        const telemetry = collectSystemTelemetry();

        console.log(
            "[HOST TELEMETRY] Collected:",
            telemetry
        );

        await publishTelemetry(telemetry);
    } catch (error) {
        console.error(
            "[HOST TELEMETRY] Collection cycle failed:",
            error
        );
    }
};

console.log(
    "[HOST TELEMETRY] Service started"
);

console.log(
    `[HOST TELEMETRY] Collection interval: ${TELEMETRY_INTERVAL}ms`
);

await collectAndPublish();

setInterval(
    collectAndPublish,
    TELEMETRY_INTERVAL
);
startTelemetryConsumer();