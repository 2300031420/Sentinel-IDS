
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];

for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`[SERVER] Missing required environment variable: ${key}`);
    }
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 50,
    connectTimeout: 10000
});

export const connectionDatabase = async () => {
    try {
        const connection = await pool.getConnection();
        connection.release();
        console.log("[SERVER] MySQL connected successfully");
    } catch (error) {
        console.error("[SERVER] MySQL connection failed:", error.code || "DB_ERROR");
        throw error;
    }
};

export { pool };
