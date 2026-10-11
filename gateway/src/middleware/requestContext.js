import crypto from "crypto";
import os from "os";

const HOST_ID = os.hostname();

export const requestContext = (req, res, next) => {
    // Never trust a client-supplied request ID.
    // SentinelIDS generates its own authoritative ID.
    const requestId = crypto.randomUUID();

    delete req.headers["x-request-id"];

    req.requestId = requestId;
    req.requestStartTime = Date.now();
    req.hostId = HOST_ID;

    res.setHeader(
        "X-Request-ID",
        requestId
    );

    next();
};