import { clone } from "lodash";
import { CostModifier } from ".";
import type { SupplyCost } from "../costs";
import { ResourceCost } from "../costs";
import type { OathGameObject } from "../model/gameObject";
import type { WithPowers } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import type { MaskProxyManager} from "../utils";
import { allChoices, allCombinations } from "../utils";
import { OathPowerManager } from "./manager";


export abstract class CostContext<T> {
    constructor(
        public readonly powerManager: OathPowerManager,
        public readonly player: OathPlayer,
        public readonly origin: any, // TODO: This sucks. Need to find a better way of differentiating contexts
        public cost: T
    ) { }

    modifiersCostContext(modifiers: CostModifier<WithPowers, CostContext<T>>[]) {
        const contexts: ResourceTransferContext[] = modifiers.map(e => new ResourceTransferContext(this.powerManager, this.player, this, e.cost, e.source));
        return new MultiResourceTransferContext(this.powerManager, this.player, this, contexts);
    }

    payableCostsWithModifiers(maskProxyManager: MaskProxyManager) {
        const modifiers: CostModifier<WithPowers, CostContext<T>>[] = [];
        for (const [sourceProxy, modifier] of this.powerManager.getPowers(CostModifier, maskProxyManager)) {
            const instance = new modifier(this.powerManager, sourceProxy.original, this.player, maskProxyManager);
            if (this instanceof instance.modifiedContext && instance.canUse(this)) modifiers.push(instance);
        }
        const mustUse = modifiers.filter(e => e.mustUse);
        const canUse = modifiers.filter(e => !e.mustUse);
        return allCombinations(canUse).map(e => [...mustUse, ...e]).map(combination => {
            const context: CostContext<T> = clone(this);
            context.cost = clone(this.cost);
            if (combination.length) {
                context.modify(combination);
                if (!this.modifiersCostContext(combination).payableCostsWithModifiers(maskProxyManager).length) return undefined;
            }
            if (!context.isValid()) return undefined;
            return { context, modifiers: combination };
        }).filter(e => !!e);
    }

    modify(modifiers: Iterable<CostModifier<WithPowers, this>>) {
        for (const modifier of modifiers) {
            modifier.apply(this);
        }
    }
    
    abstract isValid(): boolean;
}

export class ResourceTransferContext extends CostContext<ResourceCost> {
    source: OathGameObject;

    constructor(
        powerManager: OathPowerManager,
        player: OathPlayer,
        origin: any,
        cost: ResourceCost,
        public target: OathGameObject | undefined,
        source?: OathGameObject
    ) {
        super(powerManager, player, origin, cost);
        this.source = source || this.player;
    }

    isValid(): boolean {
        for (const [resource, amount] of this.cost.totalResources)
            if (this.source.byClass(resource).length < amount)
                return false;

        return true;
    }
}

export class MultiResourceTransferContext extends CostContext<ResourceCost[]> {
    constructor(
        powerManager: OathPowerManager,
        player: OathPlayer,
        origin: any,
        public costContexts: ResourceTransferContext[]
    ) {
        super(powerManager, player, origin, costContexts.map(e => e.cost));
    }

    payableCostsWithModifiers(maskProxyManager: MaskProxyManager) {
        const payableCostsInfo = this.costContexts.map(e => e.payableCostsWithModifiers(maskProxyManager));
        return allChoices(payableCostsInfo).map(choice => {
            const context: MultiResourceTransferContext = clone(this);
            context.costContexts = choice.map(e => e.context as ResourceTransferContext);
            context.cost = context.costContexts.map(e => e.cost);
            if (!context.isValid()) return undefined;
            return { context, modifiers: [] };  // Technically, none of the modifiers are applied to the Multi (and none should, for now)
        }).filter(e => !!e);
    }
    
    isValid(): boolean {
        const totalCostBySource = new Map<OathGameObject, ResourceCost>();
        for (const costContext of this.costContexts) {
            if (!totalCostBySource.has(costContext.source))
                totalCostBySource.set(costContext.source, new ResourceCost());
            totalCostBySource.get(costContext.source)!.add(costContext.cost);
        }

        for (const [source, totalCost] of totalCostBySource)
            for (const [resource, amount] of totalCost.totalResources)
                if (source.byClass(resource).length < amount)
                    return false;

        return true;
    }
}

export class SupplyCostContext extends CostContext<SupplyCost> {
    isValid(): boolean {
        return this.player.supply >= this.cost.base;
    }
}
