import { CampaignBanishPlayerAction } from "./actions/actions";
import { CampaignActionTarget, AtSite } from "./interfaces";
import { Denizen, OwnableCard, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { Discard } from "./cards/decks";
import { FlipSecretsEffect, GainSupplyEffect, MoveResourcesToTargetEffect } from "./effects";
import { OathResource, OathSuit, PlayerColor } from "./enums";
import { OathGame } from "./game";
import { ResourcesAndWarbands } from "./resources";
import { Banner } from "./banks";
import { Reliquary } from "./reliquary";

export abstract class OathPlayer extends ResourcesAndWarbands implements CampaignActionTarget, AtSite {
    name: string;
    color: PlayerColor;
    warbandsInBag: number;
    supply: number = 7;
    
    site: Site;
    advisers = new Set<WorldCard>();
    relics = new Set<Relic>();
    banners = new Set<Banner>();
    
    defense = 2;
    force = this;

    constructor(game: OathGame, color: PlayerColor) {
        super(game);
        this.color = color;
    }

    get isImperial(): boolean { return false; }
    get leader(): OathPlayer { return this.isImperial ? this.game.chancellor : this; }
    get discard(): Discard { return this.game.board.nextRegion(this.site.region).discard; }
    get ruledSuits(): number { return [0, 1, 2, 3, 4, 5].reduce((a, e) => a + (this.suitRuledCount(e) > 0 ? 1 : 0), 0); }
    get ruledSites(): number { return [...this.game.board.sites()].reduce((a, e) => a + (e.ruler === this ? 1 : 0), 0); }

    getAllResources(resource: OathResource): number {
        let amount = this.getResources(resource);
        for (const site of this.game.board.sites())
            for (const denizen of site.denizens)
                amount += denizen.getResources(resource);

        for (const player of Object.values(this.game.players)) {
            for (const adviser of player.advisers)
                amount += adviser.getResources(resource);

            for (const relic of player.relics)
                amount += relic.getResources(resource);
        }

        return amount;
    }

    suitAdviserCount(suit: OathSuit): number {
        let total = 0;
        for (const adviser of this.advisers) if (!adviser.facedown && adviser instanceof Denizen && adviser.suit === suit) total++;
        return total;
    }

    suitRuledCount(suit: OathSuit): number {
        let total = 0;
        for (const site of this.game.board.sites()) {
            for (const denizen of site.denizens) {
                if (denizen.ruler === this) total++;
            }
        }

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

    moveWarbandsFromBagOnto(target: ResourcesAndWarbands, amount: number): number {
        const oldBagAmount = this.warbandsInBag;
        const newBagAmount = Math.max(oldBagAmount - amount);
        const diff = oldBagAmount - newBagAmount;

        this.warbandsInBag -= diff;
        target.putWarbands(this, diff);
        return diff;
    }

    moveWarbandsIntoBagFrom(source: ResourcesAndWarbands, amount: number = Infinity): number {
        const warbandsAmount = source.takeWarbands(this, amount);
        this.leader.warbandsInBag += warbandsAmount;
        return warbandsAmount;
    }

    moveOwnWarbands(from: ResourcesAndWarbands, to: ResourcesAndWarbands, amount: number): number {
        return from.moveWarbandsTo(this, to, amount);
    }

    addAdviser(card: WorldCard) {
        this.advisers.add(card);
    }

    removeAdviser(card: WorldCard): WorldCard {
        this.advisers.delete(card);
        return card;
    }

    addRelic(relic: Relic) {
        this.relics.add(relic);
    }

    removeRelic(relic: Relic): Relic {
        this.relics.delete(relic);
        return relic;
    }

    addBanner(banner: Banner) {
        this.banners.add(banner);
    }

    removeBanner(banner: Banner): Banner {
        this.banners.delete(banner);
        return banner;
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
        // TODO: Move burnt favor to supply
        new MoveResourcesToTargetEffect(this.game, this, OathResource.Favor, Math.floor(this.getResources(OathResource.Favor) / 2), undefined).doNext();
        new CampaignBanishPlayerAction(player, this).doNext();
    }

    rest() {
        this.returnResources();
    }

    returnResources() {
        for (const site of this.game.board.sites())
            for (const denizen of site.denizens)
                denizen.returnResources();

        for (const player of Object.values(this.game.players)) {
            for (const adviser of player.advisers)
                adviser.returnResources();

            for (const relic of player.relics)
                relic.returnResources();
        }

        new FlipSecretsEffect(this.game, this, Infinity, false).do();
    }

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.name = this.name;
        obj.warbandsInBag = this.warbandsInBag;
        obj.supply = this.supply;
        obj.site = this.site?.name;
        obj.advisers = [...this.advisers].map(e => e.serialize())
        obj.relics = [...this.relics].map(e => e.serialize())
        obj.banners = [...this.banners].map(e => e.name)
        return obj;
    }
}

export class Chancellor extends OathPlayer {
    name = "Chancellor";
    warbandsInBag = 24;
    reliquary = new Reliquary(this.game);

    constructor(game: OathGame) {
        super(game, PlayerColor.Purple);
    }

    get isImperial(): boolean { return true; }

    rest() {
        super.rest();

        let amount: number;
        if (this.warbandsInBag >= 18) amount = 6;
        else if (this.warbandsInBag >= 11) amount = 5;
        else if (this.warbandsInBag >= 4) amount = 4;
        else amount = 3;

        new GainSupplyEffect(this, amount).do();
    }

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.reliquary = this.reliquary.serialize();
        return obj;
    }
}

export class Exile extends OathPlayer {
    warbandsInBag = 14;

    isCitizen: boolean;
    vision?: Vision;

    constructor(game: OathGame, color: PlayerColor) {
        super(game, color);
        this.name = "Exile " + color;
    }

    get isImperial(): boolean { return this.isCitizen; }

    setVision(newVision?: Vision) {
        const oldVision = this.vision;
        this.vision = newVision;
        return oldVision;
    }

    rest() {
        super.rest();

        if (this.isImperial) {
            new GainSupplyEffect(this, this.game.chancellor.supply).do();
            return;
        }

        let amount: number;
        if (this.warbandsInBag >= 9) amount = 6;
        else if (this.warbandsInBag >= 4) amount = 5;
        else amount = 4;

        new GainSupplyEffect(this, amount).do();
    }

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.isCitizen = this.isCitizen;
        obj.vision = this.vision?.serialize();
        return obj;
    }
}
