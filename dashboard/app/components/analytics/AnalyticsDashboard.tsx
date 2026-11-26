"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CrossLayerAnalytics from "./CrossLayerAnalytics";
import {
    fetchAnalytics,
    type AnalyticsData,
} from "../../services/analytics";

import ThreatActivity from "./ThreatActivity";
import AttackTypes from "./AttackTypes";
import SeverityDistribution from "./SeverityDistribution";
import TopAttackers from "./TopAttackers";
import TopPaths from "./TopPaths";

function formatRelativeTime(date: Date | null) {
    if (!date) return "—";

    const seconds = Math.floor(
        (Date.now() - date.getTime()) / 1000
    );

    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
}

export default function AnalyticsDashboard() {
    const [analytics, setAnalytics] =
        useState<AnalyticsData | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(
        null
    );
    const [connected, setConnected] = useState(false);

    // Forces the relative-time label to re-render every few seconds
    // without re-fetching data.
    const [, setTick] = useState(0);

    const loadAnalytics = useCallback(
        async (showLoading = false) => {
            try {
                if (showLoading) {
                    setLoading(true);
                } else {
                    setRefreshing(true);
                }

                setError(null);

                const data = await fetchAnalytics();

                setAnalytics(data);
                setLastUpdated(new Date());
            } catch (error) {
                console.error(
                    "[ANALYTICS] Failed to load:",
                    error
                );

                setError(
                    "Unable to load threat analytics"
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        []
    );

    /*
     * Initial analytics load.
     */
    useEffect(() => {
        loadAnalytics(true);
    }, [loadAnalytics]);

    /*
     * Keep the "updated Xs ago" label ticking.
     */
    useEffect(() => {
        const interval = setInterval(
            () => setTick((t) => t + 1),
            1000 * 15
        );

        return () => clearInterval(interval);
    }, []);

    /*
     * Refresh analytics whenever a new alert
     * is received through Socket.IO.
     */
    useEffect(() => {
        let socket: ReturnType<typeof io> | null = null;
        let mounted = true;

        const connectSocket = async () => {
            try {
                const response = await fetch(
                    "/api/socket-token",
                    {
                        cache: "no-store",
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        "Failed to obtain socket token"
                    );
                }

                const data = await response.json();

                if (
                    !data.success ||
                    !data.token
                ) {
                    throw new Error(
                        "Invalid socket authentication response"
                    );
                }

                if (!mounted) {
                    return;
                }

                socket = io(
                    "http://localhost:4010",
                    {
                        auth: {
                            token: data.token,
                        },
                        reconnection: true,
                        reconnectionAttempts: 5,
                        reconnectionDelay: 1000,
                    }
                );

                socket.on("connect", () => {
                    console.log(
                        "[ANALYTICS] Socket.IO connected"
                    );
                    if (mounted) setConnected(true);
                });

                socket.on(
                    "new-alert",
                    () => {
                        console.log(
                            "[ANALYTICS] New alert received — refreshing analytics"
                        );

                        loadAnalytics();
                    }
                );

                socket.on(
                    "connect_error",
                    (error) => {
                        console.error(
                            "[ANALYTICS] Socket connection failed:",
                            error.message
                        );
                        if (mounted) setConnected(false);
                    }
                );

                socket.on("disconnect", () => {
                    console.log(
                        "[ANALYTICS] Socket.IO disconnected"
                    );
                    if (mounted) setConnected(false);
                });
            } catch (error) {
                console.error(
                    "[ANALYTICS] Socket setup failed:",
                    error
                );
                if (mounted) setConnected(false);
            }
        };

        connectSocket();

        return () => {
            mounted = false;
            socket?.disconnect();
        };
    }, [loadAnalytics]);

    const StatusBadge = () => (
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
                {(refreshing || connected) && (
                    <span
                        className={`absolute inline-flex h-full w-full animate-ping rounded-full ${refreshing
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                            } opacity-75`}
                    />
                )}
                <span
                    className={`relative inline-flex h-1.5 w-1.5 rounded-full ${refreshing
                            ? "bg-amber-400"
                            : connected
                                ? "bg-emerald-400"
                                : "bg-slate-600"
                        }`}
                />
            </span>

            <span className="text-xs font-medium text-slate-400">
                {refreshing
                    ? "Updating"
                    : connected
                        ? "Live"
                        : "Reconnecting"}
            </span>

            {lastUpdated && !refreshing && (
                <>
                    <span className="h-3 w-px bg-white/10" />
                    <span className="text-xs text-slate-500">
                        {formatRelativeTime(lastUpdated)}
                    </span>
                </>
            )}
        </div>
    );

    if (loading) {
        return (
            <section className="space-y-5">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-3 w-40 animate-pulse rounded bg-white/5" />
                        <div className="h-6 w-56 animate-pulse rounded bg-white/[0.07]" />
                    </div>
                    <div className="h-7 w-28 animate-pulse rounded-full bg-white/5" />
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {Array.from({ length: 5 }).map(
                        (_, index) => (
                            <div
                                key={index}
                                className="h-[340px] animate-pulse rounded-2xl border border-white/10 bg-slate-950/70"
                                style={{
                                    animationDelay: `${index * 80
                                        }ms`,
                                }}
                            />
                        )
                    )}
                </div>
            </section>
        );
    }

    if (error || !analytics) {
        return (
            <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-red-400" />

                        <div>
                            <h2 className="text-sm font-semibold text-red-300">
                                Analytics unavailable
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                {error ||
                                    "No analytics data available right now."}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => loadAnalytics(true)}
                        className="flex-shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/20"
                    >
                        Retry
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-medium text-emerald-400">
                        Threat Intelligence
                    </p>

                    <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
                        Security Analytics
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                        Real-time threat activity and attack analysis
                    </p>
                </div>

                <StatusBadge />
            </div>

            <div
                className={`grid grid-cols-1 gap-5 lg:grid-cols-2 transition-opacity duration-300 ${refreshing ? "opacity-90" : "opacity-100"
                    }`}
            >
                <ThreatActivity
                    data={analytics.threatActivity}
                />

                <AttackTypes
                    data={analytics.attackTypes}
                />

                <SeverityDistribution
                    data={analytics.severity}
                />

                <TopAttackers
                    data={analytics.topSourceIps}
                />

                <TopPaths
                    data={analytics.topPaths}
                />

                <CrossLayerAnalytics
                    data={analytics.crossLayer}
                />
            </div>
        </section>
    );
}