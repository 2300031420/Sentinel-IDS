import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";

const ALERT_SERVICE_URL =
  process.env.ALERT_SERVICE_URL || "http://localhost:4010";

export async function GET(request: NextRequest) {
  // Require a valid authenticated session before accessing alerts.
  const auth = await requireAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const apiKey = process.env.ALERT_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        message: "Alert service is not configured",
      },
      { status: 500 }
    );
  }

  try {
    const query = request.nextUrl.search;

    const response = await fetch(
      `${ALERT_SERVICE_URL}/api/alerts${query}`,
      {
        headers: {
          "x-api-key": apiKey,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    console.error("[DASHBOARD API] Failed to fetch alerts");

    return NextResponse.json(
      {
        success: false,
        message: "Failed to reach alert service",
      },
      { status: 502 }
    );
  }
}
