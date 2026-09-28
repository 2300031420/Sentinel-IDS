import crypto from 'crypto';

export const generateCorrelationId = () => {
    return crypto.randomUUID();
};