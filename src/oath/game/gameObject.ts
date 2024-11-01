import { OathGame } from "./game";
import { AbstractConstructor, NodeGroup, TreeLeaf, TreeNode } from "./utils";


export class OathGameObject<T = any> extends TreeNode<OathGame, T> {
    children: NodeGroup<OathGameObject>;
    get game() { return this.root; }
}

export class OathGameObjectLeaf<T = any> extends TreeLeaf<OathGame, T> {
    get game() { return this.root; }
}

export class Container<ChildrenType extends OathGameObject<any>, U = any> extends OathGameObject<U> {
    children: NodeGroup<ChildrenType>;

    constructor(id: U, public cls: AbstractConstructor<ChildrenType>) {
        super(id);
    }

    addChild<T extends TreeNode<any>>(child: T, onBottom: boolean = false) {
        if (!(child instanceof this.cls)) throw new TypeError(`${child} is not of the right type ${this.cls.name}`);
        return super.addChild(child, onBottom);
    }

    moveChildrenTo(target: OathGameObject, amount: number = Infinity) {
        for (const child of this.children.max(amount))
            target.addChild(child);
    }

    get(amount: number = Infinity) {
        return this.children.max(amount);
    }

    get amount(): number { return this.children.length; }
}

