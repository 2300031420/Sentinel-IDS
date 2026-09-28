"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation"; import { io } from "socket.io-client";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import AnalyticsDashboard from "./components/analytics/AnalyticsDashboard";
;
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

type Detection = {
  detected: boolean;
  type: string;
  severity: string;
  score: number;
  description: string;
  evidence: string;
};

type Alert = {
  alert_id: string;
  incident_id: string;
  request_id: string;

  activity_id: string | null;
  correlation_score: number | null;
  correlation_confidence: string | null;

  severity: string;
  channel: string;
  status: string;
  message: string;
  sourceIp: string | null;
  method: string | null;
  path: string | null;
  threatScore: number | null;
  created_at: string;
  sent_at: string | null;
  acknowledged_at: string | null;
  updated_at: string;
  detections?: Detection[];
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type AlertsResponse = {
  success: boolean;
  count: number;
  pagination: Pagination;
  alerts: Alert[];
};

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

const severityConfig: Record<
  string,
  {
    label: string;
    text: string;
    bg: string;
    border: string;
    dot: string;
  }
> = {
  CRITICAL: {
    label: "Critical",
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    dot: "bg-red-500",
  },
  HIGH: {
    label: "High",
    text: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    dot: "bg-orange-500",
  },
  MEDIUM: {
    label: "Medium",
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    dot: "bg-amber-400",
  },
  LOW: {
    label: "Low",
    text: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    dot: "bg-sky-500",
  },
};

function getSeverity(severity: string) {
  return (
    severityConfig[severity] ?? {
      label: severity,
      text: "text-slate-400",
      bg: "bg-slate-500/10",
      border: "border-slate-500/20",
      dot: "bg-slate-500",
    }
  );
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(timestamp: string) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const response = await fetch(
          "http://localhost:4020/api/auth/me",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          router.push("/login");
          return;
        }

        const data = await response.json();

        if (!data.success) {
          router.push("/login");
          return;
        }

        setAuthChecked(true);
      } catch (error) {
        console.error("[AUTH] Authentication check failed:", error);
        router.push("/login");
      }
    };

    checkAuthentication();
  }, [router]);

  /*
   * Load a page of alerts. page 1 replaces the list (initial load /
   * refresh); later pages append, for "load more".
   */
  const fetchAlerts = useCallback(async (page: number) => {
    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await fetch(`/api/alerts?page=${page}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch alerts");
      }

      const data: AlertsResponse = await response.json();

      setAlerts((current) =>
        page === 1 ? data.alerts ?? [] : [...current, ...(data.alerts ?? [])]
      );
      setPagination(data.pagination ?? null);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("[DASHBOARD] Failed to load alerts:", err);
      setError("Unable to reach the alert feed.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!authChecked) return;

    fetchAlerts(1);
  }, [fetchAlerts, authChecked]);

  /*
   * Live Socket.IO connection.
   */
  useEffect(() => {
    if (!authChecked) return;
    let socket: ReturnType<typeof io> | null = null;

    const connectSocket = async () => {
      try {
        const response = await fetch("/api/socket-token", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to obtain socket token");
        }

        const data = await response.json();

        if (!data.success || !data.token) {
          throw new Error("Invalid socket authentication response");
        }

        socket = io("http://localhost:4010", {
          auth: {
            token: data.token,
          },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        socket.on("connect", () => {
          console.log("[DASHBOARD] Socket.IO connected:", socket?.id);
          setSocketConnected(true);
        });

        socket.on("connect_error", (error) => {
          console.error(
            "[DASHBOARD] Socket.IO connection failed:",
            error.message
          );

          setSocketConnected(false);
        });

        socket.on("disconnect", () => {
          console.log("[DASHBOARD] Socket.IO disconnected");
          setSocketConnected(false);
        });

        socket.on("alert-acknowledged", (data) => {
          console.log("[DASHBOARD] Alert acknowledged:", data);

          setAlerts((current) =>
            current.map((alert) =>
              alert.alert_id === data.alertId
                ? {
                  ...alert,
                  status: "ACKNOWLEDGED",
                  acknowledged_at: data.acknowledgedAt,
                }
                : alert
            )
          );

          setSelectedAlert((current): Alert | null => {
            if (!current || current.alert_id !== data.alertId) {
              return current;
            }

            return {
              ...current,
              status: "ACKNOWLEDGED",
              acknowledged_at: data.acknowledgedAt,
            };
          });

          setLastUpdated(new Date());
        });

        socket.on("new-alert", (data) => {
          console.log("[DASHBOARD] New alert received:", data);

          if (data?.alert) {
            setAlerts((current) => [
              data.alert,
              ...current.filter(
                (alert) => alert.alert_id !== data.alert.alert_id
              ),
            ]);

            setLastUpdated(new Date());
          }
        });
      } catch (err) {
        console.error("[DASHBOARD] Failed to connect Socket.IO:", err);
      }
    };

    connectSocket();

    return () => {
      socket?.disconnect();
    };
  }, [authChecked]);

  /*
   * Close the alert modal on Escape, and move focus to its close
   * button when it opens.
   */
  useEffect(() => {
    if (!selectedAlert) return;

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedAlert(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAlert]);

  /*
   * Acknowledge alert.
   */
  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to acknowledge alert");
      }

      setAlerts((current) =>
        current.map((alert) =>
          alert.alert_id === alertId
            ? {
              ...alert,
              status: "ACKNOWLEDGED",
              acknowledged_at: new Date().toISOString(),
            }
            : alert
        )
      );

      setSelectedAlert((current) =>
        current?.alert_id === alertId
          ? {
            ...current,
            status: "ACKNOWLEDGED",
            acknowledged_at: new Date().toISOString(),
          }
          : current
      );

      setLastUpdated(new Date());
    } catch (err) {
      console.error("[DASHBOARD] Failed to acknowledge alert:", err);
    }
  };

  /*
   * Statistics.
   */
  const statistics = useMemo(() => {
    const result = {
      total: alerts.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      open: 0,
      acknowledged: 0,
    };

    for (const alert of alerts) {
      const severity = alert.severity.toLowerCase();

      if (severity === "critical") result.critical++;
      if (severity === "high") result.high++;
      if (severity === "medium") result.medium++;
      if (severity === "low") result.low++;

      if (alert.status === "ACKNOWLEDGED") {
        result.acknowledged++;
      } else {
        result.open++;
      }
    }

    return result;
  }, [alerts]);

  /*
   * Filter alerts.
   */
  const visibleAlerts = useMemo(() => {
    if (activeFilter === "ALL") {
      return alerts;
    }

    return alerts.filter((alert) => alert.severity === activeFilter);
  }, [alerts, activeFilter]);

  const canLoadMore = Boolean(
    pagination && pagination.page < pagination.totalPages
  );
  if (!authChecked) {
    return null;
  }
  return (
    <main
      className={`${sans.variable} ${mono.variable} min-h-screen bg-[#07090D] text-slate-200 antialiased`}
    >
      {/* Background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative mx-auto w-full max-w-[1500px]">
        {/* Header */}
        <header className="border-b border-white/[0.07] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/5">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 30 30"
                  fill="none"
                  className="text-emerald-400"
                >
                  <path
                    d="M15 2.5L26 7v8.2c0 6.6-4.6 11-11 12.3-6.4-1.3-11-5.7-11-12.3V7l11-4.5z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <circle cx="15" cy="14" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </div>

              <div>
                <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">
                  SentinelIDS
                </h1>

                <p className="font-mono text-[11px] text-slate-500">
                  Intrusion Detection & Response
                </p>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:gap-4 lg:w-auto lg:justify-end lg:gap-5">
              <div className="font-mono text-[11px] text-slate-500">
                {lastUpdated
                  ? `updated ${formatTime(lastUpdated.toISOString())}`
                  : "waiting for data"}
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${socketConnected
                    ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]"
                    : "bg-red-400"
                    }`}
                />

                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                  {socketConnected ? "Live" : "Offline"}
                </span>
              </div>
              <button
                onClick={async () => {
                  try {
                    await fetch("http://localhost:4020/api/auth/logout", {
                      method: "POST",
                      credentials: "include",
                    });
                  } catch (error) {
                    console.error("[AUTH] Logout failed:", error);
                  } finally {
                    router.push("/login");
                  }
                }}
                className="rounded-md border border-white/[0.08] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-400 transition hover:border-emerald-400/30 hover:text-emerald-300"
              >
                LogOut
              </button>
            </div>
          </div>
        </header>

        {/* System status */}
        <section className="px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
                Detection Engine
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-sm text-slate-300">Operational</span>
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
                Alert Service
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-sm text-slate-300">Port 4010</span>
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
                Real-time Feed
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${socketConnected ? "bg-emerald-400" : "bg-red-400"
                    }`}
                />

                <span className="text-sm text-slate-300">
                  {socketConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Threat overview */}
        <section className="px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.015] sm:grid-cols-3 lg:grid-cols-6">
            <div className="border-b border-white/[0.06] p-4 sm:p-5 lg:border-b-0 lg:border-r">
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
                Total
              </p>

              <p className="mt-2 font-mono text-2xl font-semibold text-white sm:mt-3 sm:text-3xl">
                {statistics.total}
              </p>
            </div>

            {SEVERITIES.map((severity) => {
              const style = getSeverity(severity);

              return (
                <div
                  key={severity}
                  className="border-b border-white/[0.06] p-4 sm:p-5 last:border-r-0 lg:border-b-0 lg:border-r"
                >
                  <p
                    className={`font-mono text-[10px] uppercase tracking-widest ${style.text}`}
                  >
                    {style.label}
                  </p>

                  <p className={`mt-2 font-mono text-2xl font-semibold sm:mt-3 sm:text-3xl ${style.text}`}>
                    {statistics[severity.toLowerCase() as keyof typeof statistics]}
                  </p>
                </div>
              );
            })}

            <div className="p-4 sm:p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
                Open
              </p>

              <p className="mt-2 font-mono text-2xl font-semibold text-white sm:mt-3 sm:text-3xl">
                {statistics.open}
              </p>
            </div>
          </div>
        </section>

        {/* Analytics */}
        <section className="px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
          <AnalyticsDashboard />
        </section>

        {/* Main content */}
        <section className="grid gap-5 px-4 pb-10 pt-5 sm:gap-6 sm:px-6 sm:pb-12 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
          {/* Alerts */}
          <div>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                  Security Events
                </p>

                <h2 className="mt-1 text-xl font-semibold text-white">
                  Live Alerts
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Real-time threats detected by SentinelIDS.
                </p>
              </div>

              <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
                {["ALL", ...SEVERITIES].map((filter) => {
                  const active = activeFilter === filter;
                  const count =
                    filter === "ALL"
                      ? statistics.total
                      : statistics[filter.toLowerCase() as keyof typeof statistics];

                  return (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`flex-1 rounded-md border px-2.5 py-2 font-mono text-[10px] uppercase tracking-wider transition focus-visible:outline sm:flex-none sm:px-3 sm:py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/60 ${active
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : "border-white/[0.07] text-slate-500 hover:border-white/[0.15] hover:text-slate-300"
                        }`}
                    >
                      {filter}
                      <span className="ml-1.5 text-slate-600">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.015]">
              {loading ? (
                <div className="divide-y divide-white/[0.06]">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="flex gap-4 px-5 py-4">
                      <div className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
                        <div className="h-4 w-2/3 animate-pulse rounded bg-white/[0.07]" />
                        <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="flex min-h-60 flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="text-sm text-slate-300">{error}</p>

                  <p className="font-mono text-xs text-slate-600">
                    Verify Alert Service :4010
                  </p>

                  <button
                    onClick={() => fetchAlerts(1)}
                    className="mt-1 rounded-md border border-white/[0.1] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-300 transition hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/60"
                  >
                    Retry
                  </button>
                </div>
              ) : visibleAlerts.length === 0 ? (
                <div className="flex min-h-60 flex-col items-center justify-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  </div>

                  <p className="mt-2 text-sm text-slate-300">No threats detected</p>

                  <p className="font-mono text-xs text-slate-600">
                    System is monitoring traffic
                  </p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-white/[0.06]">
                    {visibleAlerts.map((alert) => {
                      const style = getSeverity(alert.severity);

                      return (
                        <button
                          key={alert.alert_id}
                          onClick={() => setSelectedAlert(alert)}
                          className="group relative block w-full text-left transition hover:bg-white/[0.025] focus-visible:bg-white/[0.03] focus-visible:outline-none"
                        >
                          <span
                            className={`absolute inset-y-0 left-0 w-[3px] ${style.dot}`}
                          />

                          <div className="flex min-w-0 gap-3 px-4 py-4 pl-5 sm:gap-4 sm:px-5 sm:pl-6">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`font-mono text-[11px] font-semibold ${style.text}`}
                                >
                                  {alert.severity}
                                </span>

                                <span className="rounded border border-white/[0.07] px-2 py-0.5 font-mono text-[9px] text-slate-500">
                                  {alert.channel}
                                </span>

                                <span className="font-mono text-[10px] text-slate-600">
                                  {alert.status}
                                </span>
                              </div>

                              <p className="mt-2 truncate text-sm font-medium text-slate-200">
                                {alert.message}
                              </p>

                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-slate-600">
                                {alert.method && (
                                  <span className="text-slate-400">
                                    {alert.method}
                                  </span>
                                )}

                                {alert.path && (
                                  <span className="max-w-[min(70vw,400px)] truncate sm:max-w-[400px]">
                                    {alert.path}
                                  </span>
                                )}

                                {alert.sourceIp && (
                                  <span>
                                    {alert.sourceIp}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px]">
                                {alert.correlation_score !== null &&
                                  alert.correlation_score !== undefined && (
                                    <span className="text-slate-400">
                                      Correlation: {alert.correlation_score}
                                    </span>
                                  )}

                                {alert.correlation_confidence && (
                                  <span className="text-emerald-400">
                                    Confidence: {alert.correlation_confidence}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="hidden shrink-0 text-right md:block">
                              {alert.threatScore !== null && (
                                <>
                                  <p className={`font-mono text-sm font-semibold ${style.text}`}>
                                    {alert.threatScore}
                                  </p>
                                  <p className="font-mono text-[9px] uppercase tracking-wider text-slate-700">
                                    score
                                  </p>
                                </>
                              )}

                              <p className="mt-1 font-mono text-[10px] text-slate-600">
                                {formatTime(alert.created_at)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {canLoadMore && (
                    <div className="border-t border-white/[0.06] p-3 text-center">
                      <button
                        onClick={() => fetchAlerts((pagination?.page ?? 1) + 1)}
                        disabled={loadingMore}
                        className="rounded-md border border-white/[0.1] px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400 transition hover:border-white/20 hover:text-slate-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/60"
                      >
                        {loadingMore ? "Loading…" : "Load older alerts"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right panel */}
          <aside className="space-y-6">
            {/* System health */}
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.015]">
              <div className="border-b border-white/[0.06] px-5 py-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
                  Infrastructure
                </p>

                <h3 className="mt-1 font-semibold text-white">System Health</h3>
              </div>

              <div className="divide-y divide-white/[0.06]">
                {[
                  { name: "Gateway", value: "4000", healthy: true },
                  { name: "Event Bus", value: "Redis", healthy: true },
                  { name: "Threat Engine", value: "Active", healthy: true },
                  { name: "Incident Store", value: "MySQL", healthy: true },
                  { name: "Alert Service", value: "4010", healthy: true },
                ].map(({ name, value, healthy }) => (
                  <div key={name} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${healthy ? "bg-emerald-400" : "bg-red-400"
                          }`}
                      />

                      <span className="text-xs text-slate-400">{name}</span>
                    </div>

                    <span className="font-mono text-[10px] text-slate-600">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Response status */}
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.015] p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
                Response Queue
              </p>

              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="font-mono text-3xl font-semibold text-white">
                    {statistics.open}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">alerts requiring review</p>
                </div>

                <div className="text-right">
                  <p className="font-mono text-xl font-semibold text-emerald-400">
                    {statistics.acknowledged}
                  </p>

                  <p className="mt-1 text-[10px] text-slate-600">acknowledged</p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>

      {/* Alert details modal */}
      {selectedAlert && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-2 backdrop-blur-sm sm:p-4"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-modal-title"
            className="my-auto w-full max-w-2xl overflow-hidden rounded-xl border border-white/[0.09] bg-[#0C0F14] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                  Security Event
                </p>

                <h3 id="alert-modal-title" className="mt-1 font-semibold text-white">
                  Alert Investigation
                </h3>
              </div>

              <button
                ref={closeButtonRef}
                onClick={() => setSelectedAlert(null)}
                aria-label="Close alert details"
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-white/[0.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/60"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-4 sm:max-h-[75vh] sm:p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="font-mono text-[10px] text-slate-600">SEVERITY</p>

                  <p
                    className={`mt-1 text-sm font-semibold ${getSeverity(selectedAlert.severity).text
                      }`}
                  >
                    {selectedAlert.severity}
                  </p>
                </div>

                <div>
                  <p className="font-mono text-[10px] text-slate-600">THREAT SCORE</p>

                  <p className="mt-1 font-mono text-sm font-semibold text-white">
                    {selectedAlert.threatScore ?? "—"} / 100
                  </p>
                </div>

                <div>
                  <p className="font-mono text-[10px] text-slate-600">STATUS</p>

                  <p className="mt-1 text-sm font-semibold text-slate-300">
                    {selectedAlert.status}
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
                  Request
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] text-slate-600">Source IP</p>

                    <p className="mt-1 break-all font-mono text-xs text-slate-300">
                      {selectedAlert.sourceIp ?? "Unknown"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-600">Method</p>

                    <p className="mt-1 font-mono text-xs text-slate-300">
                      {selectedAlert.method ?? "Unknown"}
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-[10px] text-slate-600">Path</p>

                    <p className="mt-1 break-all font-mono text-xs text-slate-300">
                      {selectedAlert.path ?? "Unknown"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
                  Message
                </p>

                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  {selectedAlert.message}
                </p>
              </div>
              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
                  Correlation
                </p>

                <div className="mt-4 space-y-4">

                  {/* Alert ID */}
                  <div>
                    <p className="text-[10px] text-slate-600">
                      Alert ID
                    </p>

                    <p className="mt-1 break-all font-mono text-[11px] text-slate-300">
                      {selectedAlert.alert_id}
                    </p>
                  </div>

                  {/* Incident ID */}
                  <div>
                    <p className="text-[10px] text-slate-600">
                      Incident ID
                    </p>

                    <p className="mt-1 break-all font-mono text-[11px] text-slate-300">
                      {selectedAlert.incident_id}
                    </p>
                  </div>

                  {/* Request ID */}
                  <div>
                    <p className="text-[10px] text-slate-600">
                      Request ID
                    </p>

                    <p className="mt-1 break-all font-mono text-[11px] text-slate-300">
                      {selectedAlert.request_id}
                    </p>
                  </div>

                  {/* Activity ID */}
                  <div>
                    <p className="text-[10px] text-slate-600">
                      Activity ID
                    </p>

                    <p className="mt-1 break-all font-mono text-[11px] text-emerald-300">
                      {selectedAlert.activity_id ?? "—"}
                    </p>
                  </div>

                  {/* Correlation Metrics */}
                  <div className="grid gap-4 sm:grid-cols-2">

                    {/* Correlation Score */}
                    <div className="rounded-md border border-white/[0.06] bg-white/[0.015] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-slate-600">
                        Correlation Score
                      </p>

                      <p className="mt-1 font-mono text-lg font-semibold text-white">
                        {selectedAlert.correlation_score ?? 0}
                        <span className="ml-1 text-xs text-slate-600">
                          / 100
                        </span>
                      </p>
                    </div>

                    {/* Correlation Confidence */}
                    <div className="rounded-md border border-white/[0.06] bg-white/[0.015] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-slate-600">
                        Correlation Confidence
                      </p>

                      <p className="mt-1 font-mono text-lg font-semibold text-emerald-400">
                        {selectedAlert.correlation_confidence ?? "LOW"}
                      </p>
                    </div>

                  </div>

                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-[10px] text-slate-600">DETECTED</p>

                  <p className="mt-1 font-mono text-xs text-slate-400">
                    {formatDate(selectedAlert.created_at)} {formatTime(selectedAlert.created_at)}
                  </p>
                </div>

                {selectedAlert.status !== "ACKNOWLEDGED" && (
                  <button
                    onClick={() => acknowledgeAlert(selectedAlert.alert_id)}
                    className="w-full rounded-md border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 font-mono text-[11px] text-emerald-400 sm:w-auto transition hover:bg-emerald-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/60"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}