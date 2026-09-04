export const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
        console.warn(
            `[SECURITY] Missing API key: ${req.method} ${req.originalUrl} from ${req.ip}`
        );

        return res.status(401).json({
            success: false,
            message: "API key required"
        });
    }

    if (apiKey !== process.env.ALERT_API_KEY) {
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