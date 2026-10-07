import crypto from "crypto";

export const collectTraffic = (req, res) => {
    const responseTime =
        Date.now() - req.requestStartTime;

    const sourceIp =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "unknown";

    const correlationId =
        crypto.randomUUID();

    return {
        requestId: req.requestId,
        correlationId,

        // Host identity assigned by requestContext
        hostId: req.hostId,

        timestamp: new Date().toISOString(),

        sourceIp,

        method: req.method,

        path: req.originalUrl,

        userAgent:
            req.headers["user-agent"] || "unknown",

        statusCode: res.statusCode,

        responseTime
    };
};