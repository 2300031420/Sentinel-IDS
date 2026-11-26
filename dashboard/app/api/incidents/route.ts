
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";

const ALERT_SERVICE_URL =
  process.env.ALERT_SERVICE_URL || "http://localhost:4010";

export async function GET(request: NextRequest) {
  // Authenticate the dashboard user before accessing incidents.
  const auth = await requireAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const apiKey = process.env.ALERT_API_KEY;

  if (!apiKey) {
    console.error("[INCIDENTS API] Alert service configuration missing");

    return NextResponse.json(
      {
        success: false,
        message: "Incident service is not configured",
      },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${ALERT_SERVICE_URL}/api/incidents`,
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
        "[INCIDENTS API] Alert service returned status:",
        response.status
      );

      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch incidents",
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
    console.error("[INCIDENTS API] Alert service request failed");

    return NextResponse.json(
      {
        success: false,
        message: "Incident service unavailable",
      },
      { status: 503 }
    );
  }
}
