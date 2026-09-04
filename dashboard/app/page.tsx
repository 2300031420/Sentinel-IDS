"use client";

import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

// Two-typeface system: a clean grotesk for structure/copy, and a true
// monospace for anything that reads like a log line (IPs, paths, IDs,
// timestamps). The mono face is doing real work here, not decoration —
// it's how this data is read in every packet-inspection tool it echoes.
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

type Alert = {
  alert_id: string;
  incident_id: string;
  request_id: string;
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
};

type AlertsResponse = {
  success: boolean;
  count: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    severity: string | null;
    status: string | null;
  };
  alerts: Alert[];
};

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const SEVERITY_STYLES: Record<
  string,
  { label: string; text: string; dot: string; bar: string; ring: string }
> = {
  CRITICAL: {
    label: "Critical",
    text: "text-red-400",
    dot: "bg-red-500",
    bar: "bg-red-500",
    ring: "ring-red-500/30",
  },
  HIGH: {
    label: "High",
    text: "text-orange-400",
    dot: "bg-orange-500",
    bar: "bg-orange-500",
    ring: "ring-orange-500/30",
  },
  MEDIUM: {
    label: "Medium",
    text: "text-amber-400",
    dot: "bg-amber-400",
    bar: "bg-amber-400",
    ring: "ring-amber-400/30",
  },
  LOW: {
    label: "Low",
    text: "text-sky-400",
    dot: "bg-sky-500",
    bar: "bg-sky-500",
    ring: "ring-sky-500/30",
  },
};

const FALLBACK_STYLE = {
  label: "Info",
  text: "text-slate-400",
  dot: "bg-slate-500",
  bar: "bg-slate-500",
  ring: "ring-slate-500/30",
};

function severityStyle(severity: string) {
  return SEVERITY_STYLES[severity] ?? FALLBACK_STYLE;
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch("/api/alerts");

        if (!response.ok) {
          throw new Error("Failed to fetch alerts");
        }

        const data: AlertsResponse = await response.json();

        setAlerts(data.alerts);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        console.error("[DASHBOARD] Failed to load alerts:", err);
        setError("Couldn't reach the alerts feed. Retrying won't help until the service is back up.");
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  useEffect(() => {
    let socket: ReturnType<typeof io> | null = null;

    const connectSocket = async () => {
        try {
            const response = await fetch("/api/socket-token");

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
            });

            socket.on("connect", () => {
                console.log(
                    "[DASHBOARD] Socket.IO connected:",
                    socket?.id
                );
            });

            socket.on("connect_error", (error) => {
                console.error(
                    "[DASHBOARD] Socket.IO authentication failed:",
                    error.message
                );
            });

            socket.on("new-alert", (data) => {
                console.log("[DASHBOARD] New alert received:", data);

                if (data?.alert) {
                    setAlerts((currentAlerts) => [
                        data.alert,
                        ...currentAlerts,
                    ]);

                    setLastUpdated(new Date());
                }
            });

            socket.on("disconnect", () => {
                console.log("[DASHBOARD] Socket.IO disconnected");
            });
        } catch (error) {
            console.error(
                "[DASHBOARD] Failed to connect Socket.IO:",
                error
            );
        }
    };

    connectSocket();

    return () => {
        socket?.disconnect();
    };
}, []);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(
        `/api/alerts/${alertId}/acknowledge`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        throw new Error("Failed to acknowledge alert");
      }

      setAlerts((currentAlerts) =>
        currentAlerts.map((alert) =>
          alert.alert_id === alertId
            ? {
                ...alert,
                status: "ACKNOWLEDGED",
                acknowledged_at: new Date().toISOString(),
              }
            : alert
        )
      );

      setLastUpdated(new Date());
    } catch (error) {
      console.error("[DASHBOARD] Failed to acknowledge alert:", error);
    }
  };

  const counts = useMemo(() => {
    const base: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const alert of alerts) {
      if (base[alert.severity] !== undefined) base[alert.severity] += 1;
    }
    return base;
  }, [alerts]);

  const total = alerts.length;

  const highestActiveSeverity = useMemo(() => {
    return SEVERITY_ORDER.find((sev) => counts[sev] > 0) ?? null;
  }, [counts]);

  const visibleAlerts = useMemo(() => {
    if (activeFilter === "ALL") return alerts;
    return alerts.filter((a) => a.severity === activeFilter);
  }, [alerts, activeFilter]);

  const topBarStyle = highestActiveSeverity
    ? severityStyle(highestActiveSeverity)
    : null;

  return (
    <main
      className={`${sans.variable} ${mono.variable} min-h-screen bg-[#0A0C10] font-sans text-slate-200 antialiased`}
    >
      {/* Status rail — reflects the most severe class currently active */}
      <div
        className={`h-[2px] w-full transition-colors duration-500 ${
          topBarStyle ? topBarStyle.bar : "bg-white/[0.06]"
        }`}
      />

      {/* Faint radar-grid backdrop, purely atmospheric, kept very quiet */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative">
        {/* Header */}
        <header className="border-b border-white/[0.06] px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg width="26" height="26" viewBox="0 0 30 30" fill="none" className="text-emerald-400">
                <path
                  d="M15 2.5L26 7v8.2c0 6.6-4.6 11-11 12.3-6.4-1.3-11-5.7-11-12.3V7l11-4.5z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <circle cx="15" cy="14" r="3.2" stroke="currentColor" strokeWidth="1.6" />
              </svg>

              <div>
                <h1 className="text-[16px] font-semibold tracking-tight text-white">
                  SentinelIDS
                </h1>
                <p className="font-mono text-[11px] text-slate-500">
                  Intrusion detection · live feed
                </p>
              </div>
            </div>

            <div className="flex items-center gap-5">
              {lastUpdated && (
                <span className="hidden font-mono text-[11px] text-slate-500 sm:inline">
                  synced {lastUpdated.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              )}

              <div className="flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className="font-mono text-[11px] font-medium text-slate-400">
                  monitoring
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Severity summary strip — one bordered instrument, not four cards */}
        <section className="px-6 pt-6 sm:px-8">
          <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.015] sm:grid-cols-4 sm:divide-y-0">
            {SEVERITY_ORDER.map((sev) => {
              const style = severityStyle(sev);
              const share = total > 0 ? counts[sev] / total : 0;

              return (
                <div key={sev} className="px-5 py-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[12px] text-slate-500">{style.label}</p>
                    <p className={`font-mono text-[22px] font-semibold leading-none ${style.text}`}>
                      {counts[sev]}
                    </p>
                  </div>
                  <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className={`h-full rounded-full ${style.bar} transition-all duration-500`}
                      style={{ width: `${Math.max(share * 100, counts[sev] > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Alerts */}
        <section className="px-6 pb-10 pt-6 sm:px-8">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-white">Alerts</h2>
              <p className="text-[13px] text-slate-500">
                {total} event{total === 1 ? "" : "s"} in the current window
              </p>
            </div>

            <div className="flex flex-wrap gap-x-5 border-b border-white/[0.06] sm:border-b-0">
              {["ALL", ...SEVERITY_ORDER].map((sev) => {
                const isActive = activeFilter === sev;
                const style = sev === "ALL" ? null : severityStyle(sev);
                return (
                  <button
                    key={sev}
                    onClick={() => setActiveFilter(sev)}
                    className={`relative pb-2.5 font-mono text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                      isActive ? "text-white" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {sev === "ALL" ? "all" : sev.toLowerCase()}
                    <span
                      className={`absolute inset-x-0 -bottom-px h-[2px] rounded-full transition-opacity ${
                        isActive ? `opacity-100 ${style?.bar ?? "bg-white"}` : "opacity-0"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.015]">
            {loading ? (
              <div className="flex min-h-40 items-center justify-center">
                <p className="font-mono text-[13px] text-slate-500">loading alerts…</p>
              </div>
            ) : error ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-1.5 px-6 text-center">
                <p className="text-[13px] font-medium text-slate-300">{error}</p>
                <p className="font-mono text-[12px] text-slate-500">
                  check that the alerts service is running on port 4010
                </p>
              </div>
            ) : visibleAlerts.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-1">
                <p className="text-[13px] text-slate-300">Nothing here.</p>
                <p className="text-[12px] text-slate-500">
                  No {activeFilter === "ALL" ? "" : activeFilter.toLowerCase() + " "}alerts in the current window.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {visibleAlerts.map((alert) => {
                  const style = severityStyle(alert.severity);
                  const ts = formatTimestamp(alert.created_at);
                  const acknowledged = alert.status === "ACKNOWLEDGED";

                  return (
                    <div
                      key={alert.alert_id}
                      className="relative cursor-pointer pl-4 transition-colors hover:bg-white/[0.02]"
                      onClick={() => setSelectedAlert(alert)}
                    >
                      <span className={`absolute inset-y-0 left-0 w-[3px] ${style.bar}`} />

                      <div className="flex items-start justify-between gap-6 px-4 py-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className={`flex items-center gap-1.5 font-mono text-[11px] font-semibold ${style.text}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                              {alert.severity}
                            </span>

                            <span className="font-mono text-[11px] text-slate-600">
                              {acknowledged ? "acknowledged" : "open"}
                            </span>

                            {alert.threatScore !== null && (
                              <span className="font-mono text-[11px] text-slate-500">
                                score {alert.threatScore}
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-[13.5px] leading-snug text-slate-200">{alert.message}</p>

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-slate-500">
                            {alert.method && <span className="text-slate-400">{alert.method}</span>}
                            {alert.path && <span className="truncate">{alert.path}</span>}
                            {alert.sourceIp && (
                              <span className="text-slate-600">
                                from <span className="text-slate-400">{alert.sourceIp}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <div className="text-right">
                            <p className="font-mono text-[12px] text-slate-400">{ts.time}</p>
                            <p className="font-mono text-[11px] text-slate-600">{ts.date}</p>
                          </div>

                          {!acknowledged && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                acknowledgeAlert(alert.alert_id);
                              }}
                              className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            className={`w-full max-w-2xl rounded-xl border border-white/[0.08] bg-[#0D0F14] shadow-2xl ring-1 ${severityStyle(selectedAlert.severity).ring}`}
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className={`h-1.5 w-1.5 rounded-full ${severityStyle(selectedAlert.severity).dot}`} />
                <div>
                  <h3 className="text-[15px] font-semibold text-white">Alert details</h3>
                  <p className="mt-0.5 font-mono text-[10.5px] text-slate-500">{selectedAlert.alert_id}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedAlert(null)}
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-white/[0.05] hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal content */}
            <div className="max-h-[70vh] overflow-y-auto p-6">
              <dl className="grid grid-cols-3 gap-x-4 gap-y-3 border-b border-white/[0.06] pb-5">
                <div>
                  <dt className="text-[11px] text-slate-500">Severity</dt>
                  <dd className={`mt-1 text-[13px] font-semibold ${severityStyle(selectedAlert.severity).text}`}>
                    {selectedAlert.severity}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">Status</dt>
                  <dd className="mt-1 text-[13px] font-semibold text-slate-200">{selectedAlert.status}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">Threat score</dt>
                  <dd className="mt-1 font-mono text-[13px] font-semibold text-slate-200">
                    {selectedAlert.threatScore ?? "—"} / 100
                  </dd>
                </div>
              </dl>

              <div className="border-b border-white/[0.06] py-5">
                <p className="mb-3 text-[11px] font-medium text-slate-500">Request</p>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] text-slate-500">Source IP</dt>
                    <dd className="mt-1 font-mono text-[12px] text-slate-200">
                      {selectedAlert.sourceIp ?? "Unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">Method</dt>
                    <dd className="mt-1 font-mono text-[12px] text-slate-200">
                      {selectedAlert.method ?? "Unknown"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] text-slate-500">Path</dt>
                    <dd className="mt-1 break-all font-mono text-[12px] text-slate-200">
                      {selectedAlert.path ?? "Unknown"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="border-b border-white/[0.06] py-5">
                <p className="mb-3 text-[11px] font-medium text-slate-500">Message</p>
                <p className="text-[13px] leading-relaxed text-slate-300">{selectedAlert.message}</p>
              </div>

              <div className="py-5">
                <p className="mb-3 text-[11px] font-medium text-slate-500">Correlation</p>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] text-slate-500">Incident ID</dt>
                    <dd className="mt-1 break-all font-mono text-[11px] text-slate-300">
                      {selectedAlert.incident_id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">Request ID</dt>
                    <dd className="mt-1 break-all font-mono text-[11px] text-slate-300">
                      {selectedAlert.request_id}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-[11px] text-slate-500">Channel</p>
                  <p className="mt-1 text-[12px] text-slate-300">{selectedAlert.channel}</p>
                </div>

                {selectedAlert.status !== "ACKNOWLEDGED" && (
                  <button
                    onClick={async (event) => {
                      event.stopPropagation();
                      await acknowledgeAlert(selectedAlert.alert_id);
                      setSelectedAlert((current) =>
                        current
                          ? {
                              ...current,
                              status: "ACKNOWLEDGED",
                              acknowledged_at: new Date().toISOString(),
                            }
                          : null
                      );
                    }}
                    className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
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