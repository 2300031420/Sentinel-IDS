import "dotenv/config";
import pool from "./src/config/database.js";

const requestId = "e2676997-5249-4782-ae71-a1212045abea";

try {
    const [rows] = await pool.execute(
        `SELECT i.incident_id, i.request_id, i.severity,
                a.alert_id, a.status AS alert_status
         FROM incidents i
         LEFT JOIN alerts a ON a.incident_id = i.incident_id
         WHERE i.request_id = ?`,
        [requestId]
    );

    console.table(rows);
    console.log(
        rows.length === 1 && rows[0].alert_id
            ? "END-TO-END TEST: PASS"
            : "END-TO-END TEST: INCIDENT OR ALERT NOT FOUND"
    );
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
