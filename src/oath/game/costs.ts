import { clone } from "lodash";
import { InvalidActionResolution } from "./actions/base";
import type { OathGameObject } from "./gameObject";
import type { WithPowers } from "./interfaces";
import type { OathPlayer } from "./player";
import { CostModifier } from "./powers";
import type { OathResourceType} from "./resources";
import { Favor, Secret } from "./resources";
import type { MaskProxyManager} from "./utils";
import { NumberMap, allChoices, allCombinations } from "./utils";


export class ResourceCost {
    placedResources: NumberMap<OathResourceType>;
    burntResources: NumberMap<OathResourceType>;

    constructor(placedResources: Iterable<[OathResourceType, number]> = [], burntResources: Iterable<[OathResourceType, number]> = []) {
        this.placedResources = new NumberMap(placedResources);
        this.burntResources = new NumberMap(burntResources);
    }

    get totalResources() {
        const total = new NumberMap<OathResourceType>();
        for (const [resource, amount] of this.placedResources) total.set(resource, amount);
        for (const [resource, amount] of this.burntResources) total.set(resource, total.get(resource) + amount);
        return total;
    }

    get placesResources() {
        for (const amount of this.placedResources.values()) if (amount) return true;
        return false;
    }

    get free(): boolean {
        for (const amount of this.placedResources.values()) if (amount) return false;
        for (const amount of this.burntResources.values()) if (amount) return false;
        return true;
    }

    get cannotPayError(): InvalidActionResolution {
        let message = "Cannot pay resource cost: ";
        message += this.toString();
        return new InvalidActionResolution(message);
    }

    add(other: ResourceCost) {
        for (const [resource, amount] of other.placedResources) this.placedResources.set(resource, this.placedResources.get(resource) + amount);
        for (const [resource, amount] of other.burntResources) this.burntResources.set(resource, this.burntResources.get(resource) + amount);
    }

    serialize() {
        return {
            placedResources: Object.fromEntries([...this.placedResources.entries()].map(([k, v]) => [k.name, v])),
            burntResources: Object.fromEntries([...this.burntResources.entries()].map(([k, v]) => [k.name, v])),
        };
    }

    static parse(obj: ReturnType<ResourceCost["serialize"]>): ResourceCost {
        const resourceClasses = { Favor, Secret };
        const parseResources = (resources: { [k: string]: number; }) => Object.entries(resources).map<[OathResourceType, number]>(([k, v]: [keyof typeof resourceClasses, number]) => [resourceClasses[k]!, v]);
        return new this(parseResources(obj.placedResources), parseResources(obj.burntResources));
    }

    toString() {
        const printResources = function (resources: Map<OathResourceType, number>, suffix: string) {
            if ([...resources].filter(([_, a]) => a > 0).length === 0) return undefined;
            return [...resources].map(([resource, number]) => `${number} ${resource.name}${number > 1 ? "s" : ""}`).join(", ") + suffix;
        };
        return [printResources(this.placedResources, " placed"), printResources(this.burntResources, " burnt")].filter(e => e !== undefined).join(", ");
    }
}

export abstract class CostContext<T> {
    constructor(
        public readonly player: OathPlayer,
        public readonly origin: any,  // TODO: This sucks. Need to find a better way of differentiating contexts
        public cost: T
    ) { }

    modifiersCostContext(modifiers: CostModifier<WithPowers, CostContext<T>>[]) {
        const contexts: ResourceTransferContext[] = modifiers.map(e => new ResourceTransferContext(this.player, this, e.cost, e.source));
        return new MultiResourceTransferContext(this.player, this, contexts);
    }

    payableCostsWithModifiers(maskProxyManager: MaskProxyManager) {
        const modifiers: CostModifier<WithPowers, CostContext<T>>[] = [];
        for (const [source, modifier] of maskProxyManager.get(this.player.game).getPowers(CostModifier)) {
            const instance = new modifier(source, this.player, maskProxyManager);
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
        player: OathPlayer,
        origin: any,
        cost: ResourceCost,
        public target: OathGameObject | undefined,
        source?: OathGameObject
    ) {
        super(player, origin, cost);
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
        player: OathPlayer,
        origin: any,
        public costContexts: ResourceTransferContext[]
    ) {
        super(player, origin, costContexts.map(e => e.cost));
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

export class SupplyCost {
    constructor(
        public base: number,
        public modifier: number = 0,
        public multiplier: number = 1
    ) { }

    get amount() { return (this.base + this.modifier) * this.multiplier; }
}

export class SupplyCostContext extends CostContext<SupplyCost> {
    isValid(): boolean {
        return this.player.supply >= this.cost.base;
    }
}
