"use client";

import type { PathData } from "../../services/analytics";

interface TopPathsProps {
    data: PathData[];
}

export default function TopPaths({
    data,
}: TopPathsProps) {
    const maxCount = Math.max(
        ...data.map((item) => item.count),
        1
    );

    return (
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <div className="mb-5">
                <h2 className="text-sm font-semibold text-white">
                    Top Targeted Paths
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                    Endpoints receiving the most malicious requests
                </p>
            </div>

            {data.length === 0 ? (
                <div className="flex h-[240px] items-center justify-center text-xs text-slate-500">
                    No targeted paths available
                </div>
            ) : (
                <div className="space-y-4">
                    {data.map((item, index) => {
                        const percentage =
                            (item.count / maxCount) * 100;

                        return (
                            <div key={`${item.path}-${index}`}>
                                <div className="mb-1.5 flex items-center justify-between gap-4">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className="w-4 shrink-0 font-mono text-[10px] text-slate-600">
                                            {String(index + 1).padStart(
                                                2,
                                                "0"
                                            )}
                                        </span>

                                        <span
                                            className="truncate font-mono text-xs text-slate-300"
                                            title={item.path}
                                        >
                                            {item.path}
                                        </span>
                                    </div>

                                    <span className="shrink-0 font-mono text-xs text-slate-400">
                                        {item.count}
                                    </span>
                                </div>

                                <div className="ml-7 h-1.5 overflow-hidden rounded-full bg-white/5">
                                    <div
                                        className="h-full rounded-full bg-orange-400/80 transition-all"
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