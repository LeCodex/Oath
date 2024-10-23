import { MoveResourcesToTargetEffect, TakeWarbandsIntoBagEffect } from "./effects";
import { OathResource, OathResourceName } from "./enums"
import { OathGameObject } from "./gameObject";
import { OathPlayer } from "./player";
import { ResourceBank } from "./banks";
import { InvalidActionResolution } from "./actions/actions";


export abstract class ResourcesAndWarbands extends OathGameObject {
    abstract name: string;
    resources = new Map<OathResource, number>();
    warbands = new Map<OathPlayer, number>();
    
    get empty(): boolean {
        return this.totalResources === 0;
    }

    get totalWarbands(): number {
        let total = 0;
        for (const number of this.warbands.values()) total += number;
        return total;
    }

    get totalResources(): number {
        let total = 0;
        for (const number of this.resources.values()) total += number;
        return total;
    }

    getResources(resource: OathResource): number {
        return this.resources.get(resource) || 0;
    }

    putResources(resource: OathResource, amount: number): number {
        const newAmount = this.getResources(resource) + amount;
        this.resources.set(resource, newAmount);
        return newAmount;
    }
    
    putResourcesIntoBank(bank: ResourceBank | undefined, amount: number = Infinity): number {
        if (!bank) return 0;
        const numberMoved = this.takeResources(bank.type, amount);
        bank.put(numberMoved);
        return numberMoved;
    }

    takeResources(resource: OathResource, amount: number = Infinity): number {
        const oldAmount = this.getResources(resource);
        const newAmount = Math.max(oldAmount - amount, 0);
        this.resources.set(resource, newAmount);
        return oldAmount - newAmount;
    }

    takeResourcesFromBank(bank: ResourceBank | undefined, amount: number = Infinity): number {
        if (!bank) return 0;
        const numberMoved = bank.take(amount);
        this.putResources(bank.type, numberMoved);
        return numberMoved;
    }

    moveResourcesTo(resource: OathResource, target: ResourcesAndWarbands | undefined, amount: number = Infinity, exact: boolean = false): number {
        if (exact && this.getResources(resource) < amount) return 0;
        const numberMoved = this.takeResources(resource, amount);
        if (target) target.putResources(resource, numberMoved);
        return numberMoved;
    }

    getWarbands(player: OathPlayer | undefined): number {
        if (!player) return 0;
        return this.warbands.get(player) || 0;
    }

    putWarbands(player: OathPlayer, amount: number): number {
        const newAmount = this.getWarbands(player) + amount;
        this.warbands.set(player, newAmount);
        return newAmount;
    }

    takeWarbands(player: OathPlayer, amount: number = Infinity): number {
        const oldAmount = this.getWarbands(player);
        const newAmount = Math.max(oldAmount - amount, 0);
        this.warbands.set(player, newAmount);
        return oldAmount - newAmount;
    }

    moveWarbandsTo(player: OathPlayer, target: ResourcesAndWarbands, amount: number = Infinity): number {
        const numberMoved = this.takeWarbands(player, amount);
        target.putWarbands(player, numberMoved);
        return numberMoved;
    }

    clear() {
        for (const [resource, amount] of this.resources)
            new MoveResourcesToTargetEffect(this.game, undefined, resource, amount, undefined, this).do();

        for (const [player, amount] of this.warbands)
            new TakeWarbandsIntoBagEffect(player, amount, this);
    }

    serialize(): Record<string, any> {
        return {
            resources: Object.fromEntries([...this.resources.entries()]),
            warbands: Object.fromEntries([...this.warbands.entries()].map(([k, v]) => [k.color, v])),
        };
    }
}

export class ResourceCost {
    placedResources: Map<OathResource, number>;
    burntResources: Map<OathResource, number>;

    constructor(placedResources: Iterable<[OathResource, number]> = [], burntResources: Iterable<[OathResource, number]> = []) {
        this.placedResources = new Map(placedResources);
        this.burntResources = new Map(burntResources);
    }

    get totalResources(): Map<OathResource, number> {
        const total = new Map<OathResource, number>();
        for (const [resource, amount] of this.placedResources) total.set(resource, amount);
        for (const [resource, amount] of this.burntResources) total.set(resource, (total.get(resource) || 0) + amount);
        return total;
    }

    get free(): boolean {
        for (const amount of this.placedResources.values()) if (amount) return false;
        for (const amount of this.burntResources.values()) if (amount) return false;
        return true;
    }

    get cannotPayError(): InvalidActionResolution {
        let message = "Cannot pay resource cost: ";
        const printResources = function(resources: Map<OathResource, number>, suffix: string) {
            if ([...resources].filter(([_, a]) => a > 0).length === 0) return undefined;
            return [...resources].map(([resource, number]) => `${number} ${OathResourceName[resource]}(s)`).join(", ") + suffix;
        }
        message += [printResources(this.placedResources, " placed"), printResources(this.burntResources, " burnt")].filter(e => e !== undefined).join(", ");
        return new InvalidActionResolution(message);
    }

    add(other: ResourceCost) {
        for (const [resource, amount] of other.placedResources) this.placedResources.set(resource, (this.placedResources.get(resource) || 0) + amount);
        for (const [resource, amount] of other.burntResources) this.burntResources.set(resource, (this.burntResources.get(resource) || 0) + amount);
    }

    serialize(): Record<string, any> {
        return {
            placedResources: Object.fromEntries([...this.placedResources.entries()]),
            burntResources: Object.fromEntries([...this.burntResources.entries()]),
        };
    }
}