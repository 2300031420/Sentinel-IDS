const RESPONSE_SEVERITY = {
    HIGH: 3,
    CRITICAL: 4
};

export const shouldMitigate = (incident) => {
    if (!incident) {
        return false;
    }

    const severity =
        String(incident.severity || "").toUpperCase();

    return (
        RESPONSE_SEVERITY[severity] >=
        RESPONSE_SEVERITY.HIGH
    );
};