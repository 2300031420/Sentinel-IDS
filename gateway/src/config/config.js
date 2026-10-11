import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.GATEWAY_PORT || 4000);
const targetUrl =
    process.env.TARGET_URL || "http://localhost:5000";

// --------------------------------------------------
// CONFIGURATION VALIDATION
// --------------------------------------------------

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(
        `[CONFIG] Invalid GATEWAY_PORT: ${process.env.GATEWAY_PORT}`
    );
}

try {
    const parsedTarget = new URL(targetUrl);

    if (!["http:", "https:"].includes(parsedTarget.protocol)) {
        throw new Error("Unsupported protocol");
    }
} catch {
    throw new Error(
        `[CONFIG] Invalid TARGET_URL: ${targetUrl}`
    );
}

export const config = {
    port,
    targetUrl
};