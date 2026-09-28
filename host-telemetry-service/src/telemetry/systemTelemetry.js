import os from 'os';
import crypto from "crypto";
export const collectSystemTelemetry = () => {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
    const cpuUsage = os.loadavg()[0];
    const cpuCount = os.cpus().length;

    const normalizedCpuUsage = (cpuUsage / cpuCount) * 100;

    return {
        telemetryId: crypto.randomUUID(),
        hostId: os.hostname(),
        telemetryType: "HOST_METRICS",
        timestamp: new Date().toISOString(),

        cpuUsage: Number(normalizedCpuUsage.toFixed(2)),
        memoryUsage: Number(memoryUsage.toFixed(2)),
        processCount: os.cpus().length,

        platform: os.platform(),
        architecture: os.arch()
    };
}