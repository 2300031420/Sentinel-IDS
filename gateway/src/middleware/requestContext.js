import crypto from "crypto";
import os from "os";

const HOST_ID = os.hostname();

export const requestContext = (req, res, next) => {
    const requestId = crypto.randomUUID();

    req.requestId = requestId;
    req.requestStartTime = Date.now();
    req.hostId = HOST_ID;

    res.setHeader(
        "X-Request-ID",
        requestId
    );

    next();
};