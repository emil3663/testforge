import type { ExecutionRecord } from "./types";

export function buildPerformanceReport(records: ExecutionRecord[], duration: number) {
    const executedRecords = records.filter((record) => record.status !== "Blocked");
    const averageDuration = executedRecords.length === 0
        ? 0
        : Math.round(
            executedRecords.reduce((total, record) => total + record.duration, 0) /
            executedRecords.length
        );
    const throughput = duration === 0
        ? 0
        : Number(((executedRecords.length / duration) * 60000).toFixed(2));
    const slowestTests = [...records]
        .sort((left, right) => right.duration - left.duration)
        .slice(0, 5)
        .map((record) => ({
            title: record.title,
            browser: record.browser,
            area: record.area,
            duration: record.duration,
        }));
    const performanceTests = records.filter((record) => record.area === "Performance");

    return {
        totalDuration: duration,
        averageDuration,
        throughput,
        slowestTests,
        pageResponseTimes: performanceTests.map((record) => ({
            title: record.title,
            duration: record.duration,
            browser: record.browser,
        })),
        resourceUtilization: "CPU and memory utilization are not captured in the current browser-only runner.",
        scalability: "Scalability conclusions require dedicated load tooling such as Lighthouse or JMeter alongside this suite.",
    };
}
