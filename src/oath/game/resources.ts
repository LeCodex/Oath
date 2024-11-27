import { BurnResourcesEffect, ParentToTargetEffect } from "./actions/effects";
import { OathGameObject, OathGameObjectLeaf } from "./gameObject";
import { InvalidActionResolution } from "./actions/base";
import { PlayerColor } from "./enums";
import { AbstractConstructor } from "./utils";


let resourceId = 0;  // TOOD: Find better solution for unique ids
export abstract class OathResource extends OathGameObjectLeaf<number> {
    type = "resource";

    constructor(id?: string) {
        super(id ?? String(resourceId++));
    }

    get key() { return Number(this.id); }

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
        for (let i = 0; i < amount; i++) target.addChild(new this());
    }

    burn(): void {
        this.prune();
    }

    serialize(): Record<string, any> | undefined {
        return {
            ...super.serialize(),
            flipped: this.flipped
        };
    }

    parse(obj: Record<string, any>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.flipped = obj.flipped;
    }
}

export type OathResourceType<T extends OathResource = OathResource> = AbstractConstructor<T>;


export class OathWarband extends OathGameObjectLeaf<number> {
    type = "warband";
    color: PlayerColor;

    constructor(id?: string) {
        super(id ?? String(resourceId++));
    }

    colorize(color: PlayerColor) {
        this.color = color;
        return this;
    }

    get key() { return Number(this.id); }

    serialize(): Record<string, any> | undefined {
        return {
            ...super.serialize(),
            color: this.color
        };
    }

    parse(obj: Record<string, any>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.color = obj.color;
    }
}


export abstract class ResourcesAndWarbands<T = any> extends OathGameObject<T> {
    abstract name: string;

    get empty() { return this.resources.length === 0; }
    get warbands() { return this.byClass(OathWarband); }
    get resources() { return this.byClass(OathResource); }

    putResources(type: typeof OathResource, amount: number): number {
        type.gain(this, amount);
        return this.byClass(type).length;
    }

    getWarbandsAmount(color?: PlayerColor): number {
        if (color === undefined) return 0;
        return this.warbands.by("color", color).length;
    }

    putWarbands(color: PlayerColor, amount: number): number {
        this.game.players.byKey(color)[0]?.bag.moveChildrenTo(this, amount);
        return this.getWarbandsAmount(color);
    }

    getWarbands(color: PlayerColor, amount: number = Infinity) {
        const warbands = this.warbands.by("color", color);
        amount = Math.min(warbands.length, amount);
        return warbands.max(amount);
    }

    moveWarbandsTo(color: PlayerColor, target: ResourcesAndWarbands<any>, amount: number = Infinity): number {
        const warbands = this.getWarbands(color, amount);
        for (const warband of warbands) target?.addChild(warband);
        return warbands.length;
    }

    clear() {
        for (const resource of [Favor, Secret])
            new BurnResourcesEffect(this.game, undefined, resource, Infinity, this).doNext();

        for (const player of this.game.players)
            new ParentToTargetEffect(this.game, player, this.getWarbands(player.key), player.bag).doNext();
    }

    serialize(): Record<string, any> | undefined {
        return {
            ...super.serialize(),
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
