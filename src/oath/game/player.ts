import { CampaignAction, CampaignActionTarget, CampaignBanishPlayerAction, ChooseModifiers, MusterAction, RecoverAction, SearchAction, TradeAction, TravelAction } from "./actions";
import { Denizen, OwnableCard, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { Discard } from "./cards/decks";
import { AddActionToStackEffect, DiscardCardEffect, MoveResourcesToTargetEffect } from "./effects";
import { OathResource, OathSuit, PlayerColor } from "./enums";
import { OathGame, OathGameObject } from "./game";
import { Brutal, Careless, Decadent, Greedy } from "./power";
import { Banner, ResourcesAndWarbands } from "./resources";
import { CopiableWithOriginal } from "./utils";

export interface OwnableObject extends CopiableWithOriginal {
    owner?: OathPlayer;

    setOwner(player?: OathPlayer): void;
}

export function isOwnable(obj: object): obj is OwnableObject {
    return "owner" in obj;
}

export abstract class OathPlayer extends ResourcesAndWarbands implements CampaignActionTarget {
    name: string;
    color: PlayerColor;
    warbandsInBag: number;
    supply: number = 7;
    
    site: Site;
    advisers = new Set<WorldCard>();
    relics = new Set<Relic>();
    banners = new Set<Banner>();
    
    defense = 2;
    pawnMustBeAtSite = true;

    constructor(game: OathGame, site: Site, color: PlayerColor) {
        super(game);
        this.site = site;
        this.color = color;
    }

    get isImperial(): boolean { return false; }
    get leader(): OathPlayer { return this.isImperial ? this : this.game.chancellor; }
    get discard(): Discard { return this.game.board.nextRegion(this.site.region).discard; }

    adviserSuitCount(suit: OathSuit): number {
        let total = 0;
        for (const adviser of this.advisers) if (!adviser.facedown && adviser instanceof Denizen && adviser.suit === suit) total++;
        return total;
    }

    rules(card: OwnableCard) {
        return card.ruler === (this.isImperial ? this.game.chancellor : this);
    }

    enemyWith(player: OathPlayer | undefined) {
        if (!this.isImperial) return true;
        return !player || !player?.isImperial;
    }

    moveWarbandsFromBagOnto(target: ResourcesAndWarbands, amount: number): number {
        const oldBagAmount = this.leader.warbandsInBag;
        const newBagAmount = Math.max(oldBagAmount - amount);
        const diff = oldBagAmount - newBagAmount;

        this.leader.warbandsInBag -= diff;
        target.putWarbands(this.leader, diff);
        return diff;
    }

    moveWarbandsIntoBagFrom(source: ResourcesAndWarbands, amount: number = Infinity): number {
        const warbandsAmount = source.takeWarbands(this, amount);
        this.warbandsInBag += warbandsAmount;
        return warbandsAmount;
    }

    moveOwnWarbands(from: ResourcesAndWarbands, to: ResourcesAndWarbands, amount: number): number {
        return from.moveWarbandsTo(this.leader, to, amount);
    }

    addAdviser(card: WorldCard) {
        this.advisers.add(card);
    }

    removeAdviser(card: WorldCard): WorldCard {
        this.advisers.delete(card);
        return card;
    }

    ruledSuitCount(suit: OathSuit): number {
        let total = 0;
        for (const site of this.game.board.sites()) {
            for (const denizen of site.denizens) {
                if (denizen.ruler === this) total++;
            }
        }

        return this.adviserSuitCount(suit) + total;
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
        new MoveResourcesToTargetEffect(this.game, this, OathResource.Favor, Math.floor(this.getResources(OathResource.Favor) / 2), undefined).do();
        new CampaignBanishPlayerAction(player, this).doNext();
    }

    // -------------- MAJOR ACTIONS ------------- //
    // TODO: Should those functions add to the stack directly, or use the appropriate effect?
    startSearch() {
        new SearchAction(this).doNext();
    }

    startMuster() {
        new MusterAction(this).doNext();
    }

    startTrade() {
        new TradeAction(this).doNext();
    }

    startTravel() {
        new TravelAction(this).doNext();
    }

    startRecover() {
        new RecoverAction(this).doNext();
    }

    startCampaign() {
        new CampaignAction(this).doNext();
    }

    abstract rest(): void;
}

export class Chancellor extends OathPlayer {
    warbandsInBag = 24;
    reliquary = new Reliquary(this.game);

    constructor(game: OathGame, site: Site) {
        super(game, site, PlayerColor.Purple);
    }

    get isImperial(): boolean { return true; }

    rest() {
        if (this.warbandsInBag >= 18) this.gainSupply(6);
        else if (this.warbandsInBag >= 11) this.gainSupply(5);
        else if (this.warbandsInBag >= 4) this.gainSupply(4);
        else this.gainSupply(3);
    }
}

export class Reliquary extends OathGameObject {
    relics: [Relic?, Relic?, Relic?, Relic?];
    powers = [Brutal, Greedy, Careless, Decadent];

    constructor(game: OathGame) {
        super(game);
        for (let i = 0; i < 4; i++) this.relics[i] = game.relicDeck.drawSingleCard();
    }

    putRelic(relic: Relic, index: number): Relic | undefined {
        const oldRelic = this.relics[index];
        this.relics[index] = relic;
        return oldRelic;
    }

    takeRelic(index: number): Relic | undefined {
        const relic = this.relics[index];
        this.relics[index] = undefined;
        return relic;
    }
}

export class Exile extends OathPlayer {
    warbandsInBag = 14;

    isCitizen: boolean;
    vision?: Vision;

    get isImperial(): boolean { return this.isCitizen; }

    setVision(newVision?: Vision) {
        const oldVision = this.vision;
        this.vision = newVision;
        return oldVision;
    }

    becomeCitizen() {
        // TODO: Use effects for all of this
        for (const site of this.game.board.sites())
            this.game.chancellor.moveWarbandsFromBagOnto(site, this.moveWarbandsIntoBagFrom(site));
        this.game.chancellor.moveWarbandsFromBagOnto(this, this.moveWarbandsIntoBagFrom(this));

        this.isCitizen = true;
        if (this.vision) {
            new DiscardCardEffect(this, this.vision).do();
            this.vision = undefined;
        }

        this.supply = 7;
        if (this.game.currentPlayer == this) this.game.endTurn();
    }

    becomeExile() {
        this.isCitizen = false;
        this.moveWarbandsFromBagOnto(this, this.game.chancellor.moveWarbandsIntoBagFrom(this));
    }

    rest() {
        if (this.isImperial) {
            this.gainSupply(this.game.chancellor.supply);
            return;
        }

        if (this.warbandsInBag >= 9) this.gainSupply(6);
        else if (this.warbandsInBag >= 4) this.gainSupply(5);
        else this.gainSupply(4);
    }
}
