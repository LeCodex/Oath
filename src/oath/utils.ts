import type { AbstractConstructor } from "./game/utils";

class Metrics {
    calls = 0;
    topmostCalls: number[] = [];
    activeCalls = 0;
    maxDepth = 0;
    totalDepth = 0;
    depthCount = 0;

    get time() {
        return this.topmostCalls.reduce((a, e) => a + e, 0);
    }

    get avgTime() {
        return this.time / this.topmostCalls.length;
    }

    minTime() {
        return this.topmostCalls.toSorted()[0]!;
    }

    maxTime() {
        return this.topmostCalls.toSorted()[this.topmostCalls.length - 1]!;
    }

    medTime() {
        return this.topmostCalls.toSorted()[Math.floor(this.topmostCalls.length / 2)]!;
    }

    get avgDepth() {
        return this.totalDepth / this.depthCount;
    }
}
const metrics: Record<string, Metrics> = {};
const ongoingRecords: Record<string, number> = {};

interface MethodRecorderOptions {
    useSubclassNames?: boolean
}

export function recordMethodExecutionTime(options?: MethodRecorderOptions): MethodDecorator {
    return (target, name, descriptor) => {
        const method = descriptor.value;
        if (typeof method !== "function") throw TypeError("Can only record execution time of methods");
        descriptor.value = function (...args: any[]) {
            const prefixOrigin = options?.useSubclassNames ? this : target;
            return recordExecutionTime(`${typeof prefixOrigin === "function" ? prefixOrigin.name : prefixOrigin.constructor.name}.${name.toString()}`, method.bind(this) as (...args: any[]) => unknown, ...args);
        } as any;
        return descriptor;
    }
}
recordMethodExecutionTime.skip = function (options?: MethodRecorderOptions): MethodDecorator {
    return (_1, _2, descriptor) => { return descriptor; }
}

export function recordCallback<Args extends Array<any>, Return>(key: string, callback: (...args: Args) => Return) {
    return (...args: Args) => {
        return recordExecutionTime(key, callback, ...args);
    }
}

export function recordInstantiationTime<T extends AbstractConstructor<any>>(constructor: T) {
    abstract class InstantiationRecorder extends constructor {
        constructor(...args: Array<any>) {
            startRecordTime(`${constructor.name}.constructor`);
            super(...args);
            endRecordTime(`${constructor.name}.constructor`);
        }
    }
    return InstantiationRecorder;
}

export function recordExecutionTime<Args extends Array<any>, Return>(key: string, fn: (...args: Args) => Return, ...args: Args): Return {
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
        const start = performance.now();
        result = fn(...args);
        const end = performance.now();
        metric.topmostCalls.push(end - start);
    }
    metric.activeCalls--;
    return result;
}
recordExecutionTime.skip = function <Args extends Array<any>, Return>(key: string, fn: (...args: Args) => Return, ...args: Args): Return {
    return fn(...args);
}

export function startRecordTime(key: string) {
    const metric = metrics[key] ??= new Metrics();
    metric.activeCalls++;
    if (!ongoingRecords[key]) {
        ongoingRecords[key] = performance.now();
    } else {
        console.warn(`Trying to start already started record with key "${key}"`);
    }
}

export function endRecordTime(key: string) {
    if (!ongoingRecords[key]) {
        throw TypeError(`Trying to stop record with key "${key}" but it wasn't started`);
    }
    const metric = metrics[key] ??= new Metrics();
    metric.calls++;
    metric.maxDepth = Math.max(metric.activeCalls, metric.maxDepth);
    metric.totalDepth += metric.activeCalls;
    metric.depthCount++;
    const start = ongoingRecords[key];
    const end = performance.now();
    metric.topmostCalls.push(end - start);
    metric.activeCalls--;
    delete ongoingRecords[key];
}

function displayTime(time: number) {
    const order = Math.log10(time);
    if (order < 0) {
        return `${(time * 1000).toFixed(Math.min(3, -Math.floor(order)))}μs`;
    } else if (order >= 3) {
        return `${(time / 1000).toFixed(Math.max(0, 6 - Math.floor(order)))}s!`;
    } else {
        return `${time.toFixed(Math.max(0, 3 - Math.floor(order)))}ms`;
    }
}

function isCallable(val: unknown): val is () => unknown { return typeof val === "function"; }
function callOrReturn<T>(value: T | (() => T)): T {
    return isCallable(value) ? value() : value;
}

export function logRecordedTimes(sortBy: Exclude<keyof Metrics, "topmostCalls"> = "time") {
    console.log("== RECORDED TIME LOG: ==");
    const maxTime = Object.values(metrics).reduce((a, e) => Math.max(a, e.time), 0);
    const lines: Array<Array<string>> = [];
    for (const [key, metric] of Object.entries(metrics).toSorted(([_1, a], [_2, b]) => callOrReturn(b[sortBy]) - callOrReturn(a[sortBy]))) {
        lines.push([
            key, ":",
            displayTime(metric.time),
            `(${(metric.time / maxTime * 100).toFixed(2)}%),`,
            `${metric.calls} calls,`,
            `${metric.topmostCalls.length} topmost calls,`,
            `avg ${displayTime(metric.avgTime)},`,
            `min ${displayTime(metric.minTime())},`,
            `max ${displayTime(metric.maxTime())},`,
            `med ${displayTime(metric.medTime())},`,
            `${metric.maxDepth} max depth,`,
            `${metric.avgDepth.toFixed(2)} avg depth,`
        ]);
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