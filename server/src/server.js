
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.disable("x-powered-by");

app.use(
    cors({
        origin: "http://localhost:3000"
    })
);

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

app.listen(PORT, () => {
    console.log(`SentinelIDS server running on port ${PORT}`);
});
