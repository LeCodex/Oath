import { clone, cloneWith, isMap, isSet, range } from "lodash";

export type AbstractConstructor<T> = abstract new (...args: any) => T;
export type Constructor<T> = new (...args: any) => T;
export const isExtended = <T>(constructor: Constructor<any>, type: AbstractConstructor<T>): constructor is Constructor<T> => { return constructor.prototype instanceof type };
export const instanceOf = <T>(obj: any, type: AbstractConstructor<T>): obj is T => { return obj instanceof type };

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


export class DataObject {
    copy: this
    
    save() {
        const customizer = (value: any, key?: PropertyKey, object?: any, stack?: any) => {
            if (key === "copy") return undefined;
            if (typeof value === "object") return clone(value);
        }
        this.copy = cloneWith(this, customizer);
    }

    restore() {
        Object.assign(this, this.copy);
    }
}


export abstract class TreeNode<RootType extends TreeRoot<RootType>, IdType = any> extends WithOriginal {
    /** Different objects of the same class MUST have different ids. */
    _id: string;
    children = new NodeGroup<TreeNode<RootType>>();
    /** Use {@linkcode typedParent()} to get a strongly typed version of this. */
    parent: TreeNode<any>;
    /** Used for serialization. General cateogrization. */
    abstract type: string;
    /** Used for serialization. If clients should skip rendering this object. */
    hidden: boolean = false;

    constructor(id: string) {
        super();
        this._id = id;
    }

    /** All objects in the tree share the same root, and same root type. */
    get root(): RootType { return this.parent?.root; }
    abstract get id(): IdType;

    unparent() {
        return this.root.addChild(this);
    }

    prune() {
        this.parent?.children.delete(this);
        this.root.removeFromLookup(this);
        (this.parent as any) = undefined;  // Pruned objects shouldn't be accessed anyways
    }

    addChild<T extends TreeNode<RootType>>(child: T, onTop: boolean = false) {
        if (child as TreeNode<RootType> === this)
            throw TypeError("Cannot parent an object to itself");

        child.prune();
        if (onTop)
            this.children.unshift(child);
        else
            this.children.push(child);

        // this.children.addToLookup(child);
        
        child.parent = this;
        if (!this.root.lookup[child.constructor.name]) this.root.lookup[child.constructor.name] = {};
        this.root.addToLookup(child);

        return child;
    }

    addChildren<T extends TreeNode<RootType>>(children: T[], onTop: boolean = false) {
        for (const child of children.reverse())
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

    serialize(): Record<string, any> | undefined {
        return {
            type: this.type,
            class: this.constructor.name,
            id: this._id,
            children: this.children.map(e => e.serialize()).filter(e => e !== undefined)
        };
    }

    parse(obj: Record<string, any>, allowCreation: boolean = false) {
        if (obj.type !== this.type) throw TypeError(`Type parsing doesn't match: expected ${this.type}, got ${obj.type}`);
        if (obj.class !== this.constructor.name) throw TypeError(`Class parsing doesn't match: expected ${this.constructor.name}, got ${obj.class}`);
        if (obj.id !== this.id) throw TypeError(`Id parsing doesn't match: expected ${this.id}, got ${obj.id}`);

        for (const child of obj.children) {
            let node = this.root.search(child.class, child.id);
            if (!node) {
                if (!allowCreation) throw TypeError(`Could not find node of class ${child.class} and id ${child.id}`);
                node = this.root.create(obj.class, obj);
            }
            if (node.parent !== this) this.addChild(node);
            node.parse(child);
        }
    }
}

export abstract class TreeRoot<RootType extends TreeRoot<RootType>> extends TreeNode<RootType, "root"> {
    parent = this;
    /** A lookup table to quickly search elements in the tree. */
    lookup: Record<string, Record<string, TreeNode<RootType>>> = {};
    /** A map from class names to constructors, used to create objects from parsed data. All those constructors MUST be callable with only an id. */
    abstract classIndex: Record<string, new (id: string) => TreeNode<RootType>>;

    constructor() {
        super("root");
    }

    get id(): "root" { return "root"; }
    get root(): RootType { return this as any; }

    prune() {
        throw TypeError("Cannot prune a root node");
    }

    addToLookup(node: TreeNode<RootType>) {
        let classGroup = this.lookup[node.constructor.name];
        if (!classGroup) classGroup = this.lookup[node.constructor.name] = {};
        if (classGroup[node.id]) throw TypeError(`Object of class ${node.constructor.name} and id ${node.id} already exists`);
        classGroup[node.id] = node;
    }

    removeFromLookup(node: TreeNode<RootType>) {
        let classGroup = this.lookup[node.constructor.name];
        if (!classGroup) return;
        delete classGroup[node.id];
    }

    search<T extends TreeNode<RootType>>(cls: AbstractConstructor<T> | string, id: T["id"]): T | undefined {
        const classGroup = this.root.lookup[typeof cls === "string" ? cls : cls.name];
        if (!classGroup) return undefined;
        return classGroup[id] as T;
    }

    create(cls: string, obj: Record<string, any>): TreeNode<RootType> {
        if (!this.classIndex[cls]) throw TypeError(`Cannot create an node of class ${cls}`);
        return new this.classIndex[cls](obj.id);
    }
}

export abstract class TreeLeaf<RootType extends TreeRoot<RootType>, IdType = any> extends TreeNode<RootType, IdType> {
    children: NodeGroup<never>;

    addChild<T extends TreeNode<RootType, any>>(child: T): T {
        throw TypeError("Cannot add children to leaf nodes");
    }

    serialize(): Record<string, any> | undefined {
        const obj = super.serialize();
        delete obj?.children;
        return obj;
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
        return typeof cls === "string" ? node.constructor.name === cls : instanceOf(node, cls);
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

    byId(id: T["id"]) {
        return this.by("id", id);
    }

    max(amount: number) {
        return new NodeGroup(...this.slice(0, amount));
    }
}