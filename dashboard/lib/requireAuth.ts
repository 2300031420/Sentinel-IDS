
import { NextRequest, NextResponse } from "next/server";

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:4020";

export async function requireAuth(request: NextRequest) {
  const cookie = request.headers.get("cookie");

  if (!cookie) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  try {
    const response = await fetch(
      `${AUTH_SERVICE_URL}/api/auth/me`,
      {
        method: "GET",
        headers: { cookie },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { success: false, message: "Authentication required" },
          { status: 401 }
        ),
      };
    }

    const data = await response.json();

    if (!data.success || !data.user) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { success: false, message: "Authentication required" },
          { status: 401 }
        ),
      };
    }

    return { ok: true as const, user: data.user };
  } catch {
    console.error("[AUTH] Authentication service unavailable");

    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "Authentication service unavailable" },
        { status: 503 }
      ),
    };
  }
}
