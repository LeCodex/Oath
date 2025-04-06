import { OathGameObject, OathGameObjectLeaf } from "./gameObject";
import { PlayerColor } from "../enums";
import type { NodeGroup } from "./utils";
import { isEnumKey } from "../utils";


export abstract class OathResource extends OathGameObjectLeaf<number> {
    static resourceId = 0;  // TODO: Find better solution for unique ids
    readonly type = "resource";

    constructor(id?: string) {
        super(id ?? String(OathResource.resourceId++));
    }

    get key() { return Number(this.id); }
    get usable() { return true; }

    abstract burn(): void;
    static putOn(target: OathGameObject, amount: number): void { };
    static usable(target: OathGameObject): NodeGroup<OathResource> { return target.byClass(this); };
}

export class Favor extends OathResource {
    name = "Favor";

    static putOn(target: OathGameObject, amount: number): void {
        target.addChildren(target.game.byClass(this).max(amount));
    }

    burn(): void {
        this.unparent();
    }
}

export class Secret extends OathResource {
    flipped: boolean = false;

    get usable() { return !this.flipped; }

    static putOn(target: OathGameObject, amount: number): void {
        for (let i = 0; i < amount; i++) target.addChild(new this());
    }

    burn(): void {
        this.prune();
    }

    get name() { return `${this.flipped ? "Flipped" : ""}Secret`; }

    liteSerialize() {
        return {
            ...super.liteSerialize(),
            flipped: this.flipped
        };
    }

    parse(obj: ReturnType<this["liteSerialize"]>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.flipped = obj.flipped;
    }
}

export type OathResourceType = typeof OathResource;

export class Warband extends OathGameObjectLeaf<number> {
    readonly type = "warband";
    color: PlayerColor;

    constructor(id?: string) {
        super(id ?? String(OathResource.resourceId++));
    }

    colorize(color: PlayerColor) {
        this.color = color;
        return this;
    }

    get name() { return `${isEnumKey(this.color, PlayerColor) ? this.color : "Bandit"}Warband`; }
    get key() { return Number(this.id); }

    liteSerialize() {
        return {
            ...super.liteSerialize(),
            color: this.color
        };
    }

    parse(obj: ReturnType<this["liteSerialize"]>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.color = obj.color;
    }
}


export abstract class ResourcesAndWarbands<T = any> extends OathGameObject<T> {
    get empty() { return this.resources.length === 0; }
    get warbands() { return this.byClass(Warband); }
    get resources() { return this.byClass(OathResource); }

    putResources(type: typeof OathResource, amount: number): number {
        type.putOn(this, amount);
        return this.byClass(type).length;
    }

    getWarbandsAmount(color?: PlayerColor): number {
        if (color === undefined) return 0;
        return this.warbands.by("color", color).length;
    }

    putWarbands(color: PlayerColor, amount: number): number {
        this.game.players.find(e => e.board.id === color)?.bag.moveChildrenTo(this, amount);
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
}
