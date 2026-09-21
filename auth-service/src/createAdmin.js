import bcrypt from "bcrypt";
import pool from "./config/database.js";

const name = "Sentinel Admin";
const email = "admin@sentinelids.com";
const password = "Admin@sentinel2005";

try {
  const passwordHash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES (?, ?, ?, ?)`,
    [name, email, passwordHash, "admin"]
  );

  console.log("✅ Admin user created");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);

  process.exit(0);
} catch (error) {
  console.error("❌ Failed to create admin:", error.message);
  process.exit(1);
}