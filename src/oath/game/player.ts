import { CampaignBanishPlayerAction } from "./actions/actions";
import { CampaignActionTarget, AtSite, OwnableObject } from "./interfaces";
import { Denizen, OwnableCard, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { Discard, DiscardOptions } from "./cards/decks";
import { BurnResourcesEffect, FlipSecretsEffect, GainSupplyEffect } from "./actions/effects";
import { ALL_OATH_SUITS, isEnumKey, OathSuit, PlayerColor } from "./enums";
import { Warband, ResourcesAndWarbands, Favor, OathResourceType } from "./resources";
import { Container, OathGameObject } from "./gameObject";
import { Banner } from "./banks";

export class WarbandsSupply extends Container<Warband, PlayerColor> {
    type = "bag";
    readonly id: PlayerColor;
    get hidden() { return true; }

    constructor(id: PlayerColor) {
        if (!isEnumKey(id, PlayerColor)) throw TypeError(`${id} is not a valid player color`);
        super(id, Warband);
    }

    get name() { return `${this.id}WarbandsSupply`; }
    get key() { return this.id; }
}

export class OathPlayer extends OathGameObject<number> implements CampaignActionTarget, AtSite {
    type = "player";
    name: string;
    board: PlayerBoard;
    supply: number = 7;
    site: Site;
    bag: WarbandsSupply;
    
    defense = 2;
    get force() { return this.board };
    
    get key() { return Number(this.id); }
    get advisers() { return this.byClass(WorldCard); }
    get relics() { return this.byClass(Relic); }
    get banners() { return this.byClass(Banner); }

    get isImperial() { return this.board?.isImperial ?? false; }    
    get leader(): OathPlayer { return this.board.isImperial ? this.game.chancellor : this; }
    get discard(): Discard | undefined { return this.game.map.nextRegion(this.site.region)?.discard || this.site.region?.discard; }
    get discardOptions() { return new DiscardOptions(this.discard ?? this.game.worldDeck); }
    get ruledSuits(): number { return ALL_OATH_SUITS.reduce((a, e) => a + (this.suitRuledCount(e) > 0 ? 1 : 0), 0); }
    get ruledSites(): number { return [...this.game.map.sites()].reduce((a, e) => a + (e.ruler === this ? 1 : 0), 0); }

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
    
    seize(player: OathPlayer) {
        new BurnResourcesEffect(this.game, this, Favor, Math.floor(this.byClass(Favor).length / 2), this.board).doNext();
        new CampaignBanishPlayerAction(player, this).doNext();
    }

    liteSerialize() {
        return {
            ...super.liteSerialize(),
            supply: this.supply,
            site: this.site?.id,
            board: this.board?.id
        };
    }

    parse(obj: ReturnType<this["liteSerialize"]>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.supply = obj.supply;
        const site = this.game.search<Site>("site", obj.site);
        this.site = site!;  // It can be undefined at the start of the game. It's bad, but it's controlled
        if (!obj.board) this.board = undefined as any;  // Same thing
    }
}

export abstract class PlayerBoard extends ResourcesAndWarbands<PlayerColor> implements OwnableObject {
    type = "board";
    readonly id: PlayerColor;

    bagAmount: number = 14;
    
    constructor(id: PlayerColor) {
        if (!isEnumKey(id, PlayerColor)) throw TypeError(`${id} is not a valid player color`);
        super(id);
    }
    
    get owner() { return this.typedParent(OathPlayer)!; }
    get key() { return this.id; }

    get isImperial() { return false; }

    setOwner(player?: OathPlayer): void {
        if (!player) throw new TypeError("Boards must have an owner");
        player?.addChild(this);
    }

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

    rest() {
        this.returnResources();
    }

    returnResources() {
        for (const site of this.game.map.sites())
            for (const denizen of site.denizens)
                denizen.returnResources();

        for (const player of this.game.players) {
            for (const adviser of player.advisers)
                adviser.returnResources();

            for (const relic of player.relics)
                relic.returnResources();
        }

        new FlipSecretsEffect(this.game, this.owner, Infinity, false).doNext();
    }
}

export class ChancellorBoard extends PlayerBoard {
    name = "Chancellor";
    bagAmount = 24;

    constructor() {
        super(PlayerColor.Purple);
    }

    get isImperial() { return true; }

    rest() {
        super.rest();

        let amount: number;
        if (this.owner.bag.amount >= 18) amount = 6;
        else if (this.owner.bag.amount >= 11) amount = 5;
        else if (this.owner.bag.amount >= 4) amount = 4;
        else amount = 3;

        new GainSupplyEffect(this.owner, amount).doNext();
    }
}

export class VisionSlot extends Container<Vision, PlayerColor> {
    type = "visionSlot";
    readonly id: PlayerColor;

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
    visionSlot: VisionSlot;

    constructor(id: PlayerColor) {
        super(id);
    }

    get name() { return `${this.id}Exile`; }
    get isImperial() { return this.isCitizen; }
    get vision() { return this.visionSlot.children[0]; }

    setVision(newVision?: Vision) {
        const oldVision = this.visionSlot.children[0]?.unparent();
        if (newVision) this.visionSlot.addChild(newVision);
        return oldVision;
    }

    rest() {
        super.rest();

        if (this.isImperial) {
            new GainSupplyEffect(this.owner, this.game.chancellor.supply).doNext();
            return;
        }

        let amount: number;
        if (this.owner.bag.amount >= 9) amount = 6;
        else if (this.owner.bag.amount >= 4) amount = 5;
        else amount = 4;

        new GainSupplyEffect(this.owner, amount).doNext();
    }

    liteSerialize() {
        return {
            ...super.liteSerialize(),
            isCitizen: this.isCitizen
        };
    }

    parse(obj: ReturnType<this["liteSerialize"]>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.isCitizen = obj.isCitizen;
    }
}
