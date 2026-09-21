"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

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

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  setError("");
  setLoading(true);

  try {
    const response = await fetch("http://localhost:4020/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email: email.trim(),
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Invalid credentials. Please verify your access details."
      );
    }

    router.push("/");
  } catch (error) {
    console.error("Login error:", error);

    setError(
      error instanceof Error
        ? error.message
        : "Unable to connect to authentication service."
    );
  } finally {
    setLoading(false);
  }
};

  return (
    <main
      className={`${sans.variable} ${mono.variable} relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07090D] px-5 text-slate-200 antialiased`}
    >
      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/[0.035] blur-[120px]" />

      <div className="relative z-10 w-full max-w-[430px]">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] shadow-[0_0_30px_rgba(52,211,153,0.06)]">
            <svg
              width="30"
              height="30"
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

              <circle
                cx="15"
                cy="14"
                r="3.2"
                stroke="currentColor"
                strokeWidth="1.6"
              />

              <path
                d="M15 17.5v3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
            SentinelIDS
          </h1>

          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Intrusion Detection & Response
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0C0F14]/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400">
              Security Operations
            </p>

            <h2 className="mt-2 text-lg font-semibold text-white">
              Sign in to console
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Authenticate to access the SentinelIDS security dashboard.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-slate-500"
              >
                Email Address
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="analyst@sentinelids.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.025] px-3.5 text-sm text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-emerald-400/40 focus:bg-white/[0.04] focus:ring-2 focus:ring-emerald-400/[0.06]"
              />
            </div>

            {/* Password */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="font-mono text-[10px] uppercase tracking-wider text-slate-500"
                >
                  Password
                </label>

                <span className="font-mono text-[9px] text-slate-700">
                  SECURE ACCESS
                </span>
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.025] px-3.5 pr-12 text-sm text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-emerald-400/40 focus:bg-white/[0.04] focus:ring-2 focus:ring-emerald-400/[0.06]"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 transition hover:text-slate-300"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                      <path d="M9.9 4.2A10.8 10.8 0 0112 4c5 0 8.7 3.5 10 8-0.5 1.8-1.5 3.4-2.8 4.6" />
                      <path d="M6.1 6.1C4.6 7.2 3.4 9 2 12c1.3 4.5 5 8 10 8 1.4 0 2.7-.3 3.9-.8" />
                    </svg>
                  ) : (
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember */}
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-white/10 bg-white/[0.03] accent-emerald-400"
                />

                <span className="text-xs text-slate-500">
                  Remember this device
                </span>
              </label>

              <span className="font-mono text-[9px] text-slate-700">
                MFA READY
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-400/15 bg-red-400/[0.05] px-3.5 py-3">
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />

                  <p className="font-mono text-[10px] leading-relaxed text-red-300">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/15 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border border-emerald-400/30 border-t-emerald-400" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          {/* Security status */}
          <div className="mt-7 border-t border-white/[0.06] pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />

                <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
                  Security Gateway
                </span>
              </div>

              <span className="font-mono text-[9px] text-emerald-500/60">
                OPERATIONAL
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="font-mono text-[9px] uppercase tracking-wider text-slate-700">
            SentinelIDS Security Console
          </p>

          <p className="mt-1 font-mono text-[9px] text-slate-800">
            Protected environment • Authorized access only
          </p>
        </div>
      </div>
    </main>
  );
}