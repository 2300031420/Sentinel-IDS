
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";

const ALERT_SERVICE_URL =
  process.env.ALERT_SERVICE_URL || "http://localhost:4010";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  const auth = await requireAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const apiKey = process.env.ALERT_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: "Alert service is not configured" },
      { status: 500 }
    );
  }

  try {
    const { alertId } = await params;

    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(alertId)) {
      return NextResponse.json(
        { success: false, message: "Invalid alert ID" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${ALERT_SERVICE_URL}/api/alerts/${encodeURIComponent(alertId)}/acknowledge`,
      {
        method: "PATCH",
        headers: { "x-api-key": apiKey },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.error("[DASHBOARD API] Failed to acknowledge alert");

    return NextResponse.json(
      { success: false, message: "Failed to reach alert service" },
      { status: 502 }
    );
  }
}
