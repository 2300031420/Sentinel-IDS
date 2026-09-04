import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export const connectDatabase = async () => {
    try {
        const connection = await pool.getConnection();

        console.log("[INCIDENT] MySQL connected successfully");

        connection.release();
    } catch (error) {
        console.error(
            "[INCIDENT] MySQL connection failed:",
            error.message
        );

        process.exit(1);
    }
};

export default pool;