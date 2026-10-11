
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import pool from "./config/database.js";

dotenv.config();

const name = process.env.ADMIN_NAME;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!name || !email || !password) {
    throw new Error(
        "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD must be configured"
    );
}

if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters");
}

try {
    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await pool.execute(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES (?, ?, ?, ?)`,
        [name, email, passwordHash, "admin"]
    );

    console.log(`Admin user created with ID ${result.insertId}`);
} catch (error) {
    console.error(
        "Admin creation failed:",
        error.code || "DB_ERROR"
    );

    process.exitCode = 1;
} finally {
    await pool.end();
}
