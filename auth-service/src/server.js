import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/authRoutes.js";
import pool from "./config/database.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4020;

// --------------------------------------------------
// SECURITY CONFIGURATION
// --------------------------------------------------

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is not configured");
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error("❌ JWT_SECRET must be at least 32 characters long");
  process.exit(1);
}

// --------------------------------------------------
// SECURITY HEADERS
// --------------------------------------------------

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// --------------------------------------------------
// CORS
// --------------------------------------------------

const allowedOrigins = [
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header
      // such as health checks or server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`[SECURITY] Blocked CORS origin: ${origin}`);

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// --------------------------------------------------
// REQUEST BODY LIMIT
// --------------------------------------------------

app.use(
  express.json({
    limit: "10kb",
  })
);

// --------------------------------------------------
// COOKIE PARSER
// --------------------------------------------------

app.use(cookieParser());

// --------------------------------------------------
// LOGIN RATE LIMITER
// --------------------------------------------------

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },

  handler: (req, res, next, options) => {
    console.warn(
      `[SECURITY] Login rate limit exceeded from ${req.ip}`
    );

    res.status(options.statusCode).json(options.message);
  },
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "SentinelIDS Auth Service",
    status: "running",
  });
});

// --------------------------------------------------
// DATABASE HEALTH CHECK
// --------------------------------------------------



// --------------------------------------------------
// AUTH ROUTES
// --------------------------------------------------

// Apply brute-force protection specifically
// to the login endpoint.
app.use("/api/auth/login", loginLimiter);

// Authentication routes
app.use("/api/auth", authRoutes);

// --------------------------------------------------
// CENTRALIZED ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error("[AUTH ERROR]", err.message);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `🔐 Auth Service running on http://localhost:${PORT}`
  );
});