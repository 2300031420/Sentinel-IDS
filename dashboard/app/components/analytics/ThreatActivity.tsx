"use client";

import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

import type { ThreatActivityData } from "../../services/analytics";

interface ThreatActivityProps {
    data: ThreatActivityData[];
}

export default function ThreatActivity({
    data,
}: ThreatActivityProps) {
    const chartData = data.map((item) => ({
        ...item,
        averageScore: Number(item.averageScore),
        time: new Date(item.hour).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        }),
    }));

    return (
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-white">
                        Threat Activity
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                        Threat activity over time
                    </p>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    Threat Score
                </div>
            </div>

            {chartData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-xs text-slate-500">
                    No threat activity available
                </div>
            ) : (
                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient
                                    id="threatGradient"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stopOpacity={0.35}
                                    />
                                    <stop
                                        offset="100%"
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>

                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                strokeOpacity={0.08}
                            />

                            <XAxis
                                dataKey="time"
                                tick={{
                                    fontSize: 10,
                                }}
                                tickLine={false}
                                axisLine={false}
                                strokeOpacity={0.4}
                            />

                            <YAxis
                                domain={[0, 100]}
                                tick={{
                                    fontSize: 10,
                                }}
                                tickLine={false}
                                axisLine={false}
                                strokeOpacity={0.4}
                            />

                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#020617",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: "10px",
                                    fontSize: "11px",
                                }}
                                labelStyle={{
                                    color: "#94a3b8",
                                }}
                                formatter={(value) => [
                                    value,
                                    "Average Threat Score",
                                ]}
                            />

                            <Area
                                type="monotone"
                                dataKey="averageScore"
                                strokeWidth={2}
                                fill="url(#threatGradient)"
                                fillOpacity={1}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}