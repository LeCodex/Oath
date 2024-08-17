import { isMap, isSet, random, range } from "lodash";

export type AbstractConstructor<T> = abstract new (...args: any) => T;
export type Constructor<T> = new (...args: any) => T;
export const isExtended = <T>(constructor: Constructor<any>, type: AbstractConstructor<T>): constructor is Constructor<T> => { return constructor.prototype instanceof type };

export function shuffleArray(array: any[]) {
    let currentIndex = array.length;
    while (currentIndex != 0) {
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
}

export function inclusiveRange(start: number, end?: number, step?: number) {
    if (end !== undefined) end++; else start++;
    return range(start, end, step);
}

export function minInGroup<T>(group: Iterable<T>, propertyOrMap: keyof T | ((e: T) => number)): T[] {
    let min = Infinity;
    const subGroup = [];
    for (const element of group) {
        const value = typeof propertyOrMap === "function" ? propertyOrMap(element) : element[propertyOrMap];
        if (typeof value !== "number") throw TypeError(`${value} is not a number`);
        
        if (value <= min) {
            if (value < min) subGroup.length = 0;
            subGroup.push(element);
            min = value;
        }
    }

    return subGroup;
}

export function maxInGroup<T>(group: Iterable<T>, propertyOrMap: keyof T | ((e: T) => number)): T[] {
    let max = 0;
    const subGroup = [];
    for (const element of group) {
        const value = typeof propertyOrMap === "function" ? propertyOrMap(element) : element[propertyOrMap];
        if (typeof value !== "number") throw TypeError(`${value} is not a number`);
        
        if (value >= max) {
            if (value > max) subGroup.length = 0;
            subGroup.push(element);
            max = value;
        }
    }

    return subGroup;
}

export abstract class WithOriginal { original = this; }

type ProxyInfo<T> = { proxy: T, revoke: () => void };
export class MaskProxyManager {
    originalToProxies = new WeakMap<object, object>();
    proxies = new WeakSet<object>();

    get<T>(value: T): T {
        if (typeof value !== "object" || value === null) return value;
        if (this.proxies.has(value)) return value;
        if (value instanceof MaskedSet || value instanceof MaskedMap) {
            if (value.maskProxyManager !== this) throw new TypeError(`Trying to access a ${value.constructor.name} from another MaskProxyManager`);
            return value;
        }
        
        let proxy = this.originalToProxies.get(value);
        if (!proxy) {
            if (isSet(value))
                proxy = new MaskedSet(value, this);
            else if (isMap(value))
                proxy = new MaskedMap(value, this);
            else
                proxy = new Proxy(value, new MaskProxyHandler(this));
            
            this.proxies.add(proxy);
            this.originalToProxies.set(value, proxy);
        }
        return proxy as T;
    }

    // revoke<T extends object>(value: T) {
    //     this.proxies.get(value)?.revoke();
    // }
}

export class MaskProxyHandler<T extends object> implements ProxyHandler<T> {
    mask: Partial<Record<keyof T, any>> = {};
    maskProxyManager: MaskProxyManager;

    constructor(maskProxyManager: MaskProxyManager) {
        this.maskProxyManager = maskProxyManager;
    }

    get(target: T, key: string | symbol, receiver?: any) {
        const tKey = key as keyof T;
        if (tKey === "original") return target;
        if (tKey in this.mask) return this.mask[tKey];

        const value = Reflect.get(target, tKey, receiver);
        return this.maskProxyManager.get(value);
    }

    set(target: T, key: string | symbol, value: any, receiver?: any): boolean {
        const tKey = key as keyof T;
        this.mask[tKey] = this.maskProxyManager.get(value);
        return true;
    }

    deleteProperty(target: T, key: string | symbol): boolean {
        const tKey = key as keyof T;
        const wasIn = tKey in this.mask;
        delete this.mask[tKey];
        return wasIn;
    }
}

/** Behaves like the supplied Set, until it's modified and becomes a mask. Returns the values filtered through the MaskProxyManager */
class MaskedSet<T extends object> implements Set<T> {
    masked: boolean;
    set: Set<T>;
    maskProxyManager: MaskProxyManager;

    constructor(set: Set<T>, maskProxyManager: MaskProxyManager) {
        this.masked = false;
        this.set = set;
        this.maskProxyManager = maskProxyManager;
    }
    
    get size(): number { return this.set.size; }
    has(value: T): boolean { return this.set.has(value); }

    mask() {
        if (this.masked) return;
        this.masked = true;
        this.set = new Set(this.set);
    }

    add(value: T): this {
        this.mask();
        this.set.add(value);
        return this;
    }

    delete(value: T): boolean {
        this.mask();
        return this.set.delete(value);
    }

    clear(): void {
        this.mask();
        this.set.clear();
    }
    
    *values() { for (const value of this.set.values()) yield this.maskProxyManager.get(value); }
    *keys() { for (const value of this.set.keys()) yield this.maskProxyManager.get(value); }
    *entries() { for (const [value, value2] of this.set.entries()) yield [this.maskProxyManager.get(value), this.maskProxyManager.get(value2)] as [T, T]; }
    
    forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void { 
        this.set.forEach((value: T, value2: T, set: Set<T>) => callbackfn(this.maskProxyManager.get(value), this.maskProxyManager.get(value2), set), thisArg); 
    }

    [Symbol.iterator]() { return this.values(); }
    get [Symbol.toStringTag]() { return this.set[Symbol.toStringTag]; }
}

/** Behaves like the supplied Map, until it's modified and becomes a mask. Returns the values filtered through the MaskProxyManager */
export class MaskedMap<K, V extends object> implements Map<K, V> {
    masked: boolean;
    map: Map<K, V>;
    maskProxyManager: MaskProxyManager;

    constructor(map: Map<K, V>, maskProxyManager: MaskProxyManager) {
        this.map = map;
        this.maskProxyManager = maskProxyManager;
    }

    get size() { return this.map.size; }
    has(key: K): boolean { return this.map.has(key); }

    get(key: K): V | undefined {
        const value = this.map.get(key);
        return value && this.maskProxyManager.get(value);
    }

    mask() {
        if (this.masked) return;
        this.masked = true;
        this.map = new Map(this.map);
    }

    set(key: K, value: V): this {
        this.mask();
        this.map.set(key, value);
        return this;
    }

    delete(key: K): boolean {
        this.mask();
        return this.map.delete(key);
    }

    clear(): void {
        this.mask();
        this.map.clear();
    }

    *values() { for (const value of this.map.values()) yield this.maskProxyManager.get(value); }
    *keys() { for (const key of this.map.keys()) yield this.maskProxyManager.get(key); }
    *entries() { for (const [key, value] of this.map.entries()) yield [this.maskProxyManager.get(key), this.maskProxyManager.get(value)] as [K, V]; }
    
    forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void { 
        this.map.forEach((value: V, key: K, map: Map<K, V>) => callbackfn(this.maskProxyManager.get(value), key, map), thisArg); 
    }

    [Symbol.iterator]() { return this.entries(); }
    get [Symbol.toStringTag]() { return this.map[Symbol.toStringTag]; }
}
