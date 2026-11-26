
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";

const ALERT_SERVICE_URL =
  process.env.ALERT_SERVICE_URL || "http://localhost:4010";

export async function GET(request: NextRequest) {
  // Authenticate before accessing analytics.
  const auth = await requireAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const apiKey = process.env.ALERT_API_KEY;

  if (!apiKey) {
    console.error("[ANALYTICS API] Alert service configuration missing");

    return NextResponse.json(
      {
        success: false,
        message: "Analytics service is not configured",
      },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${ALERT_SERVICE_URL}/api/analytics`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      console.error(
        "[ANALYTICS API] Alert service returned status:",
        response.status
      );

      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch analytics",
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    console.error("[ANALYTICS API] Alert service request failed");

    return NextResponse.json(
      {
        success: false,
        message: "Analytics service unavailable",
      },
      { status: 503 }
    );
  }
}