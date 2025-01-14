import type { OathGame } from "./game";
import type { AbstractConstructor, NodeGroup} from "./utils";
import { TreeLeaf, TreeNode } from "./utils";


export abstract class OathGameObject<T = any> extends TreeNode<OathGame, T> {
    declare children: NodeGroup<OathGameObject>;
    get game() { return this.root; }
}

export abstract class OathGameObjectLeaf<T = any> extends TreeLeaf<OathGame, T> {
    get game() { return this.root; }
}

export abstract class Container<ChildrenType extends OathGameObject<any>, U = any> extends OathGameObject<U> {
    declare children: NodeGroup<ChildrenType>;

    constructor(id: string, public cls: AbstractConstructor<ChildrenType>) {
        super(id);
    }

    addChild<T extends TreeNode<any>>(child: T, onTop: boolean = false) {
        if (!(child instanceof this.cls)) throw TypeError(`${child} is not of the right type ${this.cls.name}`);
        return super.addChild(child, onTop);
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

