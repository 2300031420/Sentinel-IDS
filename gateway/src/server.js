import express from "express";
import cors from "cors";
import redis from "./config/redis.js";
import { createProxyServer } from "http-proxy-3";
import { publishFeedback } from "./publisher/feedbackPublisher.js";
import helmet from "helmet";
import { config } from "./config/config.js";
import { requestContext } from "./middleware/requestContext.js";
import { trafficLogger } from "./middleware/trafficLogger.js";
import rateLimit from "express-rate-limit";

const app = express();

app.disable("x-powered-by");

// --------------------------------------------------
// CORS
// --------------------------------------------------


const allowedOrigins = (
    process.env.CORS_ORIGINS ||
    (process.env.NODE_ENV === "production"
        ? ""
        : "http://localhost:3000")
)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

if (
    process.env.NODE_ENV === "production" &&
    allowedOrigins.length === 0
) {
    throw new Error(
        "[CONFIG] CORS_ORIGINS must be configured in production"
    );
}

app.use(
    cors({
        origin(origin, callback) {
            // Requests without Origin include server-to-server clients
            // and curl. CORS is not a substitute for authentication.
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(null, false);
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Request-ID"
        ],
        credentials: false,
        maxAge: 600
    })
);


// --------------------------------------------------
// SECURITY HEADERS
// --------------------------------------------------

app.use(helmet());

// --------------------------------------------------
// GLOBAL RATE LIMITING
// --------------------------------------------------

const gatewayLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,

    // Do not trust X-Forwarded-For.
    // Gateway is currently directly exposed.
    keyGenerator: (req) => {
        return req.socket.remoteAddress || "unknown";
    },

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        status: "RATE_LIMITED",
        message: "Too many requests. Please try again later."
    },

    handler: (req, res, next, options) => {
        console.warn(
            `[SECURITY] Gateway rate limit exceeded from ${req.socket.remoteAddress}`
        );

        res.status(options.statusCode).json(options.message);
    }
});

app.use(gatewayLimiter);

// --------------------------------------------------
// REQUEST CONTEXT
// --------------------------------------------------

app.use(requestContext);

// --------------------------------------------------
// TRAFFIC LOGGER
// --------------------------------------------------

app.use(trafficLogger);

// --------------------------------------------------
// BLOCKLIST ENFORCEMENT
// --------------------------------------------------


app.use(async (req, res, next) => {
    const requestId = req.requestId || null;

    // Allow health checks even when the source IP is blocked.
    if (
        ["GET", "HEAD"].includes(req.method) &&
        ["/health", "/health/"].includes(req.path)
    ) {
        return next();
    }

    const sourceIp = req.socket.remoteAddress || "unknown";
    const normalizedIp = sourceIp.replace(/^::ffff:/, "");
    const blockKey = `ids:block:${normalizedIp}`;

    let blockData = null;

    // Security-critical operation: fail closed if lookup fails.
    try {
        const blockValue = await redis.get(blockKey);

        if (blockValue !== null) {
            try {
                const parsed = JSON.parse(blockValue);

                // Treat malformed or unexpected values as blocked.
                if (
                    !parsed ||
                    typeof parsed !== "object" ||
                    Array.isArray(parsed)
                ) {
                    throw new Error("Invalid blocklist structure");
                }

                blockData = parsed;
            } catch {
                blockData = {
                    detectionType: "INVALID_BLOCKLIST_DATA"
                };

                console.warn(
                    "[GATEWAY] Invalid blocklist entry; blocking request"
                );
            }
        }
    } catch (error) {
        console.error(
            "[GATEWAY] Blocklist lookup unavailable:",
            error.code || "BLOCKLIST_LOOKUP_FAILED"
        );

        return res.status(503).json({
            status: "SERVICE_UNAVAILABLE",
            message: "Security enforcement is temporarily unavailable",
            requestId
        });
    }

    // No block exists: continue to the proxy.
    if (blockData === null) {
        return next();
    }

    const detectionType =
        typeof blockData.detectionType === "string"
            ? blockData.detectionType.slice(0, 100)
            : "UNKNOWN";

    // A confirmed block must remain a 403 even if feedback fails.
    console.warn(
        `[GATEWAY] Request blocked | IP: ${normalizedIp} | Method: ${req.method} | Path: ${req.path} | Request: ${requestId}`
    );

    const feedbackKey =
        `ids:feedback-sent:${normalizedIp}:${detectionType}`;

    try {
        const feedbackAlreadySent = await redis.exists(feedbackKey);

        if (!feedbackAlreadySent) {
            await publishFeedback({
                requestId,
                activityId: blockData.activityId || null,
                incidentId: blockData.incidentId || null,
                detectionType,
                responseStatus: "BLOCKED"
            });

            await redis.set(feedbackKey, "1", "EX", 600);

            console.log(
                "[GATEWAY] Blocked-request feedback published"
            );
        }
    } catch (error) {
        // Do not change a confirmed block into a 503.
        console.error(
            "[GATEWAY] Blocked-request feedback failed:",
            error.code || "FEEDBACK_PUBLISH_FAILED"
        );
    }

    return res.status(403).json({
        status: "BLOCKED",
        message: "Request blocked by SentinelIDS",
        requestId
    });
});


// --------------------------------------------------
// PROXY
// --------------------------------------------------

// --------------------------------------------------
// PROXY
// --------------------------------------------------


const proxy = createProxyServer({
    target: config.targetUrl,
    changeOrigin: true,
    proxyTimeout: 15_000,
    timeout: 20_000
});



proxy.on("proxyReq", (proxyReq, req) => {
    console.log(
        `[GATEWAY] Forwarding ${req.method} ${req.path} | Request: ${req.requestId}`
    );
});


proxy.on("proxyRes", (proxyRes, req) => {
    delete proxyRes.headers["x-powered-by"];
    delete proxyRes.headers["access-control-allow-origin"];
    delete proxyRes.headers["access-control-allow-credentials"];
    delete proxyRes.headers["access-control-allow-methods"];
    delete proxyRes.headers["access-control-allow-headers"];


    console.log(
        `[GATEWAY] Response ${proxyRes.statusCode} ${req.method} ${req.path} | Request: ${req.requestId}`
    );

});


proxy.on("error", (err, req, res) => {
    console.error(
        `[GATEWAY] Proxy failure | Code: ${err.code || "UPSTREAM_PROXY_ERROR"} | Request: ${req?.requestId || "unknown"}`
    );

    if (!res || res.destroyed) {
        return;
    }

    if (!res.headersSent) {
        res.writeHead(502, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        });

        res.end(JSON.stringify({
            status: "BAD_GATEWAY",
            message: "Upstream service unavailable",
            requestId: req?.requestId || null
        }));
    } else {
        res.destroy();
    }
});


app.use("/", (req, res) => {
    proxy.web(req, res);
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(config.port, () => {
    console.log(
        `SentinelIDS Gateway running on port ${config.port}`
    );

    console.log(
        `Forwarding traffic to ${config.targetUrl}`
    );
});