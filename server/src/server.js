import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectionDatabase } from "./config/db.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        name: "SentinelIDS",
        version: "1.0.0",
        status: "running"
    });
});

app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString()
    });
});

const startServer = async () => {
    await connectionDatabase();

    app.listen(PORT, () => {
        console.log(`SentinelIDS server running on port ${PORT}`);
    });
};

startServer();