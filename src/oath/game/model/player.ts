import type { CampaignActionTarget, AtSite, OwnableObject, WithPowers } from "./interfaces";
import type { OwnableCard, Site } from "./cards";
import { Denizen, Relic, Vision, WorldCard } from "./cards";
import { DiscardOptions } from "./decks";
import type { OathSuit } from "../enums";
import { ALL_OATH_SUITS, PlayerColor } from "../enums";
import { isEnumKey } from "../utils";
import type { OathResourceType } from "./resources";
import { Warband, ResourcesAndWarbands } from "./resources";
import { Container, OathGameObject } from "./gameObject";
import { Banner } from "./banks";
import type { SerializedNode } from "./utils";

export class WarbandsSupply extends Container<Warband, PlayerColor> {
    readonly type = "bag";
    declare readonly id: PlayerColor;
    get hidden() { return true; }

    constructor(id: PlayerColor) {
        if (!isEnumKey(id, PlayerColor)) throw TypeError(`${id} is not a valid player color`);
        super(id, Warband);
    }

    get name() { return `${this.id}WarbandsSupply`; }
    get key() { return this.id; }
}

export class OathPlayer extends ResourcesAndWarbands<number> implements CampaignActionTarget, AtSite {
    readonly type = "player";
    active = true;
    name: string;
    supply: number = 7;
    site: Site;
    
    defense = 2;
    get force() { return this; }
    
    get key() { return Number(this.id); }
    get advisers() { return this.byClass(WorldCard); }
    get relics() { return this.byClass(Relic); }
    get banners() { return this.byClass(Banner); }
    get bag() { return this.byClass(WarbandsSupply)[0]!; }
    get board() { return this.byClass(PlayerBoard)[0]!; }

    get isImperial() { return this.board?.isImperial ?? false; }    
    get leader() { return this.board.isImperial ? this.game.chancellor : this; }
    get discard() { return this.game.map.nextRegion(this.site.region)?.discard || this.site.region?.discard; }
    get discardOptions() { return new DiscardOptions(this.discard ?? this.game.worldDeck); }
    get ruledSuits() { return ALL_OATH_SUITS.reduce((a, e) => a + (this.suitRuledCount(e) > 0 ? 1 : 0), 0); }
    get ruledSites() { return [...this.game.map.sites()].reduce((a, e) => a + (e.ruler === this ? 1 : 0), 0); }

    getAllResources(type: OathResourceType): number {
        let amount = this.byClass(type).length;
        for (const site of this.game.map.sites())
            for (const denizen of site.denizens)
                amount += denizen.byClass(type).length;

        for (const player of this.game.players) {
            for (const adviser of player.advisers)
                amount += adviser.byClass(type).length;

            for (const relic of player.relics)
                amount += relic.byClass(type).length;
        }

        return amount;
    }

    suitAdviserCount(suit: OathSuit): number {
        let total = 0;
        for (const adviser of this.advisers)
            if (adviser instanceof Denizen && !adviser.facedown && adviser.suit === suit)
                total++;
        
        return total;
    }
    
    suitRuledCount(suit: OathSuit): number {
        let total = 0;
        for (const site of this.game.map.sites())
            for (const denizen of site.denizens)
                if (this.rules(denizen)) total++;
    
        return this.suitAdviserCount(suit) + total;
    }
    
    rules(card: OwnableCard) {
        return card.ruler === this.leader || card.ruler === this;
    }
    
    enemyWith(player: OathPlayer | undefined) {
        if (player === this) return false;
        if (!this.isImperial) return true;
        return !player || !player?.isImperial;
    }
    
    moveOwnWarbands(from: ResourcesAndWarbands, to: ResourcesAndWarbands, amount: number): number {
        return from.moveWarbandsTo(this.board.key, to, amount);
    }
    
    gainSupply(amount: number) {
        this.supply = Math.min(7, this.supply + amount);
    }
    
    paySupply(amount: number): boolean {
        if (this.supply < amount) return false;
        this.supply -= amount;
        return true;
    }

    liteSerialize() {
        return {
            ...super.liteSerialize(),
            supply: this.supply,
            site: this.site?.id,
            board: this.board?.id
        };
    }

    parse(obj: SerializedNode<this>, allowCreation?: boolean): this {
        super.parse(obj, allowCreation);
        this.supply = obj.supply;
        const site = this.game.search<Site>("site", obj.site);
        this.site = site!;  // It can be undefined at the start of the game. It's bad, but it's controlled
        return this;
    }
}

export abstract class PlayerBoard extends OathGameObject<PlayerColor> implements OwnableObject {
    readonly type = "board";
    declare readonly id: PlayerColor;

    bagAmount: number = 14;
    
    constructor(id: PlayerColor) {
        if (!isEnumKey(id, PlayerColor)) throw TypeError(`${id} is not a valid player color`);
        super(id);
    }
    
    get key() { return this.id; }
    get owner() { return this.typedParent(OathPlayer)!; }

    get isImperial() { return false; }

    setOwner(player?: OathPlayer): void {
        if (!player) throw new TypeError("Boards must have an owner");
        player?.addChild(this);
    }

    abstract get restAmount(): number;
}

export class ChancellorBoard extends PlayerBoard {
    declare readonly id: PlayerColor.Purple;
    name = "Chancellor";
    bagAmount = 24;

    constructor() {
        super(PlayerColor.Purple);
    }

    get isImperial() { return true; }

    get restAmount() {
        if (this.owner.bag.amount >= 18) return 6;
        if (this.owner.bag.amount >= 11) return 5;
        if (this.owner.bag.amount >= 4) return 4;
        return 3;
    }
}

export class VisionSlot extends Container<Vision, PlayerColor> {
    readonly type = "visionSlot";
    declare readonly id: PlayerColor;

    constructor(id: PlayerColor) {
        if (!isEnumKey(id, PlayerColor)) throw new TypeError(`${id} is not a valid player color`);
        super(id, Vision);
    }

    get hidden() { return this.children.length === 0; }
    get name() { return `${this.id}VisionSlot`; }
    get key() { return this.id; }
}

export class ExileBoard extends PlayerBoard {
    isCitizen: boolean;

    constructor(id: PlayerColor) {
        super(id);
    }

    get name() { return `${this.id}Exile`; }
    get isImperial() { return this.isCitizen; }
    get visionSlot() { return this.byClass(VisionSlot)[0]!; }
    get vision() { return this.visionSlot.children[0]; }

    setVision(newVision?: Vision) {
        const oldVision = this.visionSlot.children[0]?.unparent();
        if (newVision) this.visionSlot.addChild(newVision);
        return oldVision;
    }

    get restAmount() {
        if (this.isImperial) return this.game.chancellor.supply;
        if (this.owner.bag.amount >= 9) return 6;
        if (this.owner.bag.amount >= 4) return 5;
        return 4;
    }

    liteSerialize() {
        return {
            ...super.liteSerialize(),
            isCitizen: this.isCitizen
        };
    }

    parse(obj: SerializedNode<this>, allowCreation?: boolean): this {
        super.parse(obj, allowCreation);
        this.isCitizen = obj.isCitizen;
        return this;
    }
}
