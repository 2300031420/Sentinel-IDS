import { collectTraffic } from "../service/trafficCollector.js";
import { publishTrafficEvent } from "../service/eventBus.js";

export const trafficLogger = (req, res, next) => {
    console.log(
        `[TRAFFIC] Incoming: ${req.method} ${req.originalUrl}`
    );

    res.on("finish", async () => {
        const event = collectTraffic(req, res);

        console.log(
            "[TRAFFIC] Completed:",
            event
        );

        try {
            await publishTrafficEvent(event);
        } catch (error) {
            console.error(
                "[TRAFFIC] Failed to publish event:",
                error.message
            );
        }
    });

    next();
};