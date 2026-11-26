
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const secret = process.env.ALERT_API_KEY;

  if (!secret) {
    console.error("[SOCKET AUTH] ALERT_API_KEY is missing");

    return NextResponse.json(
      {
        success: false,
        message: "Socket authentication is not configured",
      },
      { status: 500 }
    );
  }

  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(timestamp)
    .digest("hex");

  return NextResponse.json(
    {
      success: true,
      token: `${timestamp}.${signature}`,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
      },
    }
  );
}
