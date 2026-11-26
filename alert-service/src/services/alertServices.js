
import crypto from "crypto";
import pool from "../config/database.js";
import { publishFeedback } from "../publisher/feedbackPublisher.js";
import {
    markProcessing,
    markSent,
    markFailed
} from "./alertProcessor.js";

const getChannel = (incident) =>
    incident.severity === "CRITICAL" ? "EMAIL" : "DASHBOARD";

const createOrGetAlert = async (incident) => {
    const channel = getChannel(incident);
    const alertId = crypto.randomUUID();

    const message =
        `${incident.severity} security incident detected. ` +
        `Source IP: ${incident.sourceIp}, Path: ${incident.path}`;

    try {
        await pool.execute(
            `INSERT INTO alerts (
                alert_id, incident_id, request_id, activity_id,
                correlation_score, correlation_confidence, severity,
                channel, status, message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                alertId,
                incident.incidentId,
                incident.requestId,
                incident.activityId ?? null,
                incident.correlationScore ?? 0,
                incident.correlationConfidence ?? "LOW",
                incident.severity,
                channel,
                "PENDING",
                message
            ]
        );

        console.log(`[ALERT] Created alert ${alertId}`);
        return { alertId, message, status: "PENDING" };
    } catch (error) {
        if (error.code !== "ER_DUP_ENTRY") {
            throw error;
        }

        const [rows] = await pool.execute(
            `SELECT alert_id, status, message
             FROM alerts
             WHERE incident_id = ? AND channel = ?
             LIMIT 1`,
            [incident.incidentId, channel]
        );

        if (rows.length === 0) {
            throw error;
        }

        const existing = rows[0];
        console.log(
            `[ALERT] Reusing ${existing.alert_id} (status: ${existing.status})`
        );

        return {
            alertId: existing.alert_id,
            message: existing.message,
            status: existing.status
        };
    }
};

export const processIncident = async (incident) => {
    if (!incident?.incidentId) {
        throw new Error("Incident is missing incidentId");
    }

    if (!["HIGH", "CRITICAL"].includes(incident.severity)) {
        console.log(
            `[ALERT] No immediate alert required for ${incident.incidentId}`
        );
        return { alertRequired: false };
    }

    const alert = await createOrGetAlert(incident);

    // These states are terminal for this delivery workflow.
    if (["SENT", "ACKNOWLEDGED"].includes(alert.status)) {
        return {
            alertRequired: true,
            alertId: alert.alertId,
            incidentId: incident.incidentId,
            status: alert.status,
            message: alert.message
        };
    }

  
    try {
        const claimed = await markProcessing(alert.alertId);

if (!claimed) {
    return {
        alertRequired: true,
        alertId: alert.alertId,
        incidentId: incident.incidentId,
        status: "ALERT_ALREADY_CLAIMED"
    };
}

        console.log(`[ALERT] Simulating delivery for ${alert.alertId}`);

        // Delivery is simulated; mark SENT only after it succeeds.
        await markSent(alert.alertId);
    } catch (error) {
        console.error(
            `[ALERT] Delivery failed for ${alert.alertId}:`,
            error.message
        );

        try {
            await markFailed(alert.alertId);
        } catch (statusError) {
            console.error(
                `[ALERT] Could not record failure for ${alert.alertId}:`,
                statusError.message
            );
        }

        try {
            await publishFeedback({
                requestId: incident.requestId,
                activityId: incident.activityId,
                incidentId: incident.incidentId,
                detectionType: incident.detections?.[0]?.type || "UNKNOWN",
                responseStatus: "ALERT_FAILED"
            });
        } catch (feedbackError) {
            console.error(
                `[ALERT] Failed to publish failure feedback:`,
                feedbackError.message
            );
        }

        return {
            alertRequired: true,
            alertId: alert.alertId,
            incidentId: incident.incidentId,
            status: "ALERT_FAILED",
            responseStatus: "ALERT_FAILED",
            message: alert.message
        };
    }

    // Feedback is a separate operation. Its failure must not
    // reverse a delivery that has already been marked SENT.
    try {
        await publishFeedback({
            requestId: incident.requestId,
            activityId: incident.activityId,
            incidentId: incident.incidentId,
            detectionType: incident.detections?.[0]?.type || "UNKNOWN",
            responseStatus: "ALERT_SENT"
        });
    } catch (feedbackError) {
        console.error(
            `[ALERT] Alert ${alert.alertId} was marked SENT, but feedback publishing failed:`,
            feedbackError.message
        );
    }

    return {
        alertRequired: true,
        alertId: alert.alertId,
        incidentId: incident.incidentId,
        correlationId: incident.correlationId,
        activityId: incident.activityId,
        correlationScore: incident.correlationScore,
        correlationConfidence: incident.correlationConfidence,
        requestId: incident.requestId,
        severity: incident.severity,
        sourceIp: incident.sourceIp,
        method: incident.method,
        path: incident.path,
        threatScore: incident.threatScore,
        status: "ALERT_SENT",
        responseStatus: "ALERT_SENT",
        message: alert.message
    };

};
