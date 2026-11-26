import "dotenv/config";
import pool from "./src/config/database.js";

const alertId = "8aa3b4f0-727c-438d-819f-7277e42446d9";
const incidentId = "7e5e13d7-de3a-42f7-bb51-fe8965ffafef";

try {
    const [result] = await pool.execute(
        `UPDATE alerts
         SET status = 'FAILED'
         WHERE alert_id = ?
           AND incident_id = ?
           AND status = 'SENT'`,
        [alertId, incidentId]
    );

    console.log("Rows changed:", result.affectedRows);

    const [rows] = await pool.execute(
        `SELECT alert_id, incident_id, status
         FROM alerts
         WHERE alert_id = ? AND incident_id = ?`,
        [alertId, incidentId]
    );

    console.table(rows);

    if (result.affectedRows !== 1 || rows[0]?.status !== "FAILED") {
        throw new Error("Test alert was not safely changed to FAILED.");
    }
} catch (error) {
    console.error("Retry preparation failed:", error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
