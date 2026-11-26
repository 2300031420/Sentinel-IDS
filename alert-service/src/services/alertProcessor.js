import pool from "../config/database.js";


export const markProcessing = async (alertId) => {
    const query = `
        UPDATE alerts
        SET status = 'PROCESSING'
        WHERE alert_id = ?
          AND status IN ('PENDING', 'FAILED')
    `;

    const [result] = await pool.execute(query, [alertId]);

    if (result.affectedRows !== 1) {
        console.warn(
            `[ALERT] Could not claim ${alertId}; it may already be processing or terminal`
        );
        return false;
    }

    console.log(`[ALERT] ${alertId} → PROCESSING`);
    return true;
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