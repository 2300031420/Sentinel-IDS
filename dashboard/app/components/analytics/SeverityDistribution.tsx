"use client";

import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
} from "recharts";

import type { SeverityData } from "../../services/analytics";

interface SeverityDistributionProps {
    data: SeverityData[];
}

const SEVERITY_COLORS: Record<string, string> = {
    CRITICAL: "#ef4444",
    HIGH: "#f97316",
    MEDIUM: "#eab308",
    LOW: "#22c55e",
};

export default function SeverityDistribution({
    data,
}: SeverityDistributionProps) {
    const total = data.reduce(
        (sum, item) => sum + item.count,
        0
    );

    return (
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <div className="mb-4">
                <h2 className="text-sm font-semibold text-white">
                    Severity Distribution
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                    Alert severity breakdown
                </p>
            </div>

            {data.length === 0 ? (
                <div className="flex h-[240px] items-center justify-center text-xs text-slate-500">
                    No severity data available
                </div>
            ) : (
                <>
                    <div className="relative h-[220px]">
                        <ResponsiveContainer
                            width="100%"
                            height="100%"
                        >
                            <PieChart>
                                <Pie
                                    data={data}
                                    dataKey="count"
                                    nameKey="severity"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={85}
                                    paddingAngle={3}
                                >
                                    {data.map((entry) => (
                                        <Cell
                                            key={entry.severity}
                                            fill={
                                                SEVERITY_COLORS[
                                                    entry.severity
                                                ] || "#64748b"
                                            }
                                        />
                                    ))}
                                </Pie>

                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#020617",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "10px",
                                        fontSize: "11px",
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>

                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-semibold text-white">
                                {total}
                            </span>

                            <span className="text-[10px] uppercase tracking-wider text-slate-500">
                                Total Alerts
                            </span>
                        </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {data.map((item) => (
                            <div
                                key={item.severity}
                                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className="h-2 w-2 rounded-full"
                                        style={{
                                            backgroundColor:
                                                SEVERITY_COLORS[
                                                    item.severity
                                                ] || "#64748b",
                                        }}
                                    />

                                    <span className="text-[11px] text-slate-400">
                                        {item.severity}
                                    </span>
                                </div>

                                <span className="font-mono text-xs font-medium text-white">
                                    {item.count}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}