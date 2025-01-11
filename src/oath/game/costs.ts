import { clone } from "lodash";
import { InvalidActionResolution } from "./actions/base";
import { OathGameObject } from "./gameObject";
import { WithPowers } from "./interfaces";
import { OathPlayer } from "./player";
import { CostModifier } from "./powers";
import { Favor, OathResourceType, Secret } from "./resources";
import { MaskProxyManager, allCombinations } from "./utils";


export class ResourceCost {
    placedResources: Map<OathResourceType, number>;
    burntResources: Map<OathResourceType, number>;

    constructor(placedResources: Iterable<[OathResourceType, number]> = [], burntResources: Iterable<[OathResourceType, number]> = []) {
        this.placedResources = new Map(placedResources);
        this.burntResources = new Map(burntResources);
    }

    get totalResources() {
        const total = new Map<OathResourceType, number>();
        for (const [resource, amount] of this.placedResources) total.set(resource, amount);
        for (const [resource, amount] of this.burntResources) total.set(resource, (total.get(resource) ?? 0) + amount);
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
        for (const [resource, amount] of other.placedResources) this.placedResources.set(resource, (this.placedResources.get(resource) ?? 0) + amount);
        for (const [resource, amount] of other.burntResources) this.burntResources.set(resource, (this.burntResources.get(resource) ?? 0) + amount);
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
            return [...resources].map(([resource, number]) => `${number} ${resource.name}(s)`).join(", ") + suffix;
        };
        return [printResources(this.placedResources, " placed"), printResources(this.burntResources, " burnt")].filter(e => e !== undefined).join(", ");
    }
}

export abstract class CostContext<T> {
    source: OathGameObject;

    constructor(
        public player: OathPlayer,
        public origin: any,  // TODO: This sucks. Need to find a better way of differentiating contexts
        public cost: T,
        public target: OathGameObject | undefined,
        source?: OathGameObject
    ) {
        this.source = source || this.player;
    }

    payableCostsWithModifiers(maskProxyManager: MaskProxyManager) {
        const modifiers: CostModifier<WithPowers, CostContext<T>>[] = [];
        for (const [source, modifier] of maskProxyManager.get(this.player.game).getPowers(CostModifier)) {
            const instance = new modifier(source, this.player, maskProxyManager);
            if (this instanceof instance.modifiedContext && instance.canUse(this)) modifiers.push(instance);
        }

        const mustUse = modifiers.filter(e => e.mustUse);
        const canUse = modifiers.filter(e => !e.mustUse);
        const combinations = allCombinations(canUse).map(e => [...mustUse, ...e]);
        return combinations.map(combination => {
            let context: CostContext<T> = clone(this);
            for (const modifier of combination) context = modifier.modifyCostContext(context);

            if (!this.isValid(context as this)) return undefined;
            return { context, modifiers: combination };
        }).filter(e => !!e);
    }

    modify(modifiers: Iterable<CostModifier<WithPowers, this>>) {
        for (const modifier of modifiers) {
            const newContext = modifier.modifyCostContext(this);
            this.cost = newContext.cost;
            this.source = newContext.source;
            this.target = newContext.target;
        }
    }

    abstract isValid(context: this): boolean;
}

export class ResourceTransferContext extends CostContext<ResourceCost> {
    isValid(context: this): boolean {
        for (const [resource, amount] of context.cost.totalResources)
            if (context.source.byClass(resource).length < amount)
                return false;

        return true;
    }
}

export class SupplyCostContext extends CostContext<number> {
    isValid(context: this): boolean {
        return this.player.supply >= context.cost;
    }
}
