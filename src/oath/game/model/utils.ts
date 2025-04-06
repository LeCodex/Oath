import type { AbstractConstructor } from "../utils";

export abstract class WithOriginal { original = this; }

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
        (this.parent as any) = undefined; // Pruned objects shouldn't be accessed anyways
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
        const objWithChildren = obj as SerializedNode<this>;
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

export type SerializedNode<T extends TreeNode<any>> = ReturnType<T["liteSerialize"]> & { children?: SerializedNode<TreeNode<any>>[]; };

export abstract class TreeRoot<RootType extends TreeRoot<RootType>> extends TreeNode<RootType, "root"> {
    readonly type = "root";
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

    // @ts-expect-error T["constructor"]["name"] is valid
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
        return this.filter(e => this.typeCheck(e, cls)) as NodeGroup<U>;
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

    filter(predicate: (value: T, index: number, arr: Array<T>) => unknown, thisArg?: unknown): NodeGroup<T>
    filter<S extends T>(predicate: (value: T, index: number, arr: Array<T>) => value is S, thisArg?: unknown): NodeGroup<S>
    filter(predicate: (value: T, index: number, arr: Array<T>) => unknown, thisArg?: unknown): NodeGroup<T> {
        return new NodeGroup(...super.filter(predicate, thisArg))
    }
}
