import pool from "../config/database.js";

export const findUserByEmail = async (email) => {
  const [rows] = await pool.query(
    `SELECT id, name, email, password_hash, role, is_active
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  return rows[0] || null;
};

export const createUser = async ({
  name,
  email,
  passwordHash,
  role = "analyst",
}) => {
  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES (?, ?, ?, ?)`,
    [name, email, passwordHash, role]
  );

  return result.insertId;
};