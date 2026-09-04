import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";

import { config } from "./config/config.js";
import { requestContext } from "./middleware/requestContext.js";
import { trafficLogger } from "./middleware/trafficLogger.js";

const app = express();

app.use(cors());

app.use(requestContext);

app.use(trafficLogger);

app.use(
    "/",
    createProxyMiddleware({
        target: config.targetUrl,
        changeOrigin: true,

        on: {
            proxyReq: (proxyReq, req) => {
                console.log(
                    `[GATEWAY] ${req.method} ${req.originalUrl}`
                );
            },

            proxyRes: (proxyRes, req) => {
                console.log(
                    `[GATEWAY] Response ${proxyRes.statusCode} ${req.method} ${req.originalUrl}`
                );
            },

            error: (err) => {
                console.error(
                    `[GATEWAY] Proxy error: ${err.message}`
                );
            }
        }
    })
);

app.listen(config.port, () => {
    console.log(
        `SentinelIDS Gateway running on port ${config.port}`
    );

    console.log(
        `Forwarding traffic to ${config.targetUrl}`
    );
});