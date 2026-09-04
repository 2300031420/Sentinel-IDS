import { NextRequest, NextResponse } from "next/server";

const ALERT_SERVICE_URL =
  process.env.ALERT_SERVICE_URL || "http://localhost:4010";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const { alertId } = await params;

    const response = await fetch(
      `${ALERT_SERVICE_URL}/api/alerts/${alertId}/acknowledge`,
      {
        method: "PATCH",
        headers: {
          "x-api-key": process.env.ALERT_API_KEY || "",
        },
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error(
      "[DASHBOARD API] Failed to acknowledge alert:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to reach alert service",
      },
      { status: 500 }
    );
  }
}