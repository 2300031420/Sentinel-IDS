
import { collectTraffic } from "../service/trafficCollector.js";
import { publishTrafficEvent } from "../service/eventBus.js";

export const trafficLogger = (req, res, next) => {
    console.log(
        `[TRAFFIC] Incoming: ${req.method} ${req.path} | Request: ${req.requestId}`
    );

    res.on("finish", () => {
        const event = collectTraffic(req, res);

        console.log(
            `[TRAFFIC] Completed: ${req.method} ${req.path} | Status: ${res.statusCode} | Request: ${req.requestId}`
        );

        publishTrafficEvent(event).catch((error) => {
            // Log only a controlled error category, not request data.
            console.error(
                "[TRAFFIC] Event publishing failed:",
                error.code || "REDIS_PUBLISH_ERROR"
            );
        });
    });

    next();
};
