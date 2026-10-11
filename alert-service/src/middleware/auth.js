import crypto from "crypto";

export const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    const expectedKey = process.env.ALERT_API_KEY;

    if (!apiKey) {
        console.warn(
            `[SECURITY] Missing API key: ${req.method} ${req.originalUrl} from ${req.ip}`
        );

        return res.status(401).json({
            success: false,
            message: "API key required"
        });
    }

    if (!expectedKey) {
        console.error(
            "[SECURITY] ALERT_API_KEY is not configured"
        );

        return res.status(500).json({
            success: false,
            message: "Authentication configuration error"
        });
    }

    const providedBuffer = Buffer.from(apiKey);
    const expectedBuffer = Buffer.from(expectedKey);

    const isValid =
        providedBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(
            providedBuffer,
            expectedBuffer
        );

    if (!isValid) {
        console.warn(
            `[SECURITY] Invalid API key: ${req.method} ${req.originalUrl} from ${req.ip}`
        );

        return res.status(403).json({
            success: false,
            message: "Invalid API key"
        });
    }

    next();
};