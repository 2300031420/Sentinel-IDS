import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
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

    const token = `${timestamp}.${signature}`;

    console.log(
        `[SOCKET AUTH] Token generated at ${timestamp}`
    );

    return NextResponse.json({
        success: true,
        token,
    });
}