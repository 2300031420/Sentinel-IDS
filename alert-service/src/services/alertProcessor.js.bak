import pool from "../config/database.js";

export const markProcessing = async (alertId) => {
    const query = `
        UPDATE alerts
        SET status = 'PROCESSING'
        WHERE alert_id = ?
    `;

    await pool.execute(query, [alertId]);

    console.log(
        `[ALERT] ${alertId} → PROCESSING`
    );
};


export const markSent = async (alertId) => {
    const query = `
        UPDATE alerts
        SET
            status = 'SENT',
            sent_at = CURRENT_TIMESTAMP
        WHERE alert_id = ?
    `;

    await pool.execute(query, [alertId]);

    console.log(
        `[ALERT] ${alertId} → SENT`
    );
};


export const markFailed = async (alertId) => {
    const query = `
        UPDATE alerts
        SET status = 'FAILED'
        WHERE alert_id = ?
    `;

    await pool.execute(query, [alertId]);

    console.log(
        `[ALERT] ${alertId} → FAILED`
    );
};
export const markAcknowledged = async (alertId) => {
    const query = `
        UPDATE alerts
        SET
            status = 'ACKNOWLEDGED',
            acknowledged_at = CURRENT_TIMESTAMP
        WHERE alert_id = ?
    `;

    await pool.execute(query, [alertId]);

    console.log(
        `[ALERT] ${alertId} → ACKNOWLEDGED`
    );
};