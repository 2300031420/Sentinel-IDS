import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import pool from "./config/database.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4020;

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "SentinelIDS Auth Service",
    status: "running",
  });
});

app.get("/health/db", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      database: "connected",
    });
  } catch (error) {
    console.error("Database error:", error);

    res.status(500).json({
      success: false,
      database: "disconnected",
    });
  }
});
app.use("/api/auth", authRoutes);

app.listen(PORT, () => {
  console.log(`🔐 Auth Service running on http://localhost:${PORT}`);
});