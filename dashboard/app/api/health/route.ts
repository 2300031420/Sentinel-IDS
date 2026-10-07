import { NextResponse } from "next/server";
import net from "node:net";

export const dynamic = "force-dynamic";

type ServiceStatus = {
  name: string;
  status: "ONLINE" | "OFFLINE";
  latency: number | null;
  endpoint: string;
  error?: string;
};

const checkHttpService = async (
  name: string,
  url: string
): Promise<ServiceStatus> => {
  const start = Date.now();

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      return {
        name,
        status: "OFFLINE",
        latency,
        endpoint: url,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      name,
      status: "ONLINE",
      latency,
      endpoint: url,
    };
  } catch (error) {
    return {
      name,
      status: "OFFLINE",
      latency: null,
      endpoint: url,
      error:
        error instanceof Error
          ? error.message
          : "Connection failed",
    };
  }
};

const checkTcpService = (
  name: string,
  host: string,
  port: number
): Promise<ServiceStatus> => {
  return new Promise((resolve) => {
    const start = Date.now();

    const socket = new net.Socket();

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(3000);

    socket.once("connect", () => {
      const latency = Date.now() - start;

      cleanup();

      resolve({
        name,
        status: "ONLINE",
        latency,
        endpoint: `${host}:${port}`,
      });
    });

    socket.once("timeout", () => {
      cleanup();

      resolve({
        name,
        status: "OFFLINE",
        latency: null,
        endpoint: `${host}:${port}`,
        error: "Connection timeout",
      });
    });

    socket.once("error", (error) => {
      cleanup();

      resolve({
        name,
        status: "OFFLINE",
        latency: null,
        endpoint: `${host}:${port}`,
        error: error.message,
      });
    });

    socket.connect(port, host);
  });
};

export async function GET() {
  const checkedAt = new Date().toISOString();

  const [
    gateway,
    server,
    redis,
    mysql,
    alertService,
  ] = await Promise.all([
    checkHttpService(
      "Gateway",
      "http://localhost:4000/health"
    ),

    checkHttpService(
      "Threat Engine",
      "http://localhost:5000/health"
    ),

    checkTcpService(
      "Event Bus",
      "127.0.0.1",
      6379
    ),

    checkTcpService(
      "Incident Store",
      "127.0.0.1",
      3306
    ),

    checkHttpService(
      "Alert Service",
      "http://localhost:4010/health"
    ),
  ]);

  const services = [
    gateway,
    redis,
    server,
    mysql,
    alertService,
  ];

  const onlineCount = services.filter(
    (service) => service.status === "ONLINE"
  ).length;

  return NextResponse.json({
    success: true,

    status:
      onlineCount === services.length
        ? "OPERATIONAL"
        : "DEGRADED",

    online: onlineCount,

    total: services.length,

    checkedAt,

    services,
  });
}