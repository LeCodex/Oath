import { CampaignBanishPlayerAction } from "./actions";
import type { CampaignActionTarget, AtSite, OwnableObject } from "./interfaces";
import type { OwnableCard, Site} from "./cards";
import { Denizen, Relic, Vision, WorldCard } from "./cards";
import { DiscardOptions } from "./cards/decks";
import { TransferResourcesEffect, FlipSecretsEffect, GainSupplyEffect } from "./actions/effects";
import type { OathSuit} from "./enums";
import { ALL_OATH_SUITS, PlayerColor } from "./enums";
import { isEnumKey } from "./utils";
import type { OathResourceType } from "./resources";
import { Warband, ResourcesAndWarbands, Favor } from "./resources";
import { Container, OathGameObject } from "./gameObject";
import { Banner } from "./banks";
import { ResourceCost , ResourceTransferContext } from "./costs";


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

        new FlipSecretsEffect(this.game, this, Infinity, false).doNext();
    }
    
    seize(player: OathPlayer) {
        new TransferResourcesEffect(this.game, new ResourceTransferContext(this, this, new ResourceCost([], [[Favor, Math.floor(this.byClass(Favor).length / 2)]]), undefined)).doNext();
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

    rest() {
        this.owner.returnResources();
    }
}

export class ChancellorBoard extends PlayerBoard {
    declare readonly id: PlayerColor.Purple;
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
