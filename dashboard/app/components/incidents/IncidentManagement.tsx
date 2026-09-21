"use client";

import { useEffect, useState } from "react";

type Detection = {
    detected: boolean;
    type: string;
    severity: string;
    score: number;
    description: string;
    evidence: unknown;
};

type Incident = {
    incident_id: string;
    request_id: string;
    severity: string;
    threatScore: number;
    sourceIp: string | null;
    method: string | null;
    path: string | null;
    detections: Detection[] | null;
    created_at: string;
};

type IncidentsResponse = {
    success: boolean;
    count: number;
    incidents: Incident[];
};

const severityStyles: Record<string, string> = {
    CRITICAL: "text-red-400 bg-red-500/10 border-red-500/20",
    HIGH: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    LOW: "text-sky-400 bg-sky-500/10 border-sky-500/20",
};

export default function IncidentManagement() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadIncidents = async () => {
            try {
                const response = await fetch("/api/incidents", {
                    cache: "no-store",
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch incidents");
                }

                const data: IncidentsResponse = await response.json();

                if (!data.success) {
                    throw new Error("Incident request failed");
                }

                setIncidents(data.incidents ?? []);
            } catch (error) {
                console.error(
                    "[INCIDENTS] Failed to load incidents:",
                    error
                );

                setError("Unable to load incidents");
            } finally {
                setLoading(false);
            }
        };

        loadIncidents();
    }, []);

    if (loading) {
        return (
            <section className="rounded-lg border border-white/[0.07] bg-white/[0.015] p-6">
                <p className="font-mono text-xs text-slate-500">
                    loading incidents...
                </p>
            </section>
        );
    }

    if (error) {
        return (
            <section className="rounded-lg border border-red-500/20 bg-red-500/5 p-6">
                <p className="font-mono text-xs text-red-400">
                    {error}
                </p>
            </section>
        );
    }

    return (
        <section className="space-y-4">
            <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                    Incident Response
                </p>

                <h2 className="mt-1 text-xl font-semibold text-white">
                    Security Incidents
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                    Correlated threats detected by SentinelIDS.
                </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.015]">
                {incidents.length === 0 ? (
                    <div className="flex min-h-40 items-center justify-center">
                        <p className="font-mono text-xs text-slate-500">
                            No incidents detected
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.06]">
                        {incidents.map((incident) => {
                            const severityStyle =
                                severityStyles[incident.severity] ??
                                "text-slate-400 bg-slate-500/10 border-slate-500/20";

                            const attackTypes =
                                incident.detections
                                    ?.map((detection) => detection.type)
                                    .filter(Boolean)
                                    .filter(
                                        (type, index, array) =>
                                            array.indexOf(type) === index
                                    )
                                    .join(", ") || "Unknown";

                            return (
                                <div
                                    key={incident.incident_id}
                                    className="p-5 transition hover:bg-white/[0.02]"
                                >
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span
                                                    className={`rounded border px-2 py-1 font-mono text-[10px] font-semibold ${severityStyle}`}
                                                >
                                                    {incident.severity}
                                                </span>

                                                <span className="font-mono text-[10px] text-slate-600">
                                                    {incident.incident_id}
                                                </span>
                                            </div>

                                            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                <div>
                                                    <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                                                        Attack
                                                    </p>

                                                    <p className="mt-1 text-xs text-slate-300">
                                                        {attackTypes}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                                                        Source IP
                                                    </p>

                                                    <p className="mt-1 font-mono text-xs text-slate-300">
                                                        {incident.sourceIp ??
                                                            "Unknown"}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                                                        Request
                                                    </p>

                                                    <p className="mt-1 font-mono text-xs text-slate-300">
                                                        {incident.method ??
                                                            "—"}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                                                        Path
                                                    </p>

                                                    <p className="mt-1 truncate font-mono text-xs text-slate-300">
                                                        {incident.path ??
                                                            "Unknown"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="shrink-0 text-left lg:text-right">
                                            <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                                                Threat Score
                                            </p>

                                            <p className="mt-1 font-mono text-2xl font-semibold text-white">
                                                {incident.threatScore}
                                                <span className="text-xs text-slate-600">
                                                    {" "}
                                                    / 100
                                                </span>
                                            </p>

                                            <p className="mt-1 font-mono text-[10px] text-slate-600">
                                                {new Date(
                                                    incident.created_at
                                                ).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}