import { isMap, isSet, range } from "lodash";

export type AbstractConstructor<T> = abstract new(...args: any) => T;
export type Constructor<T> = new(...args: any[]) => T;
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
export function allCombinations<T>(set: T[]): T[][] {
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
        let bitwise_xor_from_character = hash ^ str.charCodeAt(i);
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
        var rnd = this.seed / 233280;

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
            let randomIndex = this.nextInt(currentIndex);
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

export abstract class WithOriginal { original = this; }

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


export abstract class TreeNode<RootType extends TreeRoot<RootType>, KeyType = any> extends WithOriginal {
    /** Different objects of the same type MUST have different ids. */
    readonly id: string;
    children = new NodeGroup<TreeNode<RootType>>();
    /** Use {@linkcode typedParent()} to get a strongly typed version of this. */
    parent: TreeNode<RootType>;
    /** Used for serialization and lookup. General categorization, above classes. */
    abstract readonly type: string;
    /** Used for serialization. Printing name. */
    abstract name: string;
    /** Used for serialization. If clients should skip rendering this object. */
    get hidden(): boolean { return false; }

    constructor(id: string) {
        super();
        this.id = id;
    }

    /** All objects in the tree share the same root, and same root type. */
    get root(): RootType { return this.parent?.root; }
    /** Typed id. */
    abstract get key(): KeyType;

    unparent() {
        return this.root.addChild(this);
    }

    prune(deep: boolean = true) {
        this.parent?.children.delete(this);
        this.root?.removeFromLookup(this);
        if (deep) for (const child of [...this.children]) child.prune();
        (this.parent as any) = undefined;  // Pruned objects shouldn't be accessed anyways
        return this;
    }

    parentTo(parent: TreeNode<RootType>, onTop: boolean = false) {
        return parent.addChild(this, onTop);
    }

    addChild<T extends TreeNode<RootType>>(child: T, onTop: boolean = false) {
        if (child as TreeNode<RootType> === this)
            throw TypeError("Cannot parent an object to itself");

        child.prune(false);
        if (onTop)
            this.children.unshift(child);
        else
            this.children.push(child);

        // this.children.addToLookup(child);
        
        child.parent = this;
        this.root.addToLookup(child);

        return child;
    }

    addChildren<T extends TreeNode<RootType>>(children: T[], onTop: boolean = false) {
        for (const child of [...children].reverse())
            this.addChild(child, onTop);
        return children;
    }

    typedParent<T extends TreeNode<RootType>>(cls: AbstractConstructor<T>) {
        if (this.parent instanceof cls) return this.parent;
        return undefined;
    }

    byClass<T extends TreeNode<RootType>>(cls: AbstractConstructor<T> | string): NodeGroup<T> {
        return this.children.byClass(cls);
    }

    toString() {
        return `${this.constructor.name}(${this.id})`;
    }

    /** Serialize the node into a simple object. If `lite` is true, only the necessary properties are recorded. */
    serialize(lite: boolean = false): SerializedNode<this> {
        // if (this.root as any === this) console.log("SERIALIZED");
        const obj = {
            ...this.liteSerialize(),
            children: this.children.map(e => e.serialize(lite)).filter(e => e !== undefined),
            ...lite ? {} : this.constSerialize()
        } as SerializedNode<this>;
        if (obj.children?.length === 0) delete obj.children;
        return obj;
    }

    /** Serialize the data necessary for parsing (what is returned in a lite serialization). */
    liteSerialize() {
        return {
            class: this.constructor.name,
            type: this.type,
            id: this.id,
        };
    }

    /** Serialize the data that isn't taken into account for parsing (what is excluded in a lite serialization) */
    constSerialize(): Record<`_${string}`, any> {
        return {
            _name: this.name,
            _hidden: this.hidden,
        };
    }

    parse(obj: ReturnType<this["liteSerialize"]>, allowCreation: boolean = false) {
        if (obj.class !== this.constructor.name) throw TypeError(`Class parsing doesn't match: expected ${this.constructor.name}, got ${obj.class}`);
        if (obj.type !== this.type) throw TypeError(`Type parsing doesn't match: expected ${this.type}, got ${obj.type}`);
        if (obj.id !== this.id) throw TypeError(`Id parsing doesn't match: expected ${this.id}, got ${obj.id}`);
        
        const confirmedChildren = new Set<TreeNode<RootType>>();
        // Ugly type casting, since recursive types with generic parameters cause "type serialization is too deep" errors,
        // and I want the child classes to use ReturnType<this["liteSerialize"]> and using it here causes issues with the recursivity
        let objWithChildren = obj as SerializedNode<this>;
        if (objWithChildren.children) {
            for (const [i, child] of objWithChildren.children.entries()) {
                let node = this.root.search(child.type, child.id);
                if (!node) {
                    if (!allowCreation) throw TypeError(`Could not find node of class ${child.type} and id ${child.id}, and creation is not allowed`);
                    console.warn(`Didn't find node of type ${child.type} and id ${child.id}`);
                    node = this.root.create(child.class, child.id);
                }
                if (node.parent !== this || node.parent.children.indexOf(node) !== i) this.addChild(node);
                confirmedChildren.add(node);
                node.parse(child, allowCreation);
            }
        }

        for (const child of [...this.children])
            if (!confirmedChildren.has(child))
                child.prune();
    }
}

export type SerializedNode<T extends TreeNode<any>> = ReturnType<T["liteSerialize"]> & { children?: SerializedNode<TreeNode<any>>[] }

export abstract class TreeRoot<RootType extends TreeRoot<RootType>> extends TreeNode<RootType, "root"> {
    parent = this;
    /** A lookup table to quickly search elements in the tree. */
    lookup: Record<string, Record<string, TreeNode<RootType>>> = {};
    /** A map from class names to constructors, used to create objects from parsed data. All those constructors MUST be callable with only an id. */
    abstract classIndex: Record<string, new (id: string) => TreeNode<RootType>>;

    constructor() {
        super("root");
    }

    get key(): "root" { return "root"; }
    get root(): RootType { return this as any; }

    prune(): this {
        throw TypeError("Cannot prune a root node");
    }

    addToLookup(node: TreeNode<RootType>) {
        // console.log(`+ ${node.type} ${node.id} ${node.name}`);
        const typeGroup = this.lookup[node.type] ??= {};
        if (typeGroup[node.id]) throw TypeError(`Object of type ${node.type} and id ${node.id} already exists`);
        typeGroup[node.id] = node;
    }
    
    removeFromLookup(node: TreeNode<RootType>) {
        // console.log(`- ${node.type} ${node.id} ${node.name}`);
        const typeGroup = this.lookup[node.type];
        if (!typeGroup) return;
        delete typeGroup[node.id];
    }

    search<T extends TreeNode<RootType>>(type: T["type"], id: T["id"]): T | undefined {
        const typeGroup = this.lookup[type];
        if (!typeGroup) return undefined;
        return typeGroup[id] as T;
    }

    create(cls: string, id: string): TreeNode<RootType> {
        if (!this.classIndex[cls]) throw TypeError(`Cannot create a node of class ${cls}`);
        return new this.classIndex[cls](id);
    }

    // @ts-expect-error
    searchOrCreate<T extends TreeNode<RootType>>(cls: T["constructor"]["name"], type: T["type"], id: T["id"]): T {
        const found = this.search(type, id);
        if (found) return found;
        return this.create(cls, id) as T;
    }
}

export abstract class TreeLeaf<RootType extends TreeRoot<RootType>, KeyType = any> extends TreeNode<RootType, KeyType> {
    declare children: NodeGroup<never>;

    addChild<T extends TreeNode<RootType, any>>(child: T): T {
        throw TypeError("Cannot add children to leaf nodes");
    }
}

// TODO: Fix lookup table
export class NodeGroup<T extends TreeNode<any>> extends Array<T> {
    // lookupByClass: Record<string, Set<T>> = {};

    // addToLookup(node: T) {
    //     const name = node.constructor.name;
    //     const set = this.lookupByClass[name] ?? new Set();
    //     set.add(node);
    //     this.lookupByClass[name] = set;
    // }

    delete(node: T) {
        const index = this.indexOf(node);
        if (index < 0) return;
        this.splice(index, 1);
        // this.lookupByClass[node.constructor.name]?.delete(node);
    }

    typeCheck<U extends T>(node: TreeNode<any>, cls: AbstractConstructor<U> | string) {
        return typeof cls === "string" ? node.constructor.name === cls : node instanceof cls;
    }

    hasOfClass(cls: AbstractConstructor<T> | string) {
        // const set = this.lookupByClass[cls.name];
        // return !!set && set.size > 0;
        return this.some(e => this.typeCheck(e, cls));
    }

    byClass<U extends T>(cls: AbstractConstructor<U> | string): NodeGroup<U> {
        return new NodeGroup(...this.filter(e => this.typeCheck(e, cls)) as U[]);
    }

    by<K extends keyof T>(key: K, value: T[K]) {
        return new NodeGroup(...this.filter(e => e[key] === value));
    }

    byKey(key: T["key"]) {
        return this.by("key", key);
    }

    max(amount: number) {
        return new NodeGroup(...this.slice(0, amount));
    }
}
