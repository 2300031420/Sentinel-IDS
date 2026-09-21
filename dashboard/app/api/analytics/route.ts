import { NextResponse } from "next/server";

export async function GET() {
    const alertServiceUrl = process.env.ALERT_SERVICE_URL;
    const apiKey = process.env.ALERT_API_KEY;

    if (!alertServiceUrl || !apiKey) {
        console.error("[ANALYTICS API] Environment variables missing");

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
            `${alertServiceUrl}/api/analytics`,
            {
                method: "GET",
                headers: {
                    "x-api-key": apiKey,
                },
                cache: "no-store",
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "[ANALYTICS API] Alert service error:",
                data
            );

            return NextResponse.json(
                {
                    success: false,
                    message: "Failed to fetch analytics",
                },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error(
            "[ANALYTICS API] Request failed:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Analytics service unavailable",
            },
            { status: 503 }
        );
    }
}