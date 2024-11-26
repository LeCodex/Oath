import { CampaignBanishPlayerAction } from "./actions/actions";
import { CampaignActionTarget, AtSite } from "./interfaces";
import { Denizen, OwnableCard, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { Discard, DiscardOptions } from "./cards/decks";
import { BurnResourcesEffect, FlipSecretsEffect, GainSupplyEffect } from "./actions/effects";
import { ALL_OATH_SUITS, isEnumKey, OathSuit, PlayerColor } from "./enums";
import { OathWarband, ResourcesAndWarbands, Favor, OathResourceType } from "./resources";
import { Container } from "./gameObject";
import { Banner } from "./banks";
import { Reliquary } from "./reliquary";

export class WarbandsSupply extends Container<OathWarband, PlayerColor> {
    type = "bag";
    id: keyof typeof PlayerColor;
    hidden = true;

    constructor(id: keyof typeof PlayerColor) {
        if (!isEnumKey(id, PlayerColor)) throw TypeError(`${id} is not a valid player color`);
        super(id, OathWarband);
    }

    get key() { return PlayerColor[this.id]; }
}

export abstract class OathPlayer extends ResourcesAndWarbands<PlayerColor> implements CampaignActionTarget, AtSite {
    type = "player";
    id: keyof typeof PlayerColor;
    bagAmount: number = 14;
    supply: number = 7;
    site: Site;
    bag: WarbandsSupply;
    
    defense = 2;
    force = this;

    constructor(id: keyof typeof PlayerColor) {
        if (!isEnumKey(id, PlayerColor)) throw TypeError(`${id} is not a valid player color`);
        super(id);
    }

    get key() { return PlayerColor[this.id]; }
    get advisers() { return this.byClass(WorldCard); }
    get denizens() { return this.byClass(Denizen); }
    get relics() { return this.byClass(Relic); }
    get banners()  { return this.byClass(Banner); }

    get isImperial(): boolean { return false; }
    get leader(): OathPlayer { return this.isImperial ? this.game.chancellor : this; }
    get discard(): Discard | undefined { return this.game.board.nextRegion(this.site.region)?.discard || this.site.region?.discard; }
    get discardOptions() { return new DiscardOptions(this.discard ?? this.game.worldDeck); }
    get ruledSuits(): number { return ALL_OATH_SUITS.reduce((a, e) => a + (this.suitRuledCount(e) > 0 ? 1 : 0), 0); }
    get ruledSites(): number { return [...this.game.board.sites()].reduce((a, e) => a + (e.ruler === this ? 1 : 0), 0); }

    getAllResources(type: OathResourceType): number {
        let amount = this.byClass(type).length;
        for (const site of this.game.board.sites())
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
        for (const adviser of this.denizens) if (!adviser.facedown && adviser.suit === suit) total++;
        return total;
    }

    suitRuledCount(suit: OathSuit): number {
        let total = 0;
        for (const site of this.game.board.sites())
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
        return from.moveWarbandsTo(this.key, to, amount);
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
        new BurnResourcesEffect(this.game, this, Favor, Math.floor(this.byClass(Favor).length / 2)).doNext();
        new CampaignBanishPlayerAction(player, this).doNext();
    }

    rest() {
        this.returnResources();
    }

    returnResources() {
        for (const site of this.game.board.sites())
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

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            name: this.name,
            supply: this.supply,
            site: this.site?.id,
        };
    }

    parse(obj: Record<string, any>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        const site = this.game.search("Site", obj.site);
        if (!site) throw TypeError(`Couldn't find Site with id ${obj.site}`);
        this.supply = obj.supply;
        this.site = site as Site;
    }
}

export class Chancellor extends OathPlayer {
    name = "Chancellor";
    bagAmount = 24;
    reliquary: Reliquary;

    constructor() {
        super("Purple");
    }

    get isImperial(): boolean { return true; }

    rest() {
        super.rest();

        let amount: number;
        if (this.bag.amount >= 18) amount = 6;
        else if (this.bag.amount >= 11) amount = 5;
        else if (this.bag.amount >= 4) amount = 4;
        else amount = 3;

        new GainSupplyEffect(this, amount).doNext();
    }
}

export class VisionSlot extends Container<Vision, PlayerColor> {
    type = "visionSlot";
    id: keyof typeof PlayerColor;

    constructor(id: keyof typeof PlayerColor) {
        super(id, Vision);
    }

    get key() { return PlayerColor[this.id]; }
}

export class Exile extends OathPlayer {
    name: string;
    isCitizen: boolean;
    visionSlot: VisionSlot;

    constructor(id: keyof typeof PlayerColor) {
        super(id);
        this.name = id + "Exile";
    }

    get isImperial(): boolean { return this.isCitizen; }
    get vision() { return this.visionSlot.children[0]; }

    setVision(newVision?: Vision) {
        const oldVision = this.visionSlot.children[0]?.unparent();
        if (newVision) this.visionSlot.addChild(newVision);
        return oldVision;
    }

    rest() {
        super.rest();

        if (this.isImperial) {
            new GainSupplyEffect(this, this.game.chancellor.supply).doNext();
            return;
        }

        let amount: number;
        if (this.bag.amount >= 9) amount = 6;
        else if (this.bag.amount >= 4) amount = 5;
        else amount = 4;

        new GainSupplyEffect(this, amount).doNext();
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            isCitizen: this.isCitizen
        };
    }

    parse(obj: Record<string, any>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.isCitizen = obj.isCitizen;
    }
}
