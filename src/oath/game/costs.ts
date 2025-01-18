import type { OathResourceType} from "./model/resources";
import { Favor, Secret } from "./model/resources";
import { NumberMap } from "./utils";


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

export class SupplyCost {
    constructor(
        public base: number,
        public modifier: number = 0,
        public multiplier: number = 1
    ) { }

    get amount() { return (this.base + this.modifier) * this.multiplier; }
}
