
import crypto from "crypto";

const SENSITIVE_PARAM =
    /^(token|access_token|refresh_token|password|passwd|secret|authorization|auth|session|sessionid|cookie|api[_-]?key|access[_-]?key|email)$/i;

const sanitizeUrl = (originalUrl = "/") => {
    try {
        const url = new URL(originalUrl, "http://sentinel.internal");

        for (const key of url.searchParams.keys()) {
            if (SENSITIVE_PARAM.test(key)) {
                url.searchParams.set(key, "[REDACTED]");
            }
        }

        // Keep the path and non-sensitive query values for IDS detection.
        return `${url.pathname}${url.search}`.slice(0, 4096);
    } catch {
        return "/";
    }
};

export const collectTraffic = (req, res) => {
    const responseTime = Date.now() - req.requestStartTime;

    const rawSourceIp = req.socket.remoteAddress || "unknown";
    const sourceIp = rawSourceIp.replace(/^::ffff:/, "");

    return {
        requestId: req.requestId,
        correlationId: crypto.randomUUID(),
        hostId: req.hostId,
        timestamp: new Date().toISOString(),
        sourceIp,
        method: req.method,
        path: sanitizeUrl(req.originalUrl),
        userAgent: String(req.headers["user-agent"] || "unknown").slice(0, 512),
        statusCode: res.statusCode,
        responseTime
    };
};
