import { isMap, isSet, isWeakMap, isWeakSet } from "lodash";

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

export class WithOriginal {
    original = this;
}

type ProxyInfo<T> = { proxy: T, revoke: () => void };
export class MaskProxy {
    proxies = new WeakMap<object, object>();

    get<T>(value: T): T {
        if (typeof value !== "object" || value === null) return value;
        let proxy = this.proxies.get(value);
        if (!proxy) {
            if (isSet(value))
                proxy = new MaskedSet(value, this);
            else if (isMap(value))
                proxy = new MaskedMap(value, this);
            else
                proxy = new Proxy(value, new MaskProxyHandler(this));
        }
        this.proxies.set(value, proxy);
        return proxy as T;
    }

    // revoke<T extends object>(value: T) {
    //     this.proxies.get(value)?.revoke();
    // }
}

export class MaskProxyHandler<T extends object> implements ProxyHandler<T> {
    mask: Partial<Record<keyof T, any>> = {};
    maskProxy: MaskProxy;

    constructor(maskProxy: MaskProxy) {
        this.maskProxy = maskProxy;
    }

    get(target: T, key: string | symbol, receiver?: any) {
        const tKey = key as keyof T;
        if (tKey === "original") return target;
        
        const value = Reflect.get(target, tKey, receiver);
        if (tKey in this.mask) {
            return this.mask[tKey];
        } else if (typeof value === "function") {
            return value.bind(receiver);
        } else {
            return this.maskProxy.get(value);
        }
    }

    set(target: T, key: string | symbol, value: any, receiver?: any): boolean {
        const tKey = key as keyof T;
        if (typeof value === "object" && value !== null) {
            this.mask[tKey] = this.maskProxy.get(value);
        } else {
            this.mask[tKey] = value;
        }
        return true;
    }

    deleteProperty(target: T, key: string | symbol): boolean {
        const tKey = key as keyof T;
        const wasIn = tKey in this.mask;
        delete this.mask[tKey];
        return wasIn;
    }
}

/** Behaves like the supplied Set, until it's modified and becomes a mask. Returns the values filtered through the MaskProxy */
class MaskedSet<T extends object> implements Set<T> {
    masked: boolean;
    set: Set<T>;
    maskProxy: MaskProxy;

    constructor(set: Set<T>, maskProxy: MaskProxy) {
        this.masked = false;
        this.set = set;
        this.maskProxy = maskProxy;
    }
    
    get size(): number { return this.set.size; }
    has(value: T): boolean { return this.set.has(value); }

    mask() {
        if (!this.masked) return;
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
    
    *values() { for (const value of this.set.values()) yield this.maskProxy.get(value); }
    *keys() { for (const value of this.set.keys()) yield this.maskProxy.get(value); }
    *entries() { for (const [value1, value2] of this.set.entries()) yield [this.maskProxy.get(value1), this.maskProxy.get(value2)] as [T, T]; }

    forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void { this.set.forEach(callbackfn, thisArg); }
    [Symbol.iterator]() { return this.set[Symbol.iterator](); }
    get [Symbol.toStringTag]() { return this.set[Symbol.toStringTag]; }
}

/** Behaves like the supplied Map, until it's modified and becomes a mask. Returns the values filtered through the MaskProxy */
export class MaskedMap<K, V extends object> implements Map<K, V> {
    masked: boolean;
    map: Map<K, V>;
    maskProxy: MaskProxy;

    constructor(map: Map<K, V>, maskProxy: MaskProxy) {
        this.map = map;
        this.maskProxy = maskProxy;
    }

    get size() { return this.map.size; }
    has(key: K): boolean { return this.map.has(key); }

    get(key: K): V | undefined {
        const value = this.map.get(key);
        return value && this.maskProxy.get(value);
    }

    mask() {
        if (!this.masked) return;
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

    *values() { for (const value of this.map.values()) yield this.maskProxy.get(value); }
    *keys() { return this.map.keys(); }
    *entries() { for (const [key, value] of this.map.entries()) yield [key, this.maskProxy.get(value)] as [K, V]; }

    forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void { this.map.forEach(callbackfn, thisArg); }
    [Symbol.iterator]() { return this.map[Symbol.iterator](); }
    get [Symbol.toStringTag]() { return this.map[Symbol.toStringTag]; }
}
