import type { CrossLayerAnalytics as CrossLayerAnalyticsData } from "../../services/analytics";

interface Props {
    data: CrossLayerAnalyticsData;
}

const confidenceStyles: Record<string, string> = {
    HIGH: "border-red-500/20 bg-red-500/10 text-red-300",
    MEDIUM: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    LOW: "border-slate-500/20 bg-slate-500/10 text-slate-400",
};

const severityStyles: Record<string, string> = {
    CRITICAL: "text-red-300",
    HIGH: "text-orange-300",
    MEDIUM: "text-amber-300",
    LOW: "text-slate-400",
};

export default function CrossLayerAnalytics({ data }: Props) {
    return (
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-medium text-cyan-400">
                        Cross-Layer Correlation
                    </p>

                    <h3 className="mt-1 text-lg font-semibold text-white">
                        Attack Activity Correlation
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                        Correlated activity across detection and incident layers
                    </p>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        Avg. Correlation
                    </p>

                    <p className="mt-1 text-lg font-semibold text-white">
                        {data.averageCorrelationScore}
                        <span className="ml-1 text-xs font-normal text-slate-500">
                            / 100
                        </span>
                    </p>
                </div>
            </div>

            {/* Summary */}
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <SummaryCard
                    label="Activity Records"
                    value={data.totalActivities}
                />

                <SummaryCard
                    label="High Confidence"
                    value={data.highConfidence}
                    valueClass="text-red-300"
                />

                <SummaryCard
                    label="Medium Confidence"
                    value={data.mediumConfidence}
                    valueClass="text-amber-300"
                />

                <SummaryCard
                    label="Low Confidence"
                    value={data.lowConfidence}
                    valueClass="text-slate-400"
                />
            </div>

            {/* Activity table */}
            <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left">
                        <thead className="border-b border-white/10 bg-white/[0.02]">
                            <tr>
                                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Activity
                                </th>

                                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Source
                                </th>

                                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Severity
                                </th>

                                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Threat
                                </th>

                                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Correlation
                                </th>

                                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Confidence
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-white/5">
                            {data.activities.slice(0, 10).map((activity) => (
                                <tr
                                    key={`${activity.incidentId}-${activity.requestId}`}
                                    className="transition-colors hover:bg-white/[0.02]"
                                >
                                    <td className="px-4 py-3">
                                        <div className="max-w-[180px]">
                                            <p className="truncate text-xs font-medium text-slate-200">
                                                {activity.activityId || "—"}
                                            </p>

                                            <p className="mt-1 truncate text-[10px] text-slate-600">
                                                Incident:{" "}
                                                {activity.incidentId}
                                            </p>
                                        </div>
                                    </td>

                                    <td className="px-4 py-3">
                                        <span className="font-mono text-xs text-slate-400">
                                            {activity.sourceIp || "—"}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3">
                                        <span
                                            className={`text-xs font-semibold ${
                                                severityStyles[
                                                    activity.severity
                                                ] || "text-slate-400"
                                            }`}
                                        >
                                            {activity.severity}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3">
                                        <span className="text-xs font-semibold text-white">
                                            {activity.threatScore ?? 0}
                                        </span>
                                        <span className="ml-1 text-[10px] text-slate-600">
                                            /100
                                        </span>
                                    </td>

                                    <td className="px-4 py-3">
                                        <span className="text-xs font-semibold text-white">
                                            {activity.correlationScore ?? 0}
                                        </span>
                                        <span className="ml-1 text-[10px] text-slate-600">
                                            /100
                                        </span>
                                    </td>

                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-medium ${
                                                confidenceStyles[
                                                    activity
                                                        .correlationConfidence ||
                                                        "LOW"
                                                ] ||
                                                confidenceStyles.LOW
                                            }`}
                                        >
                                            {activity.correlationConfidence ||
                                                "LOW"}
                                        </span>
                                    </td>
                                </tr>
                            ))}

                            {data.activities.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-4 py-10 text-center text-sm text-slate-600"
                                    >
                                        No correlated activity records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {data.activities.length > 10 && (
                <p className="mt-3 text-center text-[10px] text-slate-600">
                    Showing the 10 most recent activity records
                </p>
            )}
        </section>
    );
}

function SummaryCard({
    label,
    value,
    valueClass = "text-white",
}: {
    label: string;
    value: number;
    valueClass?: string;
}) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-600">
                {label}
            </p>

            <p className={`mt-1 text-xl font-semibold ${valueClass}`}>
                {value}
            </p>
        </div>
    );
}