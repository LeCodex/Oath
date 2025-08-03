import { clone } from "lodash";
import type { OathPower} from ".";
import { ActionModifier, CostModifier } from ".";
import { ResolveCallbackEffect, type OathAction } from "../actions/base";
import type { OathActionManager } from "../actions/manager";
import type { WithPowers, SourceType } from "../model/interfaces";
import { hasPowers } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import type { TreeNode } from "../model/utils";
import type { AbstractConstructor, Constructor, MaskProxyManager } from "../utils";
import { allCombinations, isExtended } from "../utils";
import { ChooseModifiers, ModifiableAction } from "./actions";
import { powersIndex } from "./classIndex";
import { MultiCostContext } from "./context";
import type { Cost, CostContext} from "../costs";
import { ResourceTransferContext } from "../costs";


export class OathPowerManager {
    modifiedActions = new WeakSet<OathAction>();
    futureActionsModifiable = new WeakMap<OathAction, ModifiableAction<OathAction>>();

    constructor(public actionManager: OathActionManager) {
        actionManager.on("addFutureAction", (action) => {
            if (action instanceof ResolveCallbackEffect || action instanceof ModifiableAction || action instanceof ChooseModifiers) return;
            // console.log("      Intercepted adding", action.constructor.name);
            const modifiableAction = this.getModifiable(action);
            const chooseModifiers = new ChooseModifiers(this, modifiableAction);
            actionManager.futureActionsList.shift();
            chooseModifiers.doNext();
        });
    }

    get game() { return this.actionManager.game; }

    getModifiable(action: OathAction) {
        const modifiableAction = new ModifiableAction(action);
        this.futureActionsModifiable.set(action, modifiableAction);
        return modifiableAction;
    }

    *getPowers<T extends OathPower<WithPowers>>(type: AbstractConstructor<T>, maskProxyManager?: MaskProxyManager): Generator<[SourceType<T>, Constructor<T>], void> {
        const stack: TreeNode<any>[] = [maskProxyManager?.get(this.game) ?? this.game];
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

    gatherActionModifiers<T extends OathAction>(action: T, activator: OathPlayer, maskProxyManager?: MaskProxyManager): Set<ActionModifier<WithPowers, T>> {
        const instances = new Set<ActionModifier<WithPowers, T>>();
        for (const [source, modifier] of this.getPowers(ActionModifier<WithPowers, T>, maskProxyManager)) {
            const instance = new modifier(this, source.original, activator, action, activator);
            if (action instanceof instance.modifiedAction && instance.canUse()) instances.add(instance);
        }

        return instances;
    }

    modifiersCostContext(player: OathPlayer, modifiers: CostModifier<WithPowers, CostContext<any>>[]): MultiCostContext<ResourceTransferContext> {
        const contexts: ResourceTransferContext[] = modifiers.map((e) => new ResourceTransferContext(player, this, e.cost, e.source));
        return new MultiCostContext(this, player, contexts, ResourceTransferContext.dummyFactory(player));
    }

    modifyCostContext<T extends CostContext<Cost>>(costContext: T, modifiers: Iterable<CostModifier<WithPowers, T>>) {
        for (const modifier of modifiers) {
            modifier.apply(costContext);
        }
    }

    costsWithModifiers<T extends CostContext<Cost>>(costContext: T, maskProxyManager: MaskProxyManager) {
        const modifiers: CostModifier<WithPowers, T>[] = [];
        for (const [sourceProxy, modifier] of this.getPowers(CostModifier<WithPowers, T>, maskProxyManager)) {
            const instance = new modifier(this, sourceProxy.original, costContext.player, maskProxyManager);
            if (costContext instanceof instance.modifiedContext && instance.canUse(costContext))
                modifiers.push(instance);
        }
        const mustUse = modifiers.filter((e) => e.mustUse);
        const canUse = modifiers.filter((e) => !e.mustUse);
        return allCombinations(canUse).map((e) => mustUse.concat(e)).map((combination) => {
            const context = clone(costContext);
            context.cost = clone(costContext.cost);
            if (combination.length) {
                this.modifyCostContext(context, combination);
                if (!this.modifiersCostContext(costContext.player, combination).costsWithModifiers(maskProxyManager).length) return undefined;
            }
            if (!costContext.valid) return undefined;
            return { context, modifiers: combination };
        }).filter((e) => !!e);
    }
}