import express from "express";
import dotenv from "dotenv";
import pool from "./config/database.js";
import cors from "cors";
import crypto from "crypto";
import { createServer } from "http";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import helmet from "helmet";
import { z } from "zod";
import {
    connectDatabase
} from "./config/database.js";
import { authenticateApiKey } from "./middleware/auth.js";
import {
    startIncidentConsumer
} from "./consumers/incidentConsumer.js";

import {
    markAcknowledged
} from "./services/alertProcessor.js";

dotenv.config();

const app = express();
app.use(helmet());
const alertApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later."
    }
});
app.use(cors({
    origin: "http://localhost:3000"
}));
const alertIdSchema = z.string().uuid();

const alertsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
    status: z.enum(["PENDING", "PROCESSING", "SENT", "FAILED", "ACKNOWLEDGED"]).optional()
});
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000"
    }
});
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
        console.warn(
            `[SECURITY] Socket authentication token missing from ${socket.handshake.address}`
        );

        return next(new Error("Authentication required"));
    }

    const [timestamp, signature] = token.split(".");

    if (!timestamp || !signature) {
        console.warn(
            `[SECURITY] Malformed Socket.IO authentication token`
        );

        return next(new Error("Invalid authentication token"));
    }

    const tokenAge = Date.now() - Number(timestamp);

    // Token valid for 60 seconds
    if (
        !Number.isFinite(tokenAge) ||
        tokenAge < 0 ||
       tokenAge > 300_000
    ) {
        console.warn(
            `[SECURITY] Expired Socket.IO authentication token`
        );

        return next(new Error("Authentication token expired"));
    }

    const expectedSignature = crypto
        .createHmac("sha256", process.env.ALERT_API_KEY)
        .update(timestamp)
        .digest("hex");

    const valid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );

    if (!valid) {
        console.warn(
            `[SECURITY] Invalid Socket.IO authentication token`
        );

        return next(new Error("Invalid authentication token"));
    }

    next();
});


io.on("connection", (socket) => {

    console.log(
        `[ALERT WS] Dashboard connected: ${socket.id}`
    );

    socket.on("disconnect", () => {

        console.log(
            `[ALERT WS] Dashboard disconnected: ${socket.id}`
        );

    });

});

app.use(express.json());

const PORT = process.env.ALERT_SERVICE_PORT || 4010;

// Health check
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        service: "alert-service",
        timestamp: new Date().toISOString()
    });
});

// Acknowledge alert
app.patch(
    "/api/alerts/:alertId/acknowledge",
    alertApiLimiter,
    authenticateApiKey,
    async (req, res) => {

        const { alertId } = req.params;
        const parsedAlertId = alertIdSchema.safeParse(alertId);

if (!parsedAlertId.success) {
    return res.status(400).json({
        success: false,
        message: "Invalid alert ID"
    });
}

        try {

            await markAcknowledged(alertId);

            res.json({
                success: true,
                alertId,
                status: "ACKNOWLEDGED"
            });

        } catch (error) {

            console.error(
                "[ALERT API] Failed to acknowledge alert:",
                error.message
            );

            res.status(500).json({
                success: false,
                message: "Failed to acknowledge alert"
            });
        }
    }
);

app.get("/api/alerts", authenticateApiKey, alertApiLimiter, async (req, res) => {


    try {
        const parsedQuery = alertsQuerySchema.safeParse(req.query);

        if (!parsedQuery.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid query parameters",
                errors: parsedQuery.error.flatten()
            });
        }

        const {
            page,
            limit,
            severity,
            status
        } = parsedQuery.data;

        const offset = (page - 1) * limit;
        let query = `
    SELECT
        a.alert_id,
        a.incident_id,
        a.request_id,
        a.severity,
        a.channel,
        a.status,
        a.message,
        a.created_at,
        a.sent_at,
        a.acknowledged_at,
        a.updated_at,

        i.source_ip AS sourceIp,
        i.method AS method,
        i.Path AS path,
        i.Threat_score AS threatScore,
        i.detections AS detections

    FROM alerts a

    LEFT JOIN incidents i
        ON a.incident_id = i.incident_id
`;

        const conditions = [];
        const values = [];

        if (severity) {
            conditions.push("a.severity = ?");
            values.push(severity.toUpperCase());
        }

        if (status) {
            conditions.push("a.status = ?");
            values.push(status.toUpperCase());
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY a.created_at DESC LIMIT ? OFFSET ?";
        values.push(limit, offset);

        const countQuery = `
    SELECT COUNT(*) AS total
    FROM alerts a
    ${conditions.length > 0
                ? "WHERE " + conditions.join(" AND ")
                : ""}
`;

        const [countResult] = await pool.execute(
            countQuery,
            values.slice(0, conditions.length)
        );

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        const [alerts] = await pool.execute(
            query,
            values
        );

        res.json({
            success: true,
            count: alerts.length,

            pagination: {
                page,
                limit,
                total,
                totalPages
            },
            filters: {
                severity: severity || null,
                status: status || null
            },
            alerts
        });

    } catch (error) {

        console.error(
            "[ALERT API] Failed to fetch alerts:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch alerts"
        });
    }
});

app.get("/api/alerts/:alertId", authenticateApiKey, alertApiLimiter, async (req, res) => {

    const { alertId } = req.params;
    const parsedAlertId = alertIdSchema.safeParse(alertId);

if (!parsedAlertId.success) {
    return res.status(400).json({
        success: false,
        message: "Invalid alert ID"
    });
}

    try {

        const [alerts] = await pool.execute(
            `
    SELECT
        a.alert_id,
        a.incident_id,
        a.request_id,
        a.severity,
        a.channel,
        a.status,
        a.message,
        a.created_at,
        a.sent_at,
        a.acknowledged_at,
        a.updated_at,

        i.source_ip AS sourceIp,
        i.method AS method,
        i.Path AS path,
        i.Threat_score AS threatScore,
        i.detections AS detections

    FROM alerts a

    LEFT JOIN incidents i
        ON a.incident_id = i.incident_id

    WHERE a.alert_id = ?
    `,
            [parsedAlertId.data]
        );
        if (alerts.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Alert not found"
            });

        }

        res.json({
            success: true,
            alert: alerts[0]
        });

    } catch (error) {

        console.error(
            "[ALERT API] Failed to fetch alert:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch alert"
        });
    }
});

const startService = async () => {

    try {

        console.log(
            "Starting SentinelIDS Alert Service..."
        );

        await connectDatabase();

        await startIncidentConsumer(io);

    } catch (error) {

        console.error(
            "[ALERT] Failed to start:",
            error.message
        );

        process.exit(1);
    }
};

httpServer.listen(PORT, () => {

    console.log(
        `[ALERT API] Alert API running on port ${PORT}`
    );

});
app.use((err, req, res, next) => {
    console.error(
        `[ERROR] ${req.method} ${req.originalUrl}:`,
        err.message
    );

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

startService();