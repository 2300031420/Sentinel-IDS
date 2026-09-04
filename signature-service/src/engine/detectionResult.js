export const createDetectionResult = ({
    detected = false,
    type = null,
    severity = null,
    score = 0,
    description = null,
    evidence = null
}) => {
    return {
        detected,
        type,
        severity,
        score,
        description,
        evidence
    };
};