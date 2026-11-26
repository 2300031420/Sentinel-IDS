"use client";

import type { SourceIpData } from "../../services/analytics";

interface TopAttackersProps {
    data: SourceIpData[];
}

export default function TopAttackers({
    data,
}: TopAttackersProps) {
    const maxCount = Math.max(
        ...data.map((item) => item.count),
        1
    );

    return (
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <div className="mb-5">
                <h2 className="text-sm font-semibold text-white">
                    Top Attackers
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                    Source IPs generating the most alerts
                </p>
            </div>

            {data.length === 0 ? (
                <div className="flex h-[240px] items-center justify-center text-xs text-slate-500">
                    No attacker data available
                </div>
            ) : (
                <div className="space-y-4">
                    {data.map((item, index) => {
                        const percentage =
                            (item.count / maxCount) * 100;

                        return (
                            <div key={item.sourceIp}>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="w-4 font-mono text-[10px] text-slate-600">
                                            {String(index + 1).padStart(
                                                2,
                                                "0"
                                            )}
                                        </span>

                                        <span className="font-mono text-xs text-slate-300">
                                            {item.sourceIp}
                                        </span>
                                    </div>

                                    <span className="font-mono text-xs text-slate-400">
                                        {item.count}
                                    </span>
                                </div>

                                <div className="ml-7 h-1.5 overflow-hidden rounded-full bg-white/5">
                                    <div
                                        className="h-full rounded-full bg-red-400/80 transition-all"
                                        style={{
                                            width: `${percentage}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}