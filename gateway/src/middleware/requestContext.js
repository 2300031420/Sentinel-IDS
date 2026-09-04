import crypto from 'crypto';
export const requestContext= (req, res, next) => {
    const requestId = crypto.randomUUID();
    req.requestId = requestId;
    req.requestStartTime = Date.now();

    res.setHeader('X-Request-ID', requestId);
    next();
};
