import express from "express";
import cors from "cors";
import redis from "./config/redis.js";
import { createProxyMiddleware } from "http-proxy-middleware";
import { publishFeedback } from "./publisher/feedbackPublisher.js";

import { config } from "./config/config.js";
import { requestContext } from "./middleware/requestContext.js";
import { trafficLogger } from "./middleware/trafficLogger.js";

const app = express();

app.use(cors());

app.use(requestContext);

app.use(trafficLogger);

/*
 * SentinelIDS Blocklist Enforcement
 *
 * This middleware MUST run before the proxy.
 */
app.use(async (req, res, next) => {
    try {
        const sourceIp =
            req.ip ||
            req.socket.remoteAddress;

        const normalizedIp =
            sourceIp?.replace(/^::ffff:/, "");

        console.log(
            `[GATEWAY] Checking blocklist for ${normalizedIp}`
        );

        // TTL-based blocklist key
        const blockKey = `ids:block:${normalizedIp}`;

        const detectionType = await redis.get(blockKey);

        console.log(
            "[GATEWAY] Blocklist lookup:",
            {
                sourceIp,
                normalizedIp,
                blockKey,
                detectionType
            }
        );

        const blocked = detectionType !== null;

        if (blocked) {
            console.log(
                `[GATEWAY] BLOCKED ${normalizedIp} ${req.method} ${req.originalUrl} | Reason: ${detectionType}`
            );

            const feedbackKey =
                `ids:feedback-sent:${normalizedIp}:${detectionType}`;

            const feedbackAlreadySent =
                await redis.exists(feedbackKey);

            if (!feedbackAlreadySent) {
                await publishFeedback({
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
                    `[GATEWAY] BLOCKED feedback published for ${normalizedIp} | Reason: ${detectionType}`
                );
            } else {
                console.log(
                    `[GATEWAY] BLOCKED feedback already sent for ${normalizedIp} | Reason: ${detectionType}`
                );
            }

            return res.status(403).json({
                status: "BLOCKED",
                message: "Request blocked by SentinelIDS",
                sourceIp: normalizedIp,
                detectionType
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