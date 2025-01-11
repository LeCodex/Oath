import { BurnResourcesEffect, ParentToTargetEffect } from "./actions/effects";
import { OathGameObject, OathGameObjectLeaf } from "./gameObject";
import { InvalidActionResolution } from "./actions/base";
import { PlayerColor } from "./enums";
import { allCombinations, isEnumKey, MaskProxyManager, NodeGroup } from "./utils";
import { OathPlayer } from "./player";
import { WithCost, WithPowers } from "./interfaces";
import { CostModifier } from "./powers";
import { clone } from "lodash";


export abstract class OathResource extends OathGameObjectLeaf<number> {
    static resourceId = 0;  // TOOD: Find better solution for unique ids
    readonly type = "resource";

    constructor(id?: string) {
        super(id ?? String(OathResource.resourceId++));
    }

    get key() { return Number(this.id); }

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

    static putOn(target: OathGameObject, amount: number): void {
        for (let i = 0; i < amount; i++) target.addChild(new this());
    }

    static usable(target: OathGameObject): NodeGroup<OathResource> { return target.byClass(this).by("flipped", false); };

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

    clear() {
        for (const resource of [Favor, Secret])
            new BurnResourcesEffect(this.game, undefined, resource, Infinity, this).doNext();

        for (const player of this.game.players)
            new ParentToTargetEffect(this.game, player, this.getWarbands(player.board.key), player.bag).doNext();
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
        const parseResources = (resources: { [k: string]: number }) =>
            Object.entries(resources).map<[OathResourceType, number]>(([k, v]: [keyof typeof resourceClasses, number]) => [resourceClasses[k]!, v]);
        return new this(parseResources(obj.placedResources), parseResources(obj.burntResources));
    }

    toString() {
        const printResources = function(resources: Map<OathResourceType, number>, suffix: string) {
            if ([...resources].filter(([_, a]) => a > 0).length === 0) return undefined;
            return [...resources].map(([resource, number]) => `${number} ${resource.name}(s)`).join(", ") + suffix;
        }
        return [printResources(this.placedResources, " placed"), printResources(this.burntResources, " burnt")].filter(e => e !== undefined).join(", ");
    }
}

export class ResourceCostContext {
    source: OathGameObject;

    constructor(
        public player: OathPlayer,
        public origin: WithCost,
        public cost: ResourceCost,
        public target: OathGameObject | undefined,
        source?: OathGameObject
    ) {
        this.source = source || this.player;
    }

    payableCostsWithModifiers(maskProxyManager: MaskProxyManager) {
        const modifiers: CostModifier<any>[] = [];
        for (const [source, modifier] of maskProxyManager.get(this.player.game).getPowers(CostModifier)) {
            const instance = new modifier(source, this.player, maskProxyManager);
            if (instance.canUse(this)) modifiers.push(instance);
        }

        const mustUse = modifiers.filter(e => e.mustUse);
        const canUse = modifiers.filter(e => !e.mustUse);
        const combinations = allCombinations(canUse).map(e => [...mustUse, ...e]);
        return combinations.map(combination => {
            let context: ResourceCostContext = clone(this);
            for (const modifier of combination) context = modifier.modifyCostContext(context);

            console.log(this.origin.constructor.name, context.cost.totalResources);
            for (const [resource, amount] of context.cost.totalResources)
                if (context.source.byClass(resource).length < amount)
                    return undefined;
            
            return { context, modifiers: combination };
        }).filter(e => !!e);
    }

    modify(modifiers: Iterable<CostModifier<WithPowers>>) {
        for (const modifier of modifiers) {
            const newContext = modifier.modifyCostContext(this);
            this.cost = newContext.cost;
            this.source = newContext.source;
            this.target = newContext.target;
        }
    }
}