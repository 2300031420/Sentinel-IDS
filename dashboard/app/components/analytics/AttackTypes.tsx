"use client";

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

import type { AttackTypeData } from "../../services/analytics";

interface AttackTypesProps {
    data: AttackTypeData[];
}

export default function AttackTypes({
    data,
}: AttackTypesProps) {
    return (
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <div className="mb-5">
                <h2 className="text-sm font-semibold text-white">
                    Attack Types
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                    Detected attack signatures
                </p>
            </div>

            {data.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-xs text-slate-500">
                    No attack data available
                </div>
            ) : (
                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            layout="vertical"
                            margin={{
                                top: 5,
                                right: 20,
                                left: 10,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid
                                horizontal={false}
                                stroke="#334155"
                                strokeOpacity={0.25}
                                strokeDasharray="3 3"
                            />

                            <XAxis
                                type="number"
                                allowDecimals={false}
                                tick={{
                                    fontSize: 10,
                                    fill: "#64748b",
                                }}
                                tickLine={false}
                                axisLine={false}
                            />

                            <YAxis
                                type="category"
                                dataKey="attackType"
                                width={130}
                                tick={{
                                    fontSize: 10,
                                    fill: "#94a3b8",
                                    fontWeight: 500,
                                }}
                                tickLine={false}
                                axisLine={false}
                            />

                            <Tooltip
                                cursor={{
                                    fill: "rgba(56, 189, 248, 0.06)",
                                }}
                                contentStyle={{
                                    backgroundColor: "#0f172a",
                                    border: "1px solid rgba(56, 189, 248, 0.25)",
                                    borderRadius: "10px",
                                    fontSize: "11px",
                                    color: "#e2e8f0",
                                }}
                                labelStyle={{
                                    color: "#e2e8f0",
                                    fontWeight: 600,
                                    marginBottom: "4px",
                                }}
                                itemStyle={{
                                    color: "#38bdf8",
                                }}
                                formatter={(value) => [
                                    value,
                                    "Detections",
                                ]}
                            />

                            <Bar
                                dataKey="count"
                                fill="#38bdf8"
                                radius={[0, 5, 5, 0]}
                                barSize={22}
                                maxBarSize={24}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}