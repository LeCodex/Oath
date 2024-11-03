import { BurnResourcesEffect, MoveResourcesToTargetEffect, ParentToTargetEffect } from "./effects";
import { OathGameObject, OathGameObjectLeaf } from "./gameObject";
import { InvalidActionResolution } from "./actions/actions";
import { PlayerColor } from "./enums";
import { AbstractConstructor, Constructor } from "./utils";


let resourceId = 0;  // TOOD: Find better solution for unique ids
export abstract class OathResource extends OathGameObjectLeaf<number> {
    type = "resource";

    constructor() {
        super(resourceId++);
    }

    abstract burn(): void;
    static gain(target: OathGameObject, amount: number): void { };
}

export class Favor extends OathResource {
    static gain(target: OathGameObject, amount: number): void {
        target.addChildren(target.game.byClass(this).max(amount));
    }
    
    burn(): void {
        this.unparent();
    }
}

export class Secret extends OathResource {
    flipped: boolean = false;

    static gain(target: OathGameObject, amount: number): void {
        for (let i = 0; i < amount; i++)
            target.addChild(new this());
    }

    burn(): void {
        this.prune();
    }

    serialize(): Record<string, any> | undefined {
        const obj = super.serialize();
        return {
            ...obj,
            flipped: this.flipped
        };
    }
}

export type OathResourceType<T extends OathResource = OathResource> = AbstractConstructor<T>;


export class OathWarband extends OathGameObjectLeaf<number> {
    type = "warband";
    color: PlayerColor;

    constructor(color: PlayerColor) {
        super(resourceId++);
        this.color = color;
    }

    serialize(): Record<string, any> | undefined {
        const obj = super.serialize();
        return {
            ...obj,
            color: this.color
        };
    }
}


export abstract class ResourcesAndWarbands<T = any> extends OathGameObject<T> {
    abstract name: string;

    get empty() { return this.resources.length === 0; }
    get warbands() { return this.byClass(OathWarband); }
    get resources() { return this.byClass(OathResource); }

    putResources(type: typeof OathResource, amount: number): number {
        type.gain(this, amount);
        return this.getResources(type).length;
    }

    getResources<T extends OathResource>(type: OathResourceType<T>, amount: number = Infinity): T[] {
        const resources = this.byClass(type);
        amount = Math.min(resources.length, amount);
        return resources.max(amount);
    }

    getWarbandsAmount(color?: PlayerColor): number {
        if (!color) return 0;
        return this.warbands.byId(color).length;
    }

    putWarbands(color: PlayerColor, amount: number): number {
        const newAmount = this.getWarbandsAmount(color) + amount;
        for (let i = 0; i < amount; i ++) this.addChild(new OathWarband(color));
        return newAmount;
    }

    getWarbands(color: PlayerColor, amount: number = Infinity) {
        const warbands = this.warbands.byId(color);
        amount = Math.min(warbands.length, amount);
        return warbands.max(amount);
    }

    moveWarbandsTo(color: PlayerColor, target: ResourcesAndWarbands<any>, amount: number = Infinity): number {
        const warbands = this.getWarbands(color, amount);
        for (const warband of warbands) target?.addChild(warband);
        return warbands.length;
    }

    clear() {
        new BurnResourcesEffect(this.game, undefined, this.resources).do();

        for (const player of this.game.players)
            new ParentToTargetEffect(this.game, player, this.getWarbands(player.id), player.bag).do();
    }

    serialize(): Record<string, any> | undefined {
        const obj = super.serialize();
        return {
            ...obj,
            name: this.name
        }
    }
}

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
        const printResources = function(resources: Map<OathResourceType, number>, suffix: string) {
            if ([...resources].filter(([_, a]) => a > 0).length === 0) return undefined;
            return [...resources].map(([resource, number]) => `${number} ${resource.name}(s)`).join(", ") + suffix;
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
