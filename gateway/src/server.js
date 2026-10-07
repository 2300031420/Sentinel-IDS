import express from "express";
import cors from "cors";
import redis from "./config/redis.js";
import { createProxyMiddleware } from "http-proxy-middleware";
import { publishFeedback } from "./publisher/feedbackPublisher.js";
import helmet from "helmet";
import { config } from "./config/config.js";
import { requestContext } from "./middleware/requestContext.js";
import { trafficLogger } from "./middleware/trafficLogger.js";

const app = express();
app.disable("x-powered-by");
app.use(
    cors({
        origin: "http://localhost:3000",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Request-ID"
        ]
    })
);
app.use(helmet());
app.use(requestContext);

app.use(trafficLogger);

/*
 * SentinelIDS Blocklist Enforcement
 *
 * This middleware MUST run before the proxy.
 */
app.use(async (req, res, next) => {
    try {

        /*
         * Health-check bypass
         *
         * Health endpoints must remain accessible even when
         * the source IP is temporarily blocked.
         */
        if (
            (req.method === "GET" || req.method === "HEAD") &&
            (
                req.path === "/health" ||
                req.path === "/health/"
            )
        ) {
            console.log(
                `[GATEWAY] Health check bypass: ${req.method} ${req.originalUrl}`
            );

            return next();
        }

        const sourceIp =
            req.ip ||
            req.socket.remoteAddress;

        const normalizedIp =
            sourceIp?.replace(/^::ffff:/, "");

        console.log(
            `[GATEWAY] Checking blocklist for ${normalizedIp}`
        );

        /*
         * Current request identity.
         *
         * requestContext middleware creates this ID before
         * the blocklist middleware runs.
         */
        const currentRequestId =
            req.requestId || null;

        // TTL-based blocklist key
        const blockKey =
            `ids:block:${normalizedIp}`;

        const blockValue =
            await redis.get(blockKey);

        let blockData = null;

        if (blockValue) {
            try {
                blockData = JSON.parse(blockValue);
            } catch {
                /*
                 * Backward compatibility with older
                 * blocklist values that only contained
                 * the detection type.
                 */
                console.warn(
                    `[GATEWAY] Invalid blocklist data for ${normalizedIp}`
                );
                blockData = {
                    detectionType: "INVALID_BLOCKLIST_DATA",
                    requestId: null,
                    activityId: null,
                    incidentId: null
                };
            }
        }

        const detectionType =
            blockData?.detectionType || null;

        console.log(
            "[GATEWAY] Blocklist lookup:",
            {
                sourceIp,
                normalizedIp,
                blockKey,
                blockData,
                currentRequestId
            }
        );

        const blocked =
            blockData !== null;

        if (blocked) {

            /*
             * IMPORTANT:
             *
             * The current request gets its own request ID.
             *
             * The activity/incident IDs belong to the original
             * security event that caused the block.
             */
            const blockedRequestId =
                currentRequestId ||
                blockData.requestId ||
                null;

            console.log(
                `[GATEWAY] BLOCKED ${normalizedIp} ${req.method} ${req.originalUrl} | Reason: ${detectionType} | Current Request: ${blockedRequestId} | Activity: ${blockData.activityId} | Incident: ${blockData.incidentId}`
            );

            /*
             * Feedback is still deduplicated per IP + detection.
             *
             * This prevents a flood of identical BLOCKED feedback
             * events while the IP remains blocked.
             */
            const feedbackKey =
                `ids:feedback-sent:${normalizedIp}:${detectionType}`;

            const feedbackAlreadySent =
                await redis.exists(feedbackKey);

            if (!feedbackAlreadySent) {

                await publishFeedback({
                    requestId:
                        blockedRequestId,

                    activityId:
                        blockData.activityId,

                    incidentId:
                        blockData.incidentId,

                    detectionType,

                    responseStatus: "BLOCKED"
                });

                await redis.set(
                    feedbackKey,
                    "1",
                    "EX",
                    600
                );

                console.log(
                    `[GATEWAY] BLOCKED feedback published for ${normalizedIp} | Detection: ${detectionType} | Request: ${blockedRequestId} | Activity: ${blockData.activityId} | Incident: ${blockData.incidentId}`
                );

            } else {

                console.log(
                    `[GATEWAY] BLOCKED feedback already sent for ${normalizedIp} | Reason: ${detectionType}`
                );
            }

            /*
             * Return the current request ID instead of the
             * original malicious request ID.
             */
            return res.status(403).json({
                status: "BLOCKED",
                message: "Request blocked by SentinelIDS",
                requestId: blockedRequestId
            });
        }

        next();

    } catch (error) {

        console.error(
            "[GATEWAY] Blocklist check error:",
            error.message
        );

        next(error);
    }
});

/*
 * Forward allowed requests to the target server.
 */
app.use(
    "/",
    createProxyMiddleware({
        target: config.targetUrl,
        changeOrigin: true,

        on: {

            proxyReq: (proxyReq, req) => {

                console.log(
                    `[GATEWAY] ${req.method} ${req.originalUrl}`
                );
            },

            proxyRes: (proxyRes, req) => {

                delete proxyRes.headers["x-powered-by"];
                delete proxyRes.headers["access-control-allow-origin"];
                delete proxyRes.headers["access-control-allow-credentials"];
                delete proxyRes.headers["access-control-allow-methods"];
                delete proxyRes.headers["access-control-allow-headers"];

                console.log(
                    `[GATEWAY] Response ${proxyRes.statusCode} ${req.method} ${req.originalUrl}`
                );
            },

            error: (err) => {

                console.error(
                    `[GATEWAY] Proxy error: ${err.message}`
                );
            }
        }
    })
);

app.listen(config.port, () => {

    console.log(
        `SentinelIDS Gateway running on port ${config.port}`
    );

    console.log(
        `Forwarding traffic to ${config.targetUrl}`
    );
});