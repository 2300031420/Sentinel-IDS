export const evaluateFeedback = (feedback) => {
    if (!feedback) {
        return {
            outcome: "UNKNOWN",
            adjustment: 0
        };
    }

    if (feedback.responseStatus === "BLOCKED") {
        return {
            outcome: "SUCCESS",
            adjustment: 1
        };
    }

    if (feedback.responseStatus === "ALLOWED") {
        return {
            outcome: "FAILURE",
            adjustment: -1
        };
    }

    if (feedback.responseStatus === "ALERT_SENT") {
        return {
            outcome: "ALERT_DELIVERED",
            adjustment: 0
        };
    }

    if (feedback.responseStatus === "ALERT_FAILED") {
        return {
            outcome: "ALERT_DELIVERY_FAILED",
            adjustment: 0
        };
    }

    return {
        outcome: "UNKNOWN",
        adjustment: 0
    };
};