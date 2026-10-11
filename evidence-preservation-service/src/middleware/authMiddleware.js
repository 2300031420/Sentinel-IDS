
import jwt from "jsonwebtoken";

export const authenticate = (req, res, next) => {
    const token = req.cookies?.["sentinelids-session"];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error("[EVIDENCE API] JWT_SECRET is not configured");

        return res.status(500).json({
            success: false,
            message: "Authentication service configuration error"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"]
        });

        if (
            !decoded ||
            typeof decoded !== "object" ||
            !decoded.userId ||
            typeof decoded.role !== "string"
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid session"
            });
        }

        req.user = {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role
        };

        next();
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired session"
        });
    }
};

export const authorizeEvidenceVerification = (req, res, next) => {
    const permittedRoles = new Set([
        "admin",
        "analyst"
    ]);

    if (!permittedRoles.has(req.user?.role)) {
        return res.status(403).json({
            success: false,
            message: "Insufficient permissions"
        });
    }

    next();
};
