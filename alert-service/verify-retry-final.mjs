import "dotenv/config";
import pool from "./src/config/database.js";

const incidentId = "7e5e13d7-de3a-42f7-bb51-fe8965ffafef";

try {
    const [rows] = await pool.execute(
        `SELECT alert_id, incident_id, request_id, status, channel
         FROM alerts
         WHERE incident_id = ?`,
        [incidentId]
    );

    console.table(rows);
    console.log("Total alerts for test incident:", rows.length);
    console.log(
        "Retry verification:",
        rows.length === 1 && rows[0].status === "SENT"
            ? "PASS"
            : "CHECK REQUIRED"
    );
} catch (error) {
    console.error("Verification failed:", error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
