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
app.get(
    "/api/incidents",
    alertApiLimiter,
    authenticateApiKey,
    async (req, res, next) => {
        try {
            const [incidents] = await pool.execute(`
                SELECT
                    incident_id,
                    request_id,
                    severity,
                    threat_score AS threatScore,
                    source_ip AS sourceIp,
                    method,
                    Path AS path,
                    detections,
                    created_at
                FROM incidents
                ORDER BY created_at DESC
                LIMIT 100
            `);

            res.json({
                success: true,
                count: incidents.length,
                incidents
            });

        } catch (error) {
            console.error(
                "[INCIDENT API] Failed to fetch incidents:",
                error.message
            );

            next(error);
        }
    }
);
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

            io.emit("alert-acknowledged", {
                alertId,
                status: "ACKNOWLEDGED",
                acknowledgedAt: new Date().toISOString()
            });

            console.log(
                `[ALERT WS] Alert acknowledged: ${alertId}`
            );

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
        a.activity_id,
a.correlation_score,
a.correlation_confidence,
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
app.get(
    "/api/analytics",
    alertApiLimiter,
    authenticateApiKey,
    async (req, res, next) => {
        try {
            const [severityRows] = await pool.execute(`
                SELECT
                    severity,
                    COUNT(*) AS count
                FROM alerts
                GROUP BY severity
                ORDER BY count DESC
            `);

            const [statusRows] = await pool.execute(`
                SELECT
                    status,
                    COUNT(*) AS count
                FROM alerts
                GROUP BY status
                ORDER BY count DESC
            `);

            const [ipRows] = await pool.execute(`
                SELECT
                    i.source_ip AS sourceIp,
                    COUNT(*) AS count
                FROM alerts a
                JOIN incidents i
                    ON a.incident_id = i.incident_id
                GROUP BY i.source_ip
                ORDER BY count DESC
                LIMIT 10
            `);

            const [pathRows] = await pool.execute(`
                SELECT
                    i.Path AS path,
                    COUNT(*) AS count
                FROM alerts a
                JOIN incidents i
                    ON a.incident_id = i.incident_id
                GROUP BY i.Path
                ORDER BY count DESC
                LIMIT 10
            `);

            const [attackRows] = await pool.execute(`
                SELECT
                    JSON_UNQUOTE(
                        JSON_EXTRACT(
                            jt.detection,
                            '$.type'
                        )
                    ) AS attackType,
                    COUNT(*) AS count
                FROM incidents i
                JOIN JSON_TABLE(
                    i.detections,
                    '$[*]' COLUMNS (
                        detection JSON PATH '$'
                    )
                ) jt
                GROUP BY attackType
                ORDER BY count DESC
            `);

            const [scoreRows] = await pool.execute(`
                SELECT
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') AS hour,
                    COUNT(*) AS alerts,
                    AVG(threatScore) AS averageScore,
                    MAX(threatScore) AS maxScore
                FROM (
                    SELECT
                        a.created_at,
                        i.Threat_score AS threatScore
                    FROM alerts a
                    JOIN incidents i
                        ON a.incident_id = i.incident_id
                ) data
                GROUP BY hour
                ORDER BY hour ASC
                LIMIT 24
            `);

            const [crossLayerRows] = await pool.execute(`
    SELECT
        a.activity_id AS activityId,
        a.correlation_score AS correlationScore,
        a.correlation_confidence AS correlationConfidence,
        a.incident_id AS incidentId,
        a.request_id AS requestId,
        i.source_ip AS sourceIp,
        i.severity AS severity,
        i.Threat_score AS threatScore,
        i.created_at AS createdAt
    FROM alerts a
    JOIN incidents i
        ON a.incident_id = i.incident_id
    WHERE a.activity_id IS NOT NULL
    ORDER BY a.created_at DESC
    LIMIT 50
`);

            const totalActivities = crossLayerRows.length;

            const highConfidence = crossLayerRows.filter(
                (row) => row.correlationConfidence === "HIGH"
            ).length;

            const mediumConfidence = crossLayerRows.filter(
                (row) => row.correlationConfidence === "MEDIUM"
            ).length;

            const lowConfidence = crossLayerRows.filter(
                (row) => row.correlationConfidence === "LOW"
            ).length;

            const averageCorrelationScore =
                totalActivities > 0
                    ? Number(
                        (
                            crossLayerRows.reduce(
                                (sum, row) =>
                                    sum + Number(row.correlationScore || 0),
                                0
                            ) / totalActivities
                        ).toFixed(2)
                    )
                    : 0;

            res.json({
                success: true,
                analytics: {
                    severity: severityRows,
                    status: statusRows,
                    topSourceIps: ipRows,
                    topPaths: pathRows,
                    attackTypes: attackRows,
                    threatActivity:     scoreRows,

                     crossLayer: {
                        totalActivities,
                        highConfidence,
                        mediumConfidence,
                        lowConfidence,
                        averageCorrelationScore,
                        activities: crossLayerRows
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

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
        a.activity_id,
a.correlation_score,
a.correlation_confidence,
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