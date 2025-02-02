import { isMap, isSet, range } from "lodash";

export type AbstractConstructor<T> = abstract new(...args: any) => T;
export type Constructor<T> = new (...args: any[]) => T;
export type Concrete<T extends AbstractConstructor<any>> = T extends AbstractConstructor<infer U> ? Constructor<U> : never;
export type Abstract<T extends Constructor<any>> = T extends Constructor<infer U> ? AbstractConstructor<U> : never;
export type Factory<T, P extends any[] = any[]> = (...args: P) => T;
export const isExtended = <T>(constructor: Constructor<any>, type: AbstractConstructor<T>): constructor is Constructor<T> => { return constructor.prototype instanceof type };

export type Enum<E> = Record<keyof E, number | string> & { [k: number]: string; };
export function isEnumKey<E extends Enum<E>>(key: string | number | symbol, _enum: E): key is keyof E {
    return key in _enum;
}

/** For a set of set of elements, returns all combinations of an element from the first set, then the second, and so on. */
export function allChoices<T>(set: T[][]): T[][] {
    const combinations: T[][] = [[]];
    for (const choiceGroup of set) {
        const length = combinations.length;
        for (let i = 0; i < length; i++) {
            const subset = combinations.shift()!;
            for (const element of choiceGroup) {
                combinations.push([...subset, element]);
            }
        }
    }
    return combinations;
}
/** For a set of elements, return all combinations of all sizes (including and excluding every elements). */
export function allCombinations<T>(set: Iterable<T>): T[][] {
    const combinations: T[][] = [[]];
    for (const element of set) {
        const length = combinations.length;
        for (let i = 0; i < length; i++) {
            const subset = combinations.shift()!;
            combinations.push(subset);
            combinations.push([...subset, element]);
        }
    }
    return combinations;
}

export class NumberMap<T> extends Map<T, number> {
    get(key: T): number {
        return super.get(key) ?? 0;
    }
}

export function MurmurHash3(str: string) {
    let hash = 1779033703 ^ str.length
    for (let i = 0; i < str.length; i++) {
        const bitwise_xor_from_character = hash ^ str.charCodeAt(i);
        hash = Math.imul(bitwise_xor_from_character, 3432918353);
        hash = hash << 13 | hash >>> 19;
    }
    
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
}

export class PRNG {
    public seed: number;

    constructor(seed?: number) {
        this.seed = seed ?? Date.now();
    }

    private next(min?: number, max?: number): number {
        max = max ?? 0;
        min = min ?? 0;

        this.seed = (this.seed * 9301 + 49297) % 233280;
        const rnd = this.seed / 233280;

        return min + rnd * (max - min);
    }

    // http://indiegamr.com/generate-repeatable-random-numbers-in-js/
    public nextInt(min: number, max?: number): number {
        if (max === undefined) {
            max = min;
            min = 0;
        }
        return Math.floor(this.next(min, max));
    }

    public nextDouble(): number {
        return this.next(0, 1);
    }

    public pick<T>(collection: T[]): T {
        return collection[this.nextInt(0, collection.length - 1)]!;
    }

    public shuffleArray(array: any[]) {
        let currentIndex = array.length;
        while (currentIndex != 0) {
            const randomIndex = this.nextInt(currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
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

type ProxyInfo<T> = { proxy: T, revoke: () => void };
export class MaskProxyManager {
    originalToProxy = new WeakMap<object, object>();
    proxies = new WeakSet<object>();

    get<T>(value: T): T {
        if (typeof value !== "object" || value === null) return value;
        if (this.proxies.has(value)) return value;
        if (value instanceof MaskedSet || value instanceof MaskedMap) {
            if (value.maskProxyManager !== this) throw TypeError(`Trying to access a ${value.constructor.name} from another MaskProxyManager`);
            return value;
        }
        
        let proxy = this.originalToProxy.get(value);
        if (!proxy) {
            if (isSet(value))
                proxy = new MaskedSet(value, this);
            else if (isMap(value))
                proxy = new MaskedMap(value, this);
            else
                proxy = new Proxy(value, new MaskProxyHandler(this));
            
            this.proxies.add(proxy);
            this.originalToProxy.set(value, proxy);
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
