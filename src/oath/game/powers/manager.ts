import type { OathPower } from ".";
import { ActionModifier } from ".";
import type { ModifiableAction } from "../actions/base";
import { OathActionManager } from "../actions/manager";
import type { OathGame } from "../model/game";
import type { WithPowers, SourceType } from "../model/interfaces";
import { hasPowers } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import type { TreeNode } from "../model/utils";
import type { AbstractConstructor, Constructor } from "../utils";
import { isExtended } from "../utils";

export class OathPowersManager {
    constructor(
        public game: OathGame,
        public actionManager: OathActionManager
    ) { }

    *getPowers<T extends OathPower<WithPowers>>(type: AbstractConstructor<T>): Generator<[SourceType<T>, Constructor<T>], void> {
        const stack: TreeNode<any>[] = [this.game];
        while (stack.length) {
            const node = stack.pop()!;
            stack.push(...node.children);
            if (hasPowers(node) && node.active)
                for (const power of node.powers)
                    if (isExtended(power, type))
                        yield [node as SourceType<T>, power];
        }
    }

    gatherActionModifiers<T extends ModifiableAction>(action: T, activator: OathPlayer): Set<ActionModifier<WithPowers, T>> {
        const instances = new Set<ActionModifier<WithPowers, T>>();
        for (const [sourceProxy, modifier] of this.getPowers(ActionModifier<WithPowers, T>)) {
            const instance = new modifier(sourceProxy.original, activator, action, activator);
            if (action instanceof instance.modifiedAction && instance.canUse()) instances.add(instance);
        }

        return instances;
    }
}