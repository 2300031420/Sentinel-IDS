import crypto from "crypto";

import pool from "../config/database.js";
import { publishFeedback } from "../publisher/feedbackPublisher.js";
import {
    markProcessing,
    markSent,
    markFailed
} from "./alertProcessor.js";

export const createAlert = async (incident) => {

    const alertId = crypto.randomUUID();

    const channel =
        incident.severity === "CRITICAL"
            ? "EMAIL"
            : "DASHBOARD";

    const message =
        `${incident.severity} security incident detected. ` +
        `Source IP: ${incident.sourceIp}, ` +
        `Path: ${incident.path}`;

    const query = `
    INSERT INTO alerts (
        alert_id,
        incident_id,
        request_id,
        activity_id,
        correlation_score,
        correlation_confidence,
        severity,
        channel,
        status,
        message
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

    const values = [
        alertId,
        incident.incidentId,
        incident.requestId,
        incident.activityId,
        incident.correlationScore,
        incident.correlationConfidence,
        incident.severity,
        channel,
        "PENDING",
        message
    ];

    try {

        await pool.execute(
            query,
            values
        );

        console.log(
            `[ALERT] Alert created: ${alertId}`
        );

        return {
            alertId,
            message
        };

    } catch (error) {

        if (error.code === "ER_DUP_ENTRY") {

            console.log(
                `[ALERT] Alert already exists for incident ${incident.incidentId}`
            );

            return null;
        }

        throw error;
    }
};


export const processIncident = async (incident) => {

    let alertRequired = false;

    if (incident.severity === "CRITICAL") {
        alertRequired = true;
    }

    if (incident.severity === "HIGH") {
        alertRequired = true;
    }

    if (!alertRequired) {

        console.log(
            `[ALERT] No immediate alert required for ${incident.incidentId}`
        );

        return {
            alertRequired: false
        };
    }

    console.log(
        `[ALERT] Alert required for ${incident.incidentId}`
    );

    const alertData =
        await createAlert(incident);

    // Alert already exists
    if (!alertData) {
        return {
            alertRequired: true,
            alertId: null
        };
    }

    try {

        // PENDING → PROCESSING
        await markProcessing(
            alertData.alertId
        );

        console.log(
            `[ALERT] Simulating alert delivery for ${alertData.alertId}`
        );

        // For now, we simulate successful delivery
        // Actual email/webhook will come later

        // PROCESSING → SENT
        await markSent(
            alertData.alertId
        );
        await publishFeedback({
            requestId: incident.requestId,
            activityId: incident.activityId,
            incidentId: incident.incidentId,

            detectionType:
                incident.detections?.[0]?.type || "UNKNOWN",

            responseStatus: "ALERT_SENT"
        });

        return {
            alertRequired: true,
            alertId: alertData.alertId,
            incidentId: incident.incidentId,
            correlationId: incident.correlationId,
            activityId:
                incident.activityId,

            correlationScore:
                incident.correlationScore,

            correlationConfidence:
                incident.correlationConfidence,


            requestId: incident.requestId,
            severity: incident.severity,
            sourceIp: incident.sourceIp,
            method: incident.method,
            path: incident.path,
            threatScore: incident.threatScore,
            status: "ALERT_SENT",
            responseStatus: "ALERT_SENT",
            message: alertData.message
        };

    } catch (error) {

        console.error(
            `[ALERT] Failed processing ${alertData.alertId}:`,
            error.message
        );

        // PROCESSING → FAILED
        await markFailed(
            alertData.alertId
        );
        await publishFeedback({
            requestId: incident.requestId,
            activityId: incident.activityId,
            incidentId: incident.incidentId,

            detectionType:
                incident.detections?.[0]?.type || "UNKNOWN",

            responseStatus: "ALERT_FAILED"
        });

        return {
            alertRequired: true,
            alertId: alertData.alertId,
            incidentId: incident.incidentId,
            correlationId: incident.correlationId,
            activityId:
                incident.activityId,

            correlationScore:
                incident.correlationScore,

            correlationConfidence:
                incident.correlationConfidence,
            requestId: incident.requestId,
            severity: incident.severity,
            sourceIp: incident.sourceIp,
            method: incident.method,
            path: incident.path,
            threatScore: incident.threatScore,
            status: "ALERT_FAILED",
            responseStatus: "ALERT_FAILED",
            message: alertData.message
        };
    }
};