
import mysql from "mysql2/promise";

const required = [
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME"
];

for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`Missing test database setting: ${key}`);
    }
}

const testPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 5,
    connectTimeout: 10000
});

export default testPool;
