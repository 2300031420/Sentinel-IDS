export interface SeverityData {
    severity: string;
    count: number;
}

export interface StatusData {
    status: string;
    count: number;
}

export interface SourceIpData {
    sourceIp: string;
    count: number;
}

export interface PathData {
    path: string;
    count: number;
}

export interface AttackTypeData {
    attackType: string;
    count: number;
}

export interface ThreatActivityData {
    hour: string;
    alerts: number;
    averageScore: string | number;
    maxScore: number;
}

export interface CrossLayerActivity {
    activityId: string | null;
    correlationScore: number | null;
    correlationConfidence: string | null;
    incidentId: string;
    requestId: string;
    sourceIp: string | null;
    severity: string;
    threatScore: number | null;
    createdAt: string;
}

export interface CrossLayerAnalytics {
    totalActivities: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    averageCorrelationScore: number;
    activities: CrossLayerActivity[];
}

export interface AnalyticsData {
    severity: SeverityData[];
    status: StatusData[];
    topSourceIps: SourceIpData[];
    topPaths: PathData[];
    attackTypes: AttackTypeData[];
    threatActivity: ThreatActivityData[];
    crossLayer: CrossLayerAnalytics;
}

export interface AnalyticsResponse {
    success: boolean;
    analytics: AnalyticsData;
}

export const fetchAnalytics = async (): Promise<AnalyticsData> => {
    const response = await fetch("/api/analytics");

    if (!response.ok) {
        throw new Error("Failed to fetch analytics");
    }

    const data: AnalyticsResponse = await response.json();

    if (!data.success) {
        throw new Error("Analytics request failed");
    }

    return data.analytics;
};