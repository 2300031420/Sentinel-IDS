
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { startTelemetryConsumer } from "./consumer/telemetryConsumer.js";
import { startIncidentConsumer } from "./consumer/incidentConsumer.js";
import { startEvidenceConsumer } from "./consumer/evidenceConsumer.js";
import evidenceRoutes from "./routes/evidenceRoutes.js";

const app = express();
const PORT = Number(process.env.PORT || 4030);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error(
        "[EVIDENCE API] JWT_SECRET must contain at least 32 characters"
    );
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error("[EVIDENCE API] Invalid PORT configuration");
}

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "healthy",
        service: "evidence-preservation-service"
    });
});

app.use("/api/evidence", evidenceRoutes);

app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

const server = app.listen(PORT, "127.0.0.1", () => {
    console.log(
        `[EVIDENCE API] HTTP server listening on 127.0.0.1:${PORT}`
    );
});

try {
    await Promise.all([
        startIncidentConsumer(),
        startEvidenceConsumer(),
        startTelemetryConsumer()
    ]);

    console.log(
        "[EVIDENCE] All Redis consumers started successfully"
    );
} catch (error) {
    console.error(
        "[EVIDENCE] Failed to start Redis consumers:",
        error.message
    );

    server.close();
    process.exitCode = 1;
}
