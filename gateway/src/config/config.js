import dotenv from "dotenv";

dotenv.config();

export const config = {
    port: process.env.GATEWAY_PORT || 4000,
    targetUrl: process.env.TARGET_URL || "http://localhost:5000"
};