const contexts = new Map();

const WINDOW_MS =
    Number(process.env.CORRELATION_WINDOW_MS) || 60000;

const getEventTime = (observation) => {
    if (!observation?.timestamp) {
        return Date.now();
    }

    const timestamp =
        new Date(observation.timestamp).getTime();

    return Number.isNaN(timestamp)
        ? Date.now()
        : timestamp;
};

export const createContext = (
    activityId,
    timestamp = null
) => {
    if (!contexts.has(activityId)) {
        const eventTime = timestamp
            ? getEventTime({ timestamp })
            : Date.now();

        contexts.set(activityId, {
            activityId,

            webObservations: [],
            hostObservations: [],

            firstSeen: eventTime,
            lastSeen: eventTime,

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
    const timestamp =
        observation.timestamp ||
        new Date().toISOString();

    const context = createContext(
        activityId,
        timestamp
    );

    const eventTime =
        getEventTime({ timestamp });

    context.webObservations.push({
        ...observation,
        timestamp
    });

    context.firstSeen =
        Math.min(
            context.firstSeen,
            eventTime
        );

    context.lastSeen =
        Math.max(
            context.lastSeen,
            eventTime
        );

    return context;
};

export const addHostObservation = (
    activityId,
    observation
) => {
    const timestamp =
        observation.timestamp ||
        new Date().toISOString();

    const context = createContext(
        activityId,
        timestamp
    );

    const eventTime =
        getEventTime({ timestamp });

    context.hostObservations.push({
        ...observation,
        timestamp
    });

    context.firstSeen =
        Math.min(
            context.firstSeen,
            eventTime
        );

    context.lastSeen =
        Math.max(
            context.lastSeen,
            eventTime
        );

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