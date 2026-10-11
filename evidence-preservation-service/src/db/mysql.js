
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const required = [
    "MYSQL_HOST",
    "MYSQL_USER",
    "MYSQL_PASSWORD",
    "MYSQL_DATABASE"
];

for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`[EVIDENCE] Missing required environment variable: ${key}`);
    }
}

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 50,
    connectTimeout: 10000
});

pool.on("connection", () => {
    console.log("[EVIDENCE] MySQL connection established");
});

export default pool;
