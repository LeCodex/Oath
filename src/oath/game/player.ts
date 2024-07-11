import { CampaignAction, CampaignActionTarget, CampaignBanishPlayerAction, ChooseModifiers, MusterAction, RecoverAction, SearchAction, TradeAction, TravelAction } from "./actions";
import { Denizen, OwnableCard, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { Discard } from "./cards/decks";
import { AddActionToStackEffect, DiscardCardEffect, MoveResourcesToTargetEffect } from "./effects";
import { OathResource, OathSuit } from "./enums";
import { OathGame, OathGameObject } from "./game";
import { Brutal, Careless, Decadent, Greedy } from "./power";
import { Banner, ResourcesAndWarbands } from "./resources";

export interface OwnableObject {
    owner?: OathPlayer;

    setOwner(player?: OathPlayer): void;
}

export function isOwnable(obj: object): obj is OwnableObject {
    return "owner" in obj;
}


export class OathPlayerData extends InternalData<OathPlayer> {
    site: Site;
    advisers = new Set<WorldCard>();
    relics = new Set<Relic>();
    banners = new Set<Banner>();
    isImperial: boolean;

    get discard(): Discard { return this.instance.game.board.nextRegion(this.site.region).discard; }

    adviserSuitCount(suit: OathSuit): number {
        let total = 0;
        for (const adviser of this.advisers) if (!adviser.facedown && adviser instanceof Denizen && adviser.suit === suit) total++;
        return total;
    }

    proxy(): this {
        const proxy = super.proxy();
        proxy.isImperial = this.instance.isImperial;
        proxy.adviserSuitCount = this.adviserSuitCount;
        return proxy;
    }
}

export abstract class OathPlayer extends ResourcesAndWarbands implements CampaignActionTarget {
    name: string;
    warbandsInBag: number;
    supply: number = 7;
    
    data = new OathPlayerData(this);
    
    defense = 2;
    takenFromPlayer = true;

    constructor(game: OathGame, site: Site) {
        super(game);
        this.data.site = site;
    }

    get isImperial(): boolean { return false; }
    get ownWarbands(): number { return this.warbands.get(this.isImperial ? this : this.game.chancellor) || 0; }

    rules(card: OwnableCard) {
        return card.ruler === (this.isImperial ? this.game.chancellor : this);
    }

    enemyWith(player: OathPlayer | undefined) {
        if (!this.isImperial) return true;
        return !player || !player?.isImperial;
    }

    moveWarbandsFromBagOnto(target: ResourcesAndWarbands, amount: number): number {
        const owner = this.isImperial ? this : this.game.chancellor;

        const oldBagAmount = owner.warbandsInBag;
        const newBagAmount = Math.max(oldBagAmount - amount);
        const diff = oldBagAmount - newBagAmount;

        owner.warbandsInBag -= diff;
        target.putWarbands(owner, diff);
        return diff;
    }

    moveWarbandsIntoBagFrom(source: ResourcesAndWarbands, amount: number = Infinity): number {
        const warbandsAmount = source.takeWarbands(this, amount);
        this.warbandsInBag += warbandsAmount;
        return warbandsAmount;
    }

    moveOwnWarbands(from: ResourcesAndWarbands, to: ResourcesAndWarbands, amount: number): number {
        return from.moveWarbandsTo(this.isImperial ? this : this.game.chancellor, to, amount);
    }

    addAdviser(card: WorldCard) {
        this.data.advisers.add(card);
    }

    removeAdviser(card: WorldCard): WorldCard {
        this.data.advisers.delete(card);
        return card;
    }

    ruledSuitCount(suit: OathSuit): number {
        let total = 0;
        for (const site of this.game.board.sites()) {
            for (const denizen of site.denizens) {
                if (denizen.ruler === this) total++;
            }
        }

        return this.data.adviserSuitCount(suit) + total;
    }

    addRelic(relic: Relic) {
        this.data.relics.add(relic);
    }

    removeRelic(relic: Relic): Relic {
        this.data.relics.delete(relic);
        return relic;
    }

    addBanner(banner: Banner) {
        this.data.banners.add(banner);
    }

    removeBanner(banner: Banner): Banner {
        this.data.banners.delete(banner);
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
        new MoveResourcesToTargetEffect(this.game, this.data, OathResource.Favor, Math.floor(this.getResources(OathResource.Favor) / 2), undefined).do();
        new AddActionToStackEffect(new CampaignBanishPlayerAction(player.data, this)).do();
    }

    // -------------- MAJOR ACTIONS ------------- //
    // TODO: Should those functions add to the stack directly, or use the appropriate effect?
    startSearch() {
        this.game.actionStack.push(new ChooseModifiers(new SearchAction(this.data)));
    }

    startMuster() {
        this.game.actionStack.push(new ChooseModifiers(new MusterAction(this.data)));
    }

    startTrade(forFavor: boolean) {
        this.game.actionStack.push(new ChooseModifiers(new TradeAction(this.data)));
    }

    startTravel() {
        this.game.actionStack.push(new ChooseModifiers(new TravelAction(this.data)));
    }

    startRecover() {
        this.game.actionStack.push(new ChooseModifiers(new RecoverAction(this.data)));
    }

    startCampaign() {
        this.game.actionStack.push(new ChooseModifiers(new CampaignAction(this.data)));
    }

    abstract rest(): void;
}

export class Chancellor extends OathPlayer {
    warbandsInBag = 24;

    reliquary = new Reliquary(this.game);

    get isImperial(): boolean { return true; }

    rest() {
        if (this.ownWarbands >= 18) this.gainSupply(6);
        else if (this.ownWarbands >= 11) this.gainSupply(5);
        else if (this.ownWarbands >= 4) this.gainSupply(4);
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
            new DiscardCardEffect(this.data, this.vision).do();
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
        if (this.ownWarbands >= 9) this.gainSupply(6);
        else if (this.ownWarbands >= 4) this.gainSupply(5);
        else this.gainSupply(4);
    }
}
