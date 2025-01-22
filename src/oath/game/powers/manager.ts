import type { OathPower } from ".";
import { ActionModifier } from ".";
import { ResolveCallbackEffect, type OathAction } from "../actions/base";
import type { OathActionManager } from "../actions/manager";
import type { WithPowers, SourceType } from "../model/interfaces";
import { hasPowers } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import type { TreeNode } from "../model/utils";
import type { AbstractConstructor, Constructor } from "../utils";
import { isExtended } from "../utils";
import { ChooseModifiers, ModifiableAction } from "./actions";
import { powersIndex } from "./classIndex";


export class OathPowerManager {
    modifiedActions = new WeakSet<OathAction>();
    futureActionsModifiable = new WeakMap<OathAction, ModifiableAction<OathAction>>();

    constructor(public actionManager: OathActionManager) {
        actionManager.on("addFutureAction", (action) => {
            if (action instanceof ResolveCallbackEffect || action instanceof ModifiableAction || action instanceof ChooseModifiers) return;
            // console.log("      Intercepted adding", action.constructor.name);
            const modifiableAction = new ModifiableAction(action);
            this.futureActionsModifiable.set(action, modifiableAction);
            const chooseModifiers = new ChooseModifiers(this, modifiableAction);
            actionManager.futureActionsList.shift();
            actionManager.futureActionsList.unshift(chooseModifiers);
        });
    }

    get game() { return this.actionManager.game; }

    *getPowers<T extends OathPower<WithPowers>>(type: AbstractConstructor<T>): Generator<[SourceType<T>, Constructor<T>], void> {
        const stack: TreeNode<any>[] = [this.game];
        while (stack.length) {
            const node = stack.pop()!;
            stack.push(...node.children);
            if (hasPowers(node) && node.active) {
                for (const power of node.powers) {
                    const powerCls = powersIndex[power];
                    if (isExtended(powerCls, type))
                        yield [node as SourceType<T>, powerCls];
                }
            }
        }
    }

    gatherActionModifiers<T extends OathAction>(action: T, activator: OathPlayer): Set<ActionModifier<WithPowers, T>> {
        const instances = new Set<ActionModifier<WithPowers, T>>();
        for (const [source, modifier] of this.getPowers(ActionModifier<WithPowers, T>)) {
            const instance = new modifier(this, source.original, activator, action, activator);
            if (action instanceof instance.modifiedAction && instance.canUse()) instances.add(instance);
        }

        return instances;
    }
}