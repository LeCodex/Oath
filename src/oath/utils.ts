class Metrics {
    time = 0;
    calls = 0;
    topmostCalls = 0;
    activeCalls = 0;
    maxDepth = 0;
    totalDepth = 0;
    depthCount = 0;

    get avgTime() {
        return this.time / this.topmostCalls;
    }

    get avgDepth() {
        return this.totalDepth / this.depthCount;
    }
}
const metrics: Record<string, Metrics> = {};

interface MethodRecorderOptions {
    useSubclassNames?: boolean
}

export function recordExecutionTime(options?: MethodRecorderOptions): MethodDecorator {
    return (target, name, descriptor) => {
        const method = descriptor.value;
        if (typeof method !== "function") throw TypeError("Can only record execution time of methods");
        descriptor.value = function (...args: any[]) {
            const prefixOrigin = options?.useSubclassNames ? this : target;
            return recordCallTime(`${typeof prefixOrigin === "function" ? prefixOrigin.name : prefixOrigin.constructor.name}.${name.toString()}`, method.bind(this) as (...args: any[]) => unknown, ...args);
        } as any;
        return descriptor;
    }
}
recordExecutionTime.skip = function (options?: MethodRecorderOptions): MethodDecorator {
    return (_1, _2, descriptor) => { return descriptor; }
}

export function recordCallback<Args extends Array<any>, Return>(key: string, callback: (...args: Args) => Return) {
    return (...args: Args) => {
        return recordCallTime(key, callback, ...args);
    }
}

export function recordCallTime<Args extends Array<any>, Return>(key: string, fn: (...args: Args) => Return, ...args: Args): Return {
    const metric = metrics[key] ??= new Metrics();
    metric.activeCalls++;
    metric.calls++;
    metric.maxDepth = Math.max(metric.activeCalls, metric.maxDepth);
    metric.totalDepth += metric.activeCalls;
    metric.depthCount++;
    let result;
    if (metric.activeCalls > 1) {  // We're recursed into the same function: don't count the time, we only care about the topmost one
        result = fn(...args);
    } else {
        metric.topmostCalls++;
        const start = performance.now();
        result = fn(...args);
        const end = performance.now();
        metric.time += end - start;
    }
    metric.activeCalls--;
    return result;
}
recordCallTime.skip = function <Args extends Array<any>, Return>(key: string, fn: (...args: Args) => Return, ...args: Args): Return {
    return fn(...args);
}

export function logRecordedTimes(sortBy: keyof Metrics = "time") {
    console.log("== RECORDED TIME LOG: ==");
    const maxTime = Object.values(metrics).reduce((a, e) => Math.max(a, e.time), 0);
    const lines: Array<Array<string>> = [];
    for (const [key, metric] of Object.entries(metrics).toSorted(([_1, a], [_2, b]) => b[sortBy] - a[sortBy])) {
        const line = [key, ":", `${metric.time.toFixed(2)}ms`, `(${(metric.time / maxTime * 100).toFixed(2)}%),`];
        line.push(`${metric.calls} calls,`);
        line.push(`${metric.topmostCalls} topmost calls,`, `avg ${metric.avgTime.toFixed(2)}ms,`);
        line.push(`${metric.maxDepth} max depth,`, `${metric.avgDepth.toFixed(2)} avg depth,`);
        lines.push(line);
    }
    if (!lines.length) {
        console.log("No recorded time!");
    }
    const maxLengths: Array<number> = [];
    for (let i = 0; i < lines[0]!.length; i++) {
        maxLengths[i] = lines.reduce((a, e) => Math.max(a, e[i]!.length), 0);
    }
    for (const line of lines) {
        console.log(line.map((e, i) => e.padEnd(maxLengths[i]!)).join(" "));
    }
}