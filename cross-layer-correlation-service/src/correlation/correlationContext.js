const contexts = new Map();

const WINDOW_MS =
    Number(process.env.CORRELATION_WINDOW_MS) || 60000;

export const createContext = (activityId) => {
    if (!contexts.has(activityId)) {
        contexts.set(activityId, {
            activityId,

            webObservations: [],
            hostObservations: [],

            firstSeen: Date.now(),
            lastSeen: Date.now(),

            correlationScore: 0,
            confidence: "LOW"
        });
    }

    return contexts.get(activityId);
};

export const getContext = (activityId) => {
    return contexts.get(activityId) || null;
};

export const addWebObservation = (
    activityId,
    observation
) => {
    const context = createContext(activityId);

    context.webObservations.push({
        ...observation,
        timestamp: observation.timestamp || new Date().toISOString()
    });

    context.lastSeen = Date.now();

    return context;
};

export const addHostObservation = (
    activityId,
    observation
) => {
    const context = createContext(activityId);

    context.hostObservations.push({
        ...observation,
        timestamp: observation.timestamp || new Date().toISOString()
    });

    context.lastSeen = Date.now();

    return context;
};

export const removeExpiredContexts = () => {
    const now = Date.now();

    for (const [activityId, context] of contexts.entries()) {
        if (now - context.lastSeen > WINDOW_MS) {
            contexts.delete(activityId);
        }
    }
};

export const getAllContexts = () => {
    return contexts;
};