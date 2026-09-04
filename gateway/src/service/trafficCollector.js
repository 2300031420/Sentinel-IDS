export const collectTraffic = (req, res) => {
    const responseTime = Date.now() - req.requestStartTime;

    const sourceIp =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "unknown";

    return {
        requestId: req.requestId,

        timestamp: new Date().toISOString(),

        sourceIp,

        method: req.method,

        path: req.originalUrl,

        userAgent: req.headers["user-agent"] || "unknown",

        statusCode: res.statusCode,

        responseTime
    };
};