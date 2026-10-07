import os from "os";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/*
 * Calculate real CPU utilization.
 *
 * This works on Windows because it uses
 * os.cpus() instead of os.loadavg().
 */
const getCpuUsage = async () => {
    const start = os.cpus();

    await new Promise((resolve) =>
        setTimeout(resolve, 100)
    );

    const end = os.cpus();

    let idleDifference = 0;
    let totalDifference = 0;

    for (let i = 0; i < start.length; i++) {
        const startTimes = start[i].times;
        const endTimes = end[i].times;

        const startTotal =
            startTimes.user +
            startTimes.nice +
            startTimes.sys +
            startTimes.idle +
            startTimes.irq;

        const endTotal =
            endTimes.user +
            endTimes.nice +
            endTimes.sys +
            endTimes.idle +
            endTimes.irq;

        idleDifference +=
            endTimes.idle - startTimes.idle;

        totalDifference +=
            endTotal - startTotal;
    }

    if (totalDifference === 0) {
        return 0;
    }

    return Number(
        (
            ((totalDifference - idleDifference) /
                totalDifference) *
            100
        ).toFixed(2)
    );
};

/*
 * Get the actual number of running processes
 * on Windows.
 */
const getProcessCount = async () => {
    try {
        const { stdout } = await execAsync(
            'powershell -NoProfile -Command "(Get-Process).Count"'
        );

        return Number(stdout.trim()) || 0;
    } catch (error) {
        console.error(
            "[TELEMETRY] Process count error:",
            error.message
        );

        return 0;
    }
};

/*
 * Collect host telemetry.
 */
export const collectSystemTelemetry = async () => {
    const cpuUsage = await getCpuUsage();

    const processCount = await getProcessCount();

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    const memoryUsage = Number(
        (
            ((totalMemory - freeMemory) /
                totalMemory) *
            100
        ).toFixed(2)
    );

    return {
        telemetryId: crypto.randomUUID(),

        hostId: os.hostname(),

        telemetryType: "HOST_METRICS",

        timestamp: new Date().toISOString(),

        cpuUsage,

        memoryUsage,

        processCount,

        platform: os.platform(),

        architecture: os.arch()
    };
};