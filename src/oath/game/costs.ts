import type { OathPlayer } from "./model/player";
import type { OathResourceType} from "./model/resources";
import { Favor, Secret } from "./model/resources";
import { Factory, NumberMap } from "./utils";
import type { OathGameObject } from "./model/gameObject";
import { Oath } from "./model/oaths";


export abstract class Cost {
    abstract add(other: Cost): void;
}

export class ResourceCost extends Cost {
    placedResources: NumberMap<OathResourceType>;
    burntResources: NumberMap<OathResourceType>;

    constructor(placedResources: Iterable<[OathResourceType, number]> = [], burntResources: Iterable<[OathResourceType, number]> = []) {
        super();
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

export class SupplyCost extends Cost {
    constructor(
        public base: number,
        public modifier: number = 0,
        public flatModifier: number = 0,
        public multiplier: number = 1,
    ) {
        super();
    }

    get amount() { return this.flatModifier + (this.base + this.modifier) * this.multiplier; }

    add(other: SupplyCost): void {
        this.flatModifier += other.amount;
    }
}


export abstract class CostContext<T extends Cost, S = any> {
    constructor(
        public readonly player: OathPlayer,
        public readonly origin: any, // TODO: This sucks. Need to find a better way of differentiating contexts
        public cost: T,
        public source: S
    ) { }
    
    abstract isValid(): boolean;
    
    static dummyFactory(player: OathPlayer): Factory<CostContext<Cost, any>, [any, Cost?]> {
        throw TypeError("Not implemented");
    };
}
export type ContextSource<T extends CostContext<Cost>> = T extends CostContext<Cost, infer S> ? S : never; 
export type ContextCost<T extends CostContext<Cost>> = T extends CostContext<infer T> ? T : never; 

export class ResourceTransferContext extends CostContext<ResourceCost, OathGameObject> {
    constructor(
        player: OathPlayer,
        origin: any,
        cost: ResourceCost,
        public target: OathGameObject | undefined,
        source?: OathGameObject
    ) {
        super(player, origin, cost, source ?? player);
    }

    isValid(): boolean {
        for (const [resource, amount] of this.cost.totalResources)
            if (this.source.byClass(resource).filter(e => e.usable).length < amount)
                return false;

        return true;
    }

    static dummyFactory(player: OathPlayer): Factory<ResourceTransferContext, [OathGameObject, ResourceCost?]> {
        return (source, cost) => new ResourceTransferContext(player, undefined, cost ?? new ResourceCost(), source, source);
    }
}

export class SupplyCostContext extends CostContext<SupplyCost, OathPlayer> {
    constructor(
        player: OathPlayer,
        origin: any,
        cost: SupplyCost,
        source?: OathPlayer
    ) {
        super(player, origin, cost, source ?? player);
    }

    isValid(): boolean {
        return this.player.supply >= this.cost.amount;
    }

    static dummyFactory(player: OathPlayer): Factory<SupplyCostContext, [OathPlayer, SupplyCost?]> {
        return (source, cost) => new SupplyCostContext(player, undefined, cost ?? new SupplyCost(0), source);
    }
}
