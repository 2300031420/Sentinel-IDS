import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
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
        const connection =
            await pool.getConnection();

        console.log(
            "[ALERT] MySQL connected successfully"
        );

        connection.release();

    } catch (error) {
        console.error(
            "[ALERT] MySQL connection failed:",
            error.message
        );

        throw error;
    }
};

export default pool;