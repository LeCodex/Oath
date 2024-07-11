import { Denizen, OwnableCard, Site, Vision, WorldCard } from "./cards/cards";
import { BannerName, CardRestriction, OathResource, OathSuit } from "./enums";
import { Exile, OathPlayer, OathPlayerData } from "./player";
import { EffectModifier, WhenPlayed } from "./power";
import { PeoplesFavor, ResourceBank, ResourceCost, ResourcesAndWarbands } from "./resources";
import { OwnableObject } from "./player";
import { OathGame, OathGameObject } from "./game";
import { InvalidActionResolution, OathAction } from "./actions";
import { CardDeck, SearchableDeck } from "./cards/decks";


//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export abstract class OathEffect<T> extends OathGameObject {
    readonly data: OathPlayerData | undefined;
    modifiers: EffectModifier<any>[];

    constructor(game: OathGame, data: OathPlayerData | undefined) {
        super(game);
        this.data = data;
    }

    get player(): OathPlayer | undefined { return this.data?.instance; }

    do(): T {
        this.applyModifiers();
        
        // Whenever we resolve an effect, we add it to the stack
        this.game.currentEffects.unshift(this);
        let result = this.resolve();
        this.afterResolution();
        
        return result;
    }

    applyModifiers() {
        for (const [source, modifier] of this.game.getPowers(EffectModifier<any>)) {
            const instance = new modifier(source, this);
            if (instance.canUse()) {  // All Effect Modifiers are must-use
                this.modifiers.push(instance);
                instance.applyDuring();
            }
        };
    }

    abstract resolve(): T;
    
    afterResolution() {
        for (const modifier of this.modifiers) modifier.applyAfter();
    };

    abstract revert(): void;
}

export abstract class PlayerEffect<T> extends OathEffect<T> {
    readonly data: OathPlayerData;

    constructor(data: OathPlayerData) {
        super(data.instance.game, data);
        this.player.defense;
    }

    get player(): OathPlayer { return this.data.instance; }
}


//////////////////////////////////////////////////
//                   EFFECTS                    //
//////////////////////////////////////////////////
export class AddActionToStackEffect extends OathEffect<void> {
    action: OathAction;

    constructor(action: OathAction) {
        super(action.game, undefined);
        this.action = action;
    }

    resolve(): void {
        this.game.actionStack.push(this.action);
    }

    revert(): void {
        this.game.actionStack.pop();
    }
}

export class PutResourcesOnTargetEffect extends OathEffect<number> {
    resource: OathResource;
    amount: number;
    target?: ResourcesAndWarbands;

    constructor(game: OathGame, data: OathPlayerData | undefined, resource: OathResource, amount: number, target?: ResourcesAndWarbands) {
        super(game, data);
        this.resource = resource;
        this.amount = amount;
        this.target = target || this.player;
    }

    resolve(): number {
        // TODO: Take favor from supply
        return this.target?.putResources(this.resource, this.amount) || 0;
    }

    revert(): void {
        this.target?.takeResources(this.resource, this.amount);
    }
}

export class MoveResourcesToTargetEffect extends OathEffect<number> {
    resource: OathResource;
    amount: number;
    target?: ResourcesAndWarbands;
    source?: ResourcesAndWarbands;

    constructor(game: OathGame, data: OathPlayerData | undefined, resource: OathResource, amount: number, target: ResourcesAndWarbands | undefined, source?: ResourcesAndWarbands) {
        super(game, data);
        this.resource = resource;
        this.amount = amount;
        this.target = target;
        this.source = source || this.player;
    }

    resolve(): number {
        this.amount = this.source?.moveResourcesTo(this.resource, this.target, this.amount) || 0;
        return this.amount;
    }

    revert(): void {
        if (this.target)
            this.target.moveResourcesTo(this.resource, this.source, this.amount);
        else
            this.source?.putResources(this.resource, this.amount);
    }
}

export class PutResourcesIntoBankEffect extends OathEffect<number> {
    amount: number;
    bank?: ResourceBank;
    source?: ResourcesAndWarbands;

    constructor(game: OathGame, data: OathPlayerData | undefined, bank: ResourceBank | undefined, amount: number, source?: ResourcesAndWarbands | undefined) {
        super(game, data);
        this.bank = bank;
        this.amount = amount;
        this.source = source || this.player;
    }

    resolve(): number {
        if (!this.source) return this.bank?.put(this.amount) || 0;
        return this.source.putResourcesIntoBank(this.bank, this.amount);
    }

    revert(): void {
        if (!this.source)
            this.bank?.take(this.amount);
        else
            this.source.takeResourcesFromBank(this.bank, this.amount);
    }
}

export class TakeResourcesFromBankEffect extends OathEffect<number> {
    amount: number;
    bank?: ResourceBank;
    target?: ResourcesAndWarbands;

    constructor(game: OathGame, data: OathPlayerData | undefined, bank: ResourceBank | undefined, amount: number, target?: ResourcesAndWarbands | undefined) {
        super(game, data);
        this.bank = bank;
        this.amount = amount;
        this.target = target || this.player;
    }

    resolve(): number {
        if (!this.target)
            this.amount = this.bank?.take(this.amount) || 0;
        else
            this.amount = this.target.takeResourcesFromBank(this.bank, this.amount);

        return this.amount;
    }

    revert(): void {
        if (!this.target)
            this.bank?.put(this.amount);
        else
            this.target.putResourcesIntoBank(this.bank, this.amount);
    }
}

export class MoveBankResourcesEffect extends OathEffect<number> {
    amount: number;
    from: ResourceBank;
    to: ResourceBank;
 
    constructor(game: OathGame, data: OathPlayerData | undefined, from: ResourceBank, to: ResourceBank, amount: number) {
        super(game, data);
        this.from = from;
        this.to = to;
        this.amount = amount;
    }

    resolve(): number {
        this.amount = this.from.moveTo(this.to, this.amount);
        return this.amount;
    }

    revert(): void {
        this.to.moveTo(this.from, this.amount);
    }
}

export class PayCostToTargetEffect extends OathEffect<boolean> {
    cost: ResourceCost;
    target?: ResourcesAndWarbands;
    source?: ResourcesAndWarbands;

    constructor(game: OathGame, data: OathPlayerData | undefined, cost: ResourceCost, target: ResourcesAndWarbands | undefined, source?: ResourcesAndWarbands) {
        super(game, data);
        this.cost = cost;
        this.target = target;
        this.source = source || this.player;
    }

    resolve(): boolean {
        if (!this.source) return false;

        if (this.target instanceof Denizen && this.game.currentPlayer !== this.player)
            return new PayCostToBankEffect(this.game, this.data, this.cost, this.target.suit, this.source).do();

        for (const [resource, amount] of this.cost.totalResources)
            if (this.source.getResources(resource) < amount) return false;

        for (const [resource, amount] of this.cost.burntResources)
            new MoveResourcesToTargetEffect(this.game, this.data, resource, amount, undefined, this.source).do(); // TODO: Move burnt favor to supply

        for (const [resource, amount] of this.cost.placedResources)
            new MoveResourcesToTargetEffect(this.game, this.data, resource, amount, this.target, this.source).do();

        return true;
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class PayCostToBankEffect extends OathEffect<boolean> {
    cost: ResourceCost;
    suit: OathSuit | undefined;
    source?: ResourcesAndWarbands;

    constructor(game: OathGame, data: OathPlayerData | undefined, cost: ResourceCost, suit: OathSuit | undefined, source?: ResourcesAndWarbands) {
        super(game, data);
        this.cost = cost;
        this.suit = suit;
        this.source = source || this.player;
    }

    resolve(): boolean {
        if (!this.source) return false;

        for (const [resource, amount] of this.cost.totalResources)
            if (this.source.getResources(resource) < amount) return false;

        for (const [resource, amount] of this.cost.burntResources)
            new MoveResourcesToTargetEffect(this.game, this.data, resource, amount, undefined, this.source).do(); // TODO: Move burnt favor to supply

        if (this.suit)
            new PutResourcesIntoBankEffect(this.game, this.data, this.game.favorBanks.get(this.suit), this.cost.placedResources.get(OathResource.Favor) || 0, this.source).do();
        
        new FlipSecretsEffect(this.game, this.data, this.cost.placedResources.get(OathResource.Secret) || 0, this.source).do();

        return true;
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class FlipSecretsEffect extends OathEffect<number> {
    amount: number;
    source?: ResourcesAndWarbands

    constructor(game: OathGame, data: OathPlayerData | undefined, amount: number, source?: ResourcesAndWarbands) {
        super(game, data);
        this.amount = amount;
        this.source = source || this.player;
    }

    resolve(): number {
        if (!this.source) return 0;

        this.amount = this.source.takeResources(OathResource.Secret, this.amount);
        this.source.putResources(OathResource.FlippedSecret, this.amount);
        return this.amount;
    }

    revert(): void {
        if (!this.source) return;

        this.source.takeResources(OathResource.FlippedSecret, this.amount);
        this.source.putResources(OathResource.Secret, this.amount);
    }
}

export class MoveWarbandsToEffect extends OathEffect<number> {
    owner: OathPlayer;
    amount: number;
    target: ResourcesAndWarbands;
    source?: ResourcesAndWarbands;

    constructor(game: OathGame, data: OathPlayerData | undefined, owner: OathPlayer, target: ResourcesAndWarbands, amount: number = Infinity, source?: ResourcesAndWarbands) {
        super(game, data);
        this.owner = owner;
        this.amount = amount;
        this.target = target;
        this.source = source || this.player;
    }

    resolve(): number {
        this.amount = this.source?.moveWarbandsTo(this.owner, this.target, this.amount) || 0;
        return this.amount;
    }

    revert(): void {
        if (this.source) this.target.moveWarbandsTo(this.owner, this.source, this.amount);
    }
}

export class MoveOwnWarbandsEffect extends PlayerEffect<number> {
    amount: number;
    from: ResourcesAndWarbands;
    to: ResourcesAndWarbands;

    constructor(data: OathPlayerData, from: ResourcesAndWarbands, to: ResourcesAndWarbands, amount: number = Infinity) {
        super(data);
        this.amount = amount;
        this.from = from;
        this.to = to;
    }

    resolve(): number {
        this.amount = this.player.moveOwnWarbands(this.from, this.to, this.amount);
        return this.amount;
    }

    revert(): void {
        this.player.moveOwnWarbands(this.to, this.from, this.amount);
    }
}

export class PutWarbandsFromBagEffect extends PlayerEffect<number> {
    amount: number;
    target: ResourcesAndWarbands;

    constructor(data: OathPlayerData, amount: number, target?: ResourcesAndWarbands) {
        super(data);
        this.amount = amount;
        this.target = target || data.instance;
    }

    resolve(): number {
        this.amount = this.player.moveWarbandsFromBagOnto(this.target, this.amount);
        return this.amount;
    }

    revert(): void {
        this.player.moveWarbandsIntoBagFrom(this.target, this.amount);
    }
}

export class TakeWarbandsIntoBagEffect extends PlayerEffect<number> {
    amount: number;
    target: ResourcesAndWarbands;

    constructor(data: OathPlayerData, amount: number, target?: ResourcesAndWarbands) {
        super(data);
        this.amount = amount;
        this.target = target || data.instance;
    }

    resolve(): number {
        this.amount = this.player.moveWarbandsIntoBagFrom(this.target, this.amount);
        return this.amount;
    }

    revert(): void {
        this.player.moveWarbandsFromBagOnto(this.target, this.amount);
    }
}

export class TravelEffect extends PlayerEffect<void> {
    site: Site;
    initiatedBy: OathPlayer;
    oldSite: Site;
    revealedSite: boolean;

    constructor(data: OathPlayerData, site: Site, initiatedBy?: OathPlayer) {
        super(data);
        this.site = site;
        this.initiatedBy = initiatedBy || this.player;
    }

    resolve(): void {
        this.oldSite = this.data.site;
        this.player.data.site = this.site;

        this.revealedSite = this.site.facedown;
        if (this.revealedSite) this.site.reveal();
    }

    revert(): void {
        // This effect SHOULD NOT get reverted
        this.player.data.site = this.oldSite;
        if (this.revealedSite) this.site.hide();
    }
}

export class DrawFromDeckEffect<T extends OwnableCard> extends PlayerEffect<T[]> {
    deck: CardDeck<T>;
    amount: number;
    fromBottom: boolean;
    cards: T[];

    constructor(data: OathPlayerData, deck: CardDeck<T>, amount: number, fromBottom: boolean = false) {
        super(data);
        this.deck = deck;
        this.amount = amount;
        this.fromBottom = fromBottom;
    }

    resolve(): T[] {
        this.cards = this.deck.draw(this.amount, this.fromBottom);
        return this.cards;
    }

    revert(): void {
        for (const card of this.cards) this.deck.putCard(card, this.fromBottom);
    }
}

export class PlayFromAdvisersEffect extends PlayerEffect<void> {
    card: WorldCard;
    site?: Site;

    constructor(data: OathPlayerData, card: WorldCard, site?: Site) {
        super(data);
        this.card = card;
        this.site = site;
    }

    resolve(): void {
        new PlayWorldCardEffect(this.data, this.card, false, this.site);
    }

    revert(): void {
        this.card.setOwner(this.player);
        this.card.hide();
    }
}

export class PlayWorldCardEffect extends PlayerEffect<void> {
    card: WorldCard;
    facedown: boolean;
    site?: Site;
    oldOwner: OathPlayer | undefined;

    constructor(data: OathPlayerData, card: WorldCard, facedown: boolean = false, site?: Site) {
        super(data);
        this.card = card;
        this.facedown = facedown;
        this.site = site;
    }

    resolve(): void {
        if (this.site) {
            if (!(this.card instanceof Denizen)) throw new InvalidActionResolution("Only Denizens can be played to sites.");
            if (this.card.restriction === CardRestriction.Adviser) throw new InvalidActionResolution("Cannot play adviser-only cards to sites.");

            new PlayDenizenAtSiteEffect(this.data, this.card, this.site).do();
        } else {
            if (!this.facedown && this.card instanceof Denizen && this.card.restriction === CardRestriction.Site)
                throw new InvalidActionResolution("Cannot play site-only cards to advisers.");
            
            if (!this.facedown && this.card instanceof Vision) {
                new PlayVisionEffect(this.data, this.card).do();
                return;
            }

            new PlayWorldCardToAdviserEffect(this.data, this.card, this.facedown).do();
        }
        
        for (const power of this.card.powers)
            if (isExtended(power, WhenPlayed)) new power(this.card).whenPlayed(this);
    }

    revert(): void {
        // The thing that calls this effect is in charge of reverting the card back
    }
}

export class PlayDenizenAtSiteEffect extends PlayerEffect<void> {
    card: Denizen;
    site: Site;

    getting = new Map([[OathResource.Favor, 1]]);

    constructor(data: OathPlayerData, card: Denizen, site: Site) {
        super(data);
        this.card = card;
        this.site = site;
    }

    resolve(): void {
        this.card.putAtSite(this.site);
        this.card.reveal();
        
        // TODO: Put this in an effect?
        const bank = this.game.favorBanks.get(this.card.suit);
        for (const [resource, amount] of this.getting) {
            if (bank && resource === bank.type)
                new TakeResourcesFromBankEffect(this.game, this.data, bank, amount).do();
            else
                new PutResourcesOnTargetEffect(this.game, this.data, resource, amount).do();
        }
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        // It should, if it calls setOwner, revert the placement at the site
        // TODO: Revert facedown (?)
    }
}

export class PlayWorldCardToAdviserEffect extends PlayerEffect<void> {
    card: WorldCard;
    facedown: boolean;

    constructor(data: OathPlayerData, card: WorldCard, facedown: boolean) {
        super(data);
        this.card = card;
        this.facedown = facedown;
    }

    resolve(): void {
        this.card.setOwner(this.player);
        if (!this.card.facedown) this.card.reveal();
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        // TODO: Revert facedown (?)
    }
}

export class PlayVisionEffect extends PlayerEffect<void> {
    card: Vision;
    oldVision: Vision | undefined;

    constructor(data: OathPlayerData, card: Vision) {
        super(data);
        this.card = card;
    }

    resolve(): void {
        if (!(this.player instanceof Exile) || this.data.isImperial) throw new InvalidActionResolution("Only Exiles can play Visions faceup.");
        this.oldVision = this.player.setVision(this.card);
        if (this.oldVision) new DiscardCardEffect(this.data, this.oldVision).do();
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        // This just replaces the old Vision (if there was one) and removes the current one
        if (!(this.player instanceof Exile) || this.data.isImperial) return;
        this.player.setVision(this.oldVision);
    }
}

export class MoveAdviserEffect extends PlayerEffect<WorldCard> {
    card: WorldCard;

    constructor(data: OathPlayerData, card: WorldCard) {
        super(data);
        this.card = card;
    }

    resolve(): WorldCard {
        if (!this.data.advisers.has(this.card)) throw new InvalidActionResolution("Trying to move an adviser you don't have.")
        return this.card;
    }

    revert(): void {
        this.card.setOwner(this.player);
    }
}

export class MoveWorldCardToAdvisersEffect extends OathEffect<void> {
    card: WorldCard;
    target: OathPlayer | undefined;
    oldOwner: OathPlayer | undefined;

    constructor(game: OathGame, data: OathPlayerData | undefined, card: WorldCard, target?: OathPlayer) {
        super(game, data);
        this.card = card;
        this.target = target || data?.instance;
    }

    resolve(): void {
        if (!this.target) return;
        this.card.setOwner(this.target);
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
    }
}

export class DiscardCardEffect extends PlayerEffect<void> {
    card: WorldCard;
    discard: SearchableDeck;
    onBottom: boolean

    constructor(data: OathPlayerData, card: WorldCard, discard?: SearchableDeck, onBottom: boolean = false) {
        super(data);
        this.card = card;
        this.discard = discard || (card.owner ? card.owner.data.discard : card instanceof Denizen && card.site ? this.game.board.nextRegion(card.site.region).discard : data.discard);
        this.onBottom = onBottom;
    }

    resolve(): void {
        if (this.card instanceof Denizen && this.card.activelyLocked) return;
        this.discard.putCard(this.card, this.onBottom);
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        // This just removes it from the deck
        this.discard.drawSingleCard(this.onBottom);
    }
}

export class RegionDiscardEffect extends PlayerEffect<void> {
    suits: OathSuit[];
    cards: Map<Denizen, Site>;

    constructor(data: OathPlayerData, suits: OathSuit[]) {
        super(data);
        this.suits = suits;
    }

    resolve(): void {
        for (const site of this.data.site.region.sites) {
            for (const denizen of site.denizens) {
                if (this.suits.includes(denizen.suit)) {
                    this.cards.set(denizen, site);
                    new DiscardCardEffect(this.data, denizen).do();
                }
            }
        }
    }

    revert(): void {
        for (const [denizen, site] of this.cards) {
            denizen.putAtSite(site);
        }
    }
}

export class TakeOwnableObjectEffect extends OathEffect<void> {
    target: OwnableObject;
    oldOwner: OathPlayer | undefined;

    constructor(game: OathGame, data: OathPlayerData | undefined, target: OwnableObject) {
        super(game, data);
        this.target = target;
    }

    resolve(): void {
        this.oldOwner = this.target.owner;
        this.target.setOwner(this.player);
    }

    revert(): void {
        this.target.setOwner(this.oldOwner);
    }
}

export class RollDiceEffect extends OathEffect<number[]> {
    die: number[];
    amount: number;

    constructor(game: OathGame, data: OathPlayerData | undefined, die: number[], amount: number) {
        super(game, data);
        this.die = die;
        this.amount = amount;
    }

    resolve(): number[] {
        // Side note: Because of powers like Jinx and Squalid District, the result of this should NOT be processed in its current action,
        // but in a consecutive one, so a new action can be slotted in-between
        const result: number[] = [];
        for (let i = 0; i < this.amount; i++) {
            result.push(this.die[Math.floor(Math.random() * this.die.length)]);
        }
        return result;
    }

    revert(): void {
        // This is a "read" effect, and so cannot be reverted (and should not need to)
        // In this case, a dice roll should not get reverted
    }
}

export class SetNewOathkeeperEffect extends PlayerEffect<void> {
    oldOathkeeper: OathPlayer;

    resolve(): void {
        this.oldOathkeeper = this.game.oathkeeper;
        this.game.oathkeeper = this.player;
    }

    revert(): void {
        this.game.oathkeeper = this.oldOathkeeper;
    }
}

export class SetPeoplesFavorMobState extends OathEffect<void> {
    banner: PeoplesFavor;
    state: boolean;
    oldState: boolean;

    constructor(game: OathGame, data: OathPlayerData | undefined, banner: PeoplesFavor, state: boolean) {
        super(game, data);
        this.banner = banner;
        this.state = state;
    }

    resolve(): void {
        this.oldState = this.banner.isMob;
        this.banner.isMob = this.state;
    }

    revert(): void {
        this.banner.isMob = this.oldState;
    }
}
