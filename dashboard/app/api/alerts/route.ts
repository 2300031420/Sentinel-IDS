import { NextRequest, NextResponse } from "next/server";

const ALERT_SERVICE_URL =
  process.env.ALERT_SERVICE_URL || "http://localhost:4010";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.search;

    const response = await fetch(
      `${ALERT_SERVICE_URL}/api/alerts${query}`,
      {
        headers: {
          "x-api-key": process.env.ALERT_API_KEY || "",
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("[DASHBOARD API] Failed to fetch alerts:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to reach alert service",
      },
      { status: 500 }
    );
  }
}