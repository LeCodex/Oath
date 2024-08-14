import { Denizen, Edifice, OathCard, OwnableCard, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { CardRestriction, OathPhase, OathResource, OathSuit } from "./enums";
import { Exile, OathPlayer } from "./player";
import { ActionModifier, EffectModifier, OathPower, WhenPlayed } from "./powers/powers";
import { ResourceCost, ResourcesAndWarbands } from "./resources";
import { Banner, PeoplesFavor, ResourceBank } from "./banks";
import { OwnableObject, WithPowers } from "./interfaces";
import { OathGame } from "./game";
import { OathGameObject } from "./gameObject";
import { InvalidActionResolution, ModifiableAction, OathAction, AddCardsToWorldDeckAction, BuildOrRepairEdificeAction, ChooseNewCitizensAction, VowOathAction, TakeFavorFromBankAction, ResolveEffectAction, RestAction, WakeAction, CampaignDefenseAction, CampaignResult, SearchDiscardAction, SearchPlayAction } from "./actions/actions";
import { DiscardOptions } from "./cards/decks";
import { CardDeck } from "./cards/decks";
import { Constructor, isExtended, MaskProxyManager, shuffleArray } from "./utils";
import { AttackDie, D6, DefenseDie, Die } from "./dice";
import { Oath } from "./oaths";
import { Region } from "./board";
import { edificeData } from "./cards/denizens";
import { Reliquary } from "./reliquary";



//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export abstract class OathEffect<T> extends OathGameObject {
    player: OathPlayer | undefined;
    modifiers: EffectModifier<any>[] = [];
    maskProxyManager: MaskProxyManager;
    gameProxy: OathGame;
    playerProxy: OathPlayer | undefined;

    constructor(game: OathGame, player: OathPlayer | undefined) {
        super(game);
        this.player = player;
        this.maskProxyManager = new MaskProxyManager();
        this.gameProxy = this.maskProxyManager.get(game);
        this.playerProxy = player && this.maskProxyManager.get(player);
    }

    doNext() {
        new ResolveEffectAction(this.player || this.game.currentPlayer, this).doNext();
    }

    do(): T {
        this.applyModifiers();
        
        // Whenever we resolve an effect, we add it to the stack
        this.game.actionManager.currentEffectsStack.push(this);
        let result = this.resolve();
        this.afterResolution(result);
        
        return result;
    }

    applyModifiers() {
        for (const [sourceProxy, modifier] of this.gameProxy.getPowers(EffectModifier<any>)) {
            const instance = new modifier(sourceProxy.original, this);
            if (this instanceof instance.modifiedEffect && instance.canUse()) {  // All Effect Modifiers are must-use
                this.modifiers.push(instance);
                instance.applyBefore();
            }
        };
    }

    abstract resolve(): T;
    
    afterResolution(result: T) {
        for (const modifier of this.modifiers) modifier.applyAfter(result);
    };

    abstract revert(): void;
}

export abstract class PlayerEffect<T> extends OathEffect<T> {
    player: OathPlayer;
    playerProxy: OathPlayer;

    constructor(player: OathPlayer) {
        super(player.game, player);
    }
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
        this.game.actionManager.actionsStack.push(this.action);
    }

    revert(): void {
        this.game.actionManager.actionsStack.pop();
    }
}

export class PopActionFromStackEffect extends OathEffect<OathAction | undefined> {
    action?: OathAction;

    constructor(game: OathGame) {
        super(game, undefined);
    }
    
    resolve(): OathAction | undefined {
        const action = this.game.actionManager.actionsStack.pop();
        if (!action) {
            this.game.actionManager.currentEffectsStack.pop();
            return;
        }
        this.action = action;
        return action;
    }

    revert(): void {
        if (this.action) this.game.actionManager.actionsStack.push(this.action);
    }
}

export class ApplyModifiersEffect extends PlayerEffect<boolean> {
    action: ModifiableAction;
    actionModifiers: Iterable<ActionModifier<WithPowers>>;

    constructor(action: ModifiableAction, player: OathPlayer, actionModifiers: Iterable<ActionModifier<WithPowers>>) {
        super(player);
        this.action = action;
        this.actionModifiers = actionModifiers;
    }

    resolve(): boolean {
        this.action.modifiers.push(...this.actionModifiers);

        let interrupt = false;
        for (const modifier of this.actionModifiers) {
            if (!modifier.payCost(this.player))
                throw new InvalidActionResolution("Cannot pay the resource cost of all the modifiers.");

            if (!modifier.applyWhenApplied()) interrupt = true;

            // Modifiers can only be applied once
            // TODO: Standardize objects with powers
            modifier.sourceProxy.powers?.delete(modifier.constructor as Constructor<ActionModifier<WithPowers>>);
        }

        return !interrupt;
    }

    revert(): void {
        for (const modifier of this.actionModifiers) {
            this.action.modifiers.pop();
            modifier.sourceProxy.powers?.add(modifier.constructor as Constructor<ActionModifier<WithPowers>>);
        }
    }
}

export class ModifiedExecutionEffect extends PlayerEffect<void> {
    action: ModifiableAction;

    constructor(action: ModifiableAction) {
        super(action.player);
        this.action = action;
    }

    resolve(): void {
        this.action.modifiedExecution();
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class PutResourcesOnTargetEffect extends OathEffect<number> {
    resource: OathResource;
    amount: number;
    target?: ResourcesAndWarbands;

    constructor(game: OathGame, player: OathPlayer | undefined, resource: OathResource, amount: number, target?: ResourcesAndWarbands) {
        super(game, player);
        this.resource = resource;
        this.amount = Math.max(0, amount);
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

    constructor(game: OathGame, player: OathPlayer | undefined, resource: OathResource, amount: number, target: ResourcesAndWarbands | undefined, source?: ResourcesAndWarbands) {
        super(game, player);
        this.resource = resource;
        this.amount = Math.max(0, amount);
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

    constructor(game: OathGame, player: OathPlayer | undefined, bank: ResourceBank | undefined, amount: number, source?: ResourcesAndWarbands | undefined) {
        super(game, player);
        this.bank = bank;
        this.amount = Math.max(0, amount);
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

    constructor(game: OathGame, player: OathPlayer | undefined, bank: ResourceBank | undefined, amount: number, target?: ResourcesAndWarbands | undefined) {
        super(game, player);
        this.bank = bank;
        this.amount = Math.max(0, amount);
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
 
    constructor(game: OathGame, player: OathPlayer | undefined, from: ResourceBank, to: ResourceBank, amount: number) {
        super(game, player);
        this.from = from;
        this.to = to;
        this.amount = Math.max(0, amount);
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

    constructor(game: OathGame, player: OathPlayer | undefined, cost: ResourceCost, target: ResourcesAndWarbands | undefined, source?: ResourcesAndWarbands) {
        super(game, player);
        this.cost = cost;
        this.target = target;
        this.source = source || this.player;
    }

    resolve(): boolean {
        if (!this.source) return false;

        if (this.target instanceof Denizen && this.game.currentPlayer !== this.player)
            return new PayCostToBankEffect(this.game, this.player, this.cost, this.target.suit, this.source).do();

        for (const [resource, amount] of this.cost.totalResources)
            if (this.source.getResources(resource) < amount) return false;

        for (const [resource, amount] of this.cost.burntResources)
            new MoveResourcesToTargetEffect(this.game, this.player, resource, amount, undefined, this.source).do(); // TODO: Move burnt favor to supply

        for (const [resource, amount] of this.cost.placedResources)
            new MoveResourcesToTargetEffect(this.game, this.player, resource, amount, this.target, this.source).do();

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

    constructor(game: OathGame, player: OathPlayer | undefined, cost: ResourceCost, suit: OathSuit | undefined, source?: ResourcesAndWarbands) {
        super(game, player);
        this.cost = cost;
        this.suit = suit;
        this.source = source || this.player;
    }

    resolve(): boolean {
        if (!this.source) return false;

        for (const [resource, amount] of this.cost.totalResources)
            if (this.source.getResources(resource) < amount) return false;

        for (const [resource, amount] of this.cost.burntResources)
            new MoveResourcesToTargetEffect(this.game, this.player, resource, amount, undefined, this.source).do(); // TODO: Move burnt favor to supply

        if (this.suit)
            new PutResourcesIntoBankEffect(this.game, this.player, this.game.favorBanks.get(this.suit), this.cost.placedResources.get(OathResource.Favor) || 0, this.source).do();
        
        new FlipSecretsEffect(this.game, this.player, this.cost.placedResources.get(OathResource.Secret) || 0, true, this.source).do();

        return true;
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class PayPowerCost extends PlayerEffect<boolean> {
    power: OathPower<WithPowers>;

    constructor(player: OathPlayer, power: OathPower<WithPowers>) {
        super(player);
        this.power = power;
    }

    resolve(): boolean {
        const target = this.power.source instanceof ResourcesAndWarbands ? this.power.source : undefined;
        return new PayCostToTargetEffect(this.game, this.player, this.power.cost, target).do();
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}


export class FlipSecretsEffect extends OathEffect<number> {
    amount: number;
    source?: ResourcesAndWarbands;
    facedown: boolean;

    constructor(game: OathGame, player: OathPlayer | undefined, amount: number, facedown: boolean = true, source?: ResourcesAndWarbands) {
        super(game, player);
        this.amount = Math.max(0, amount);
        this.facedown = facedown;
        this.source = source || this.player;
    }

    resolve(): number {
        if (!this.source) return 0;

        this.amount = this.source.takeResources(this.facedown ? OathResource.Secret : OathResource.FlippedSecret, this.amount);
        this.source.putResources(this.facedown ? OathResource.FlippedSecret : OathResource.Secret, this.amount);
        return this.amount;
    }

    revert(): void {
        if (!this.source) return;

        this.source.takeResources(this.facedown ? OathResource.FlippedSecret : OathResource.Secret, this.amount);
        this.source.putResources(this.facedown ? OathResource.Secret : OathResource.FlippedSecret, this.amount);
    }
}

export class MoveWarbandsToEffect extends OathEffect<number> {
    owner: OathPlayer;
    amount: number;
    target: ResourcesAndWarbands;
    source?: ResourcesAndWarbands;

    constructor(game: OathGame, player: OathPlayer | undefined, owner: OathPlayer, amount: number = Infinity, target: ResourcesAndWarbands, source?: ResourcesAndWarbands) {
        super(game, player);
        this.owner = owner;
        this.amount = Math.max(0, amount);
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

    constructor(player: OathPlayer, from: ResourcesAndWarbands, to: ResourcesAndWarbands, amount: number = Infinity) {
        super(player);
        this.amount = Math.max(0, amount);
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

    constructor(player: OathPlayer, amount: number, target?: ResourcesAndWarbands) {
        super(player);
        this.amount = Math.max(0, amount);
        this.target = target || this.player;
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

    constructor(player: OathPlayer, amount: number, target?: ResourcesAndWarbands) {
        super(player);
        this.amount = Math.max(0, amount);
        this.target = target || this.player;
    }

    resolve(): number {
        this.amount = this.player.moveWarbandsIntoBagFrom(this.target, this.amount);
        return this.amount;
    }

    revert(): void {
        this.player.moveWarbandsFromBagOnto(this.target, this.amount);
    }
}

export class PutPawnAtSiteEffect extends PlayerEffect<void> {
    site: Site;
    oldSite: Site;
    revealedSite: boolean;

    constructor(player: OathPlayer, site: Site) {
        super(player);
        this.site = site;
    }

    resolve(): void {
        this.oldSite = this.player.site;
        this.player.site = this.site;

        this.revealedSite = this.site.facedown;
        if (this.revealedSite) this.site.reveal();

        // TODO: Technically, this is a minor action
        for (const relic of this.site.relics) new PeekAtCardEffect(this.player, relic).do();
    }

    revert(): void {
        // This effect SHOULD NOT get reverted
        this.player.site = this.oldSite;
        if (this.revealedSite) this.site.hide();
    }
}

export class PeekAtCardEffect extends PlayerEffect<void> {
    card: OathCard;
    peeked: boolean;

    constructor(player: OathPlayer, card: OathCard) {
        super(player);
        this.card = card;
    }

    resolve(): void {
        this.peeked = !this.card.seenBy.has(this.player);
        if (this.peeked) this.card.seenBy.add(this.player);
    }

    revert(): void {
        if (!this.peeked) return;
        this.card.seenBy.delete(this.player);
    }
}

export class RevealCardEffect extends OathEffect<void> {
    card: OathCard;

    constructor(game: OathGame, player: OathPlayer | undefined, card: OathCard) {
        super(game, player);
        this.card = card;
    }

    resolve(): void {
        for (const player of Object.values(this.game.players))
            new PeekAtCardEffect(player, this.card).do();
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class ClearCardPeekEffect extends PlayerEffect<void> {
    card: OathCard;
    oldPeeks: Set<OathPlayer>;

    constructor(player: OathPlayer, card: OathCard) {
        super(player);
        this.card = card;
    }

    resolve(): void {
        this.oldPeeks = new Set(this.card.seenBy);
        this.card.seenBy.clear();
    }

    revert(): void {
        this.card.seenBy = this.oldPeeks;
    }
}

export class DrawFromDeckEffect<T extends OwnableCard> extends PlayerEffect<T[]> {
    deck: CardDeck<T>;
    amount: number;
    fromBottom: boolean;
    cards: T[];

    constructor(player: OathPlayer, deck: CardDeck<T>, amount: number, fromBottom: boolean = false) {
        super(player);
        this.deck = deck;
        this.amount = amount;
        this.fromBottom = fromBottom;
    }

    resolve(): T[] {
        this.cards = this.deck.draw(this.amount, this.fromBottom);
        for (const card of this.cards) {
            if (this.cards.length > 1) new ClearCardPeekEffect(this.player, card).do();
            new PeekAtCardEffect(this.player, card).do();
        }

        return this.cards;
    }

    revert(): void {
        for (const card of this.cards.reverse()) this.deck.putCard(card, this.fromBottom);
    }
}

export class PlayWorldCardEffect extends PlayerEffect<void> {
    card: WorldCard;
    facedown: boolean;
    site?: Site;
    oldOwner: OathPlayer | undefined;

    constructor(player: OathPlayer, card: WorldCard, facedown: boolean = false, site?: Site) {
        super(player);
        this.card = card;
        this.facedown = facedown;
        this.site = site;
    }

    resolve(): void {
        if (this.site) {
            if (!(this.card instanceof Denizen)) throw new InvalidActionResolution("Only Denizens can be played to sites.");
            if (this.maskProxyManager.get(this.card).restriction === CardRestriction.Adviser) throw new InvalidActionResolution("Cannot play adviser-only cards to sites.");

            new PlayDenizenAtSiteEffect(this.player, this.card, this.site).do();
        } else {
            if (!this.facedown && this.card instanceof Denizen && this.maskProxyManager.get(this.card).restriction === CardRestriction.Site)
                throw new InvalidActionResolution("Cannot play site-only cards to advisers.");
            
            if (!this.facedown && this.card instanceof Vision) {
                new PlayVisionEffect(this.player, this.card).do();
                return;
            }

            new PlayWorldCardToAdviserEffect(this.player, this.card, this.facedown).do();
        }
        
        if (!this.facedown)
            new ApplyWhenPlayedEffect(this.player, this.card).do();
    }

    revert(): void {
        // The thing that calls this effect is in charge of reverting the card back
    }
}

export class ApplyWhenPlayedEffect extends PlayerEffect<void> {
    card: WorldCard;

    constructor(player: OathPlayer, card: WorldCard) {
        super(player);
        this.card = card;
    }

    resolve(): void {
        for (const power of this.card.powers)
            if (isExtended(power, WhenPlayed)) new power(this.card, this).whenPlayed();
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class PlayDenizenAtSiteEffect extends PlayerEffect<void> {
    card: Denizen;
    site: Site;

    getting = new Map([[OathResource.Favor, 1]]);
    revealedCard: boolean;

    constructor(player: OathPlayer, card: Denizen, site: Site) {
        super(player);
        this.card = card;
        this.site = site;
    }

    resolve(): void {
        this.card.putAtSite(this.site);
        this.revealedCard = this.card.facedown;
        if (this.revealedCard) this.card.reveal();
        
        // TODO: Put this in an effect?
        const bank = this.game.favorBanks.get(this.card.suit);
        for (const [resource, amount] of this.getting) {
            if (bank && resource === bank.type)
                new TakeResourcesFromBankEffect(this.game, this.player, bank, amount).do();
            else
                new PutResourcesOnTargetEffect(this.game, this.player, resource, amount).do();
        }
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        if (this.revealedCard) this.card.hide();
        this.card.setOwner(undefined);
    }
}

export class PlayWorldCardToAdviserEffect extends PlayerEffect<void> {
    card: WorldCard;
    facedown: boolean;
    revealedCard: boolean;

    constructor(player: OathPlayer, card: WorldCard, facedown: boolean) {
        super(player);
        this.card = card;
        this.facedown = facedown;
    }

    resolve(): void {
        this.card.setOwner(this.player);
        this.revealedCard = this.card.facedown && !this.facedown;
        if (this.revealedCard) this.card.reveal();
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        if (this.revealedCard) this.card.hide();
        this.card.setOwner(undefined);
    }
}

export class PlayVisionEffect extends PlayerEffect<void> {
    card: Vision;
    oldVision: Vision | undefined;

    constructor(player: OathPlayer, card: Vision) {
        super(player);
        this.card = card;
    }

    resolve(): void {
        if (!(this.player instanceof Exile) || this.player.isImperial) throw new InvalidActionResolution("Only Exiles can play Visions faceup.");
        this.oldVision = this.player.setVision(this.card);
        if (this.oldVision) new DiscardCardEffect(this.player, this.oldVision).do();
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        // This just replaces the old Vision (if there was one) and removes the current one
        if (!(this.player instanceof Exile) || this.player.isImperial) return;
        this.player.setVision(this.oldVision);
    }
}

// TODO: Make freeing the cards into a method
export class MoveAdviserEffect extends PlayerEffect<WorldCard> {
    card: WorldCard;

    constructor(player: OathPlayer, card: WorldCard) {
        super(player);
        this.card = card;
    }

    resolve(): WorldCard {
        if (!this.card.owner) throw new InvalidActionResolution("Trying to move a non-adviser.");
        this.card.setOwner(undefined);
        return this.card;
    }

    revert(): void {
        this.card.setOwner(this.player);
    }
}

export class MoveSiteDenizenEffect extends OathEffect<Denizen> {
    card: Denizen;
    oldSite: Site;

    constructor(game: OathGame, player: OathPlayer | undefined, card: Denizen) {
        super(game, player);
        this.card = card;
    }

    resolve(): Denizen {
        if (!this.card.site) throw new InvalidActionResolution("Trying to move a site card not at a site.");
        this.oldSite = this.card.site;
        this.card.setOwner(undefined);
        return this.card;
    }

    revert(): void {
        this.card.putAtSite(this.oldSite);
    }
}

export class MoveSiteRelicEffect extends OathEffect<Relic> {
    relic: Relic;
    oldSite: Site;

    constructor(game: OathGame, player: OathPlayer | undefined, relic: Relic) {
        super(game, player);
        this.relic = relic;
    }

    resolve(): Relic {
        if (!this.relic.site) throw new InvalidActionResolution("Trying to move a site relic not at a site.");
        this.oldSite = this.relic.site;
        this.relic.setOwner(undefined);
        return this.relic;
    }

    revert(): void {
        this.relic.putAtSite(this.oldSite);
    }
}

export class MoveWorldCardToAdvisersEffect extends OathEffect<void> {
    card: WorldCard;
    target: OathPlayer | undefined;

    constructor(game: OathGame, player: OathPlayer | undefined, card: WorldCard, target?: OathPlayer) {
        super(game, player);
        this.card = card;
        this.target = target || this.player;
    }

    resolve(): void {
        if (!this.target) return;
        this.card.setOwner(this.target);
        new CheckCapacityEffect(this.target, [this.target]).do();
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        this.card.setOwner(undefined);
    }
}

export class MoveDenizenToSiteEffect extends OathEffect<void> {
    card: Denizen;
    target: Site;

    constructor(game: OathGame, player: OathPlayer | undefined, card: Denizen, target: Site) {
        super(game, player);
        this.card = card;
        this.target = target;
    }

    resolve(): void {
        if (!this.target) return;
        this.card.putAtSite(this.target);
        new CheckCapacityEffect(this.player || this.game.currentPlayer, [this.target]).do();
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        this.card.setOwner(undefined);
    }
}

export class DiscardCardGroupEffect extends PlayerEffect<void> {
    cards: Set<WorldCard>;
    discardOptions?: DiscardOptions<any>;

    constructor(player: OathPlayer, cards: Iterable<WorldCard>, discardOptions?: DiscardOptions<any>) {
        super(player);
        this.cards = new Set(cards);
        this.discardOptions = discardOptions;
    }

    resolve(): void {
        const origins = new Set<Site | OathPlayer>();
        for (let card of this.cards) {
            if (card instanceof Denizen && card.site)
                origins.add(card.site);
            else if (card.owner)
                origins.add(card.owner);

            new DiscardCardEffect(this.player, card, this.discardOptions).do();
        }

        new CheckCapacityEffect(this.player, origins, this.discardOptions).do();
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class CheckCapacityEffect extends PlayerEffect<void> {
    origins: Set<OathPlayer | Site>;
    discardOptions?: DiscardOptions<any>;

    // TODO: Interface for elements that house cards?
    constructor(player: OathPlayer, origins: Iterable<OathPlayer | Site>, discardOptions?: DiscardOptions<any>) {
        super(player);
        this.origins = new Set(origins);
        this.discardOptions = discardOptions;
    }

    resolve(): void {
        for (const origin of this.origins) {
            const site = origin instanceof Site ? origin : undefined;
            const player = origin instanceof OathPlayer ? origin : origin.ruler || this.player;
            
            const [capacity, takesSpaceInTargetProxies, _] = SearchPlayAction.getCapacityInformation(this.maskProxyManager, player, site);
            const excess = Math.max(0, takesSpaceInTargetProxies.length - capacity);
            const discardable = takesSpaceInTargetProxies.filter(e => !(e instanceof Denizen && e.activelyLocked)).map(e => e.original);

            if (excess > discardable.length)
                throw new InvalidActionResolution(`Cannot satisfy the capacity of ${origin.name}'s cards`);
            else if (excess)
                new SearchDiscardAction(origin instanceof OathPlayer ? origin : this.player, discardable, excess, this.discardOptions).doNext();
        }
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class DiscardCardEffect<T extends OwnableCard> extends PlayerEffect<void> {
    card: T;
    discardOptions: DiscardOptions<any>;
    flipped: boolean;

    constructor(player: OathPlayer, card: T, discardOptions?: DiscardOptions<T>) {
        super(player);
        this.card = card;
        this.discardOptions = discardOptions || new DiscardOptions(card.owner ? card.owner.discard : card instanceof Denizen && card.site ? this.game.board.nextRegion(card.site.region).discard : player.discard);
    }

    resolve(): void {
        if (this.card instanceof Denizen) {
            if (this.card.activelyLocked && !this.discardOptions.ignoreLocked) return;
            if (this.card.site) new MoveSiteDenizenEffect(this.game, this.player, this.card).do();
        }
        if (this.card.owner) new MoveAdviserEffect(this.player, this.card).do();
        
        this.flipped = !this.card.facedown;
        this.discardOptions.discard.putCard(this.card, this.discardOptions.onBottom);
        this.card.returnResources();
        for (const player of this.card.warbands.keys()) new TakeWarbandsIntoBagEffect(player, Infinity, this.card).do();
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        // This just removes it from the deck
        this.discardOptions.discard.drawSingleCard(this.discardOptions.onBottom);
        if (this.flipped) this.card.reveal();
    }
}

export class TakeOwnableObjectEffect extends OathEffect<void> {
    target: OwnableObject;
    flipFaceup: boolean;
    oldOwner: OathPlayer | undefined;

    constructor(game: OathGame, player: OathPlayer | undefined, target: OwnableObject, flipFaceup: boolean = true) {
        super(game, player);
        this.target = target;
        this.flipFaceup = flipFaceup;
    }

    resolve(): void {
        if (this.target instanceof Relic)
            if (this.target.site) new MoveSiteRelicEffect(this.game, this.player, this.target).do();

        if (this.target instanceof OwnableCard) {
            this.flipFaceup = this.flipFaceup && this.target.facedown;
            if (this.flipFaceup) this.target.reveal();
        }
        
        this.oldOwner = this.target.owner;
        this.target.setOwner(this.player);
    }

    revert(): void {
        this.target.setOwner(this.oldOwner);
        if (this.target instanceof OwnableCard && this.flipFaceup) this.target.hide();
    }
}

export class GiveOwnableObjectEffect extends OathEffect<void> {
    target: OwnableObject;
    to: OathPlayer | undefined;
    oldOwner: OathPlayer | undefined;

    constructor(game: OathGame, to: OathPlayer | undefined, target: OwnableObject) {
        super(game, target.owner);
        this.target = target;
        this.to = to;
    }

    resolve(): void {
        this.oldOwner = this.target.owner;
        this.target.setOwner(this.to);
    }

    revert(): void {
        this.target.setOwner(this.oldOwner);
    }
}

export class RollDiceEffect extends OathEffect<number[]> {
    die: typeof Die;
    amount: number;

    constructor(game: OathGame, player: OathPlayer | undefined, die: typeof Die, amount: number) {
        super(game, player);
        this.die = die;
        this.amount = Math.max(0, amount);
    }

    resolve(): number[] {
        // Side note: Because of powers like Jinx and Squalid District, the result of this should NOT be processed in its current action,
        // but in a consecutive one, so a new action can be slotted in-between
        return this.die.roll(this.amount);
    }

    revert(): void {
        // This is a "read" effect, and so cannot be reverted (and should not need to)
        // In this case, a dice roll should not get reverted
    }
}

export class CampaignJoinDefenderAlliesEffect extends PlayerEffect<void> {
    campaignResult: CampaignResult;

    constructor(campaignResult: CampaignResult, player: OathPlayer) {
        super(player);
        this.campaignResult = campaignResult;
    }

    resolve(): void {
        this.campaignResult.defenderAllies.add(this.player);
    }
    
    revert(): void {
        this.campaignResult.defenderAllies.delete(this.player);
    }
}

export class CampaignResolveSuccessfulAndSkullsEffect extends PlayerEffect<void> {
    action: CampaignDefenseAction;

    constructor(action: CampaignDefenseAction) {
        super(action.player);
        this.action = action;
    }
    
    resolve(): void {
        const campaignResult = this.action.campaignResult;
        campaignResult.successful = campaignResult.atk > campaignResult.def;

        if (!campaignResult.ignoreKilling && !campaignResult.ignoreSkulls)
            campaignResult.attackerKills(AttackDie.getSkulls(campaignResult.atkRoll));
    }

    revert(): void {
        // Doesn't do anything on its own
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

export class SetUsurperEffect extends OathEffect<void> {
    usurper: boolean;
    oldUsurper: boolean;

    constructor(game: OathGame, usurper: boolean) {
        super(game, undefined);
        this.usurper = usurper;
    }

    resolve(): void {
        this.oldUsurper = this.game.isUsurper;
        this.game.isUsurper = this.usurper;
    }

    revert(): void {
        this.game.isUsurper = this.oldUsurper;
    }
}

export class PaySupplyEffect extends PlayerEffect<boolean> {
    amount: number;

    constructor(player: OathPlayer, amount: number) {
        super(player);
        this.amount = amount;
    }

    resolve(): boolean {
        if (this.player.supply < this.amount) {
            this.amount = 0;
            return false;
        }
        this.player.supply -= this.amount;
        return true;
    }

    revert(): void {
        this.player.supply += this.amount;
    }
}

export class GainSupplyEffect extends PlayerEffect<void> {
    amount: number;

    constructor(player: OathPlayer, amount: number) {
        super(player);
        this.amount = amount;
    }

    resolve(): void {
        const newSupply = Math.min(7, this.player.supply + this.amount);
        this.amount = newSupply - this.player.supply;
        this.player.supply += this.amount;
    }

    revert(): void {
        this.player.supply -= this.amount;
    }
}

export class ChangePhaseEffect extends OathEffect<void> {
    phase: OathPhase;
    oldPhase: OathPhase;

    constructor(game: OathGame, phase: OathPhase) {
        super(game, undefined);
        this.phase = phase;
    }

    resolve(): void {
        this.oldPhase = this.game.phase;
        this.game.phase = this.phase;
        this.game.checkForOathkeeper();
    }
    
    revert(): void {
        this.game.phase = this.oldPhase;
    }
}

export class NextTurnEffect extends OathEffect<void> {
    constructor(game: OathGame) {
        super(game, undefined);
    }

    resolve(): void {
        this.game.turn = (this.game.turn + 1) % this.game.order.length;
        if (this.game.turn === 0) this.game.round++;

        if (this.game.round > 8) {
            if (this.game.oathkeeper.isImperial)
                return this.game.empireWins();
            
            if (this.game.isUsurper)
                return new WinGameEffect(this.game.oathkeeper).do();

            // TODO: Break ties according to the rules. Maybe have constant references to the Visions?
            for (const player of Object.values(this.game.players)) {
                if (player instanceof Exile && player.vision) {
                    const candidates = player.vision.oath.getOathkeeperCandidates();
                    if (candidates.size === 1 && candidates.has(player))
                        return new WinGameEffect(player).do();
                }
            }

            return this.game.empireWins();
        }

        if (this.game.round > 5 && this.game.oathkeeper.isImperial) {
            const result = new RollDiceEffect(this.game, this.game.chancellor, D6, 1).do();
            new HandleD6ResultEffect(this.game, result).doNext();
            return;
        }

        new ChangePhaseEffect(this.game, OathPhase.Wake).doNext();
        new WakeAction(this.game.currentPlayer).doNext();
    }

    revert(): void {
        if (this.game.turn === 0) this.game.round--;
        this.game.turn = (this.game.turn - 1 + this.game.order.length) % this.game.order.length;
    }
}

export class HandleD6ResultEffect extends OathEffect<void> {
    result: number[];

    constructor(game: OathGame, result: number[]) {
        super(game, undefined);
        this.result = result;
    }

    resolve(): void {
        const threshold = [6, 5, 3][this.game.round - 6];
        if (this.result[0] >= threshold)
            return this.game.empireWins();

        new ChangePhaseEffect(this.game, OathPhase.Wake).doNext();
        new WakeAction(this.game.currentPlayer).doNext();
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class BecomeCitizenEffect extends PlayerEffect<void> {
    oldVision: Vision | undefined;
    resolved = false;

    resolve(): void {
        if (!(this.player instanceof Exile) || this.player.isCitizen) return;
        this.resolved = true;
        
        for (const site of this.game.board.sites())
            new PutWarbandsFromBagEffect(this.game.chancellor, new TakeWarbandsIntoBagEffect(this.player, Infinity, site).do(), site).do();
        
        new PutWarbandsFromBagEffect(this.game.chancellor, new TakeWarbandsIntoBagEffect(this.player, Infinity).do(), this.player).do();

        if (this.player.vision) {
            new DiscardCardEffect(this.player, this.player.vision).do();
            this.oldVision = this.player.setVision(undefined);
        }

        this.player.isCitizen = true;
        new GainSupplyEffect(this.player, Infinity).do();
        if (this.game.currentPlayer === this.player) new RestAction(this.player).doNext();
    }

    revert(): void {
        if (!(this.player instanceof Exile) || !this.resolved) return;
        this.player.isCitizen = false;
        this.player.setVision(this.oldVision);
    }
}

export class BecomeExileEffect extends PlayerEffect<void> {
    resolved = false;

    resolve(): void {
        if (!(this.player instanceof Exile) || !this.player.isCitizen) return;
        this.resolved = true;
        this.player.isCitizen = false;
        new PutWarbandsFromBagEffect(this.player, new TakeWarbandsIntoBagEffect(this.game.chancellor, Infinity, this.player).do(), this.player).do();

        if (this.game.currentPlayer === this.player) new RestAction(this.player).doNext();
    }

    revert(): void {
        if (!(this.player instanceof Exile) || !this.resolved) return;
        this.player.isCitizen = true;
    }
}


//////////////////////////////////////////////////
//              SPECIFIC EFFECTS                //
//////////////////////////////////////////////////
export class SetPeoplesFavorMobState extends OathEffect<void> {
    banner: PeoplesFavor;
    state: boolean;
    oldState: boolean;

    constructor(game: OathGame, player: OathPlayer | undefined, banner: PeoplesFavor, state: boolean) {
        super(game, player);
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

export class SetGrandScepterLockEffect extends OathEffect<void> {
    state: boolean;
    oldState: boolean;

    constructor(game: OathGame,state: boolean) {
        super(game, undefined);
        this.state = state;
    }
   
    resolve(): void {
        this.oldState = this.game.grandScepter.seizedThisTurn;
        this.game.grandScepter.seizedThisTurn = this.state;
    }

    revert(): void {
        this.game.grandScepter.seizedThisTurn = this.oldState;
    }
}

export class RegionDiscardEffect extends PlayerEffect<void> {
    suits: OathSuit[];
    source?: Denizen;

    constructor(player: OathPlayer, suits: OathSuit[], source: Denizen | undefined = undefined) {
        super(player);
        this.suits = suits;
        this.source = source;
    }

    resolve(): void {
        const cards: Denizen[] = [];
        for (const site of this.player.site.region.sites)
            for (const denizen of site.denizens)
                if (this.suits.includes(denizen.suit) && denizen !== this.source)
                    cards.push(denizen);

        new DiscardCardGroupEffect(this.player, cards).do();
    }

    revert(): void {
        // DOesn't do anything on its own
    }
}

export class GamblingHallEffect extends PlayerEffect<void> {
    faces: number[];

    constructor(player: OathPlayer, faces: number[]) {
        super(player);
        this.faces = faces;
    }

    resolve(): void {
        new TakeFavorFromBankAction(this.player, DefenseDie.getResult(this.faces)).doNext();
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class BindingExchangeEffect extends PlayerEffect<void> {
    other: OathPlayer;
    resourcesGiven = new Map<OathResource, number>();
    resourcesTaken = new Map<OathResource, number>();

    constructor(player: OathPlayer, other: OathPlayer) {
        super(player);
        this.other = other;
    }

    resolve(): void {
        for (const [resource, amount]of this.resourcesGiven)
            new MoveResourcesToTargetEffect(this.game, this.player, resource, amount, this.other).do();

        for (const [resource, amount]of this.resourcesTaken)
            new MoveResourcesToTargetEffect(this.game, this.other, resource, amount, this.player).do();
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class CitizenshipOfferEffect extends BindingExchangeEffect {
    reliquaryIndex: number;
    thingsGiven = new Set<Relic | Banner>();
    thingsTaken = new Set<Relic | Banner>();

    resolve(): void {
        super.resolve();

        for (const thing of this.thingsGiven)
            new GiveOwnableObjectEffect(this.game, this.other, thing).do();

        for (const thing of this.thingsTaken)
            new GiveOwnableObjectEffect(this.game, this.player, thing).do();

        new TakeReliquaryRelicEffect(this.other, this.reliquaryIndex).do();
        new BecomeCitizenEffect(this.other).do();
    }
}

export class TakeReliquaryRelicEffect extends PlayerEffect<void> {
    index: number;
    relic: Relic | undefined;

    constructor(player: OathPlayer, index: number) {
        super(player);
        this.index = index;
    }

    resolve(): void {
        this.relic = this.game.chancellor.reliquary.takeRelic(this.index);
        if (!this.relic)
            throw new InvalidActionResolution("No relics at the designated Reliquary slot");

        new TakeOwnableObjectEffect(this.game, this.player, this.relic).do();
    }

    revert(): void {
        if (this.relic) this.game.chancellor.reliquary.putRelic(this.relic, this.index);
    }
}


//////////////////////////////////////////////////
//               END OF THE GAME                //
//////////////////////////////////////////////////
// NOTE: In theory, none of those should get rolled back, but you never know
export class WinGameEffect extends PlayerEffect<void> {
    oldOath: Oath;

    resolve(): void {
        this.oldOath = this.game.oath;
        new VowOathAction(this.player).doNext();

        if (!this.player.isImperial)
            new ChooseNewCitizensAction(this.player).doNext();
        else
            new BuildOrRepairEdificeAction(this.player).doNext();
        
        new CleanUpMapEffect(this.player).doNext();
    }

    revert(): void {
        this.game.oath = this.oldOath;
    }
}

export class BuildEdificeFromDenizenEffect extends OathEffect<void> {
    denizen: Denizen;
    site: Site;
    edifice: Edifice;

    constructor(denizen: Denizen) {
        super(denizen.game, undefined);
        this.denizen = denizen
    }

    resolve(): void {
        if (!this.denizen.site) throw new InvalidActionResolution("Card is not at a site");
        this.site = this.denizen.site;
            
        for (const [key, [_, ...data]] of Object.entries(edificeData)) {
            const suit = data[0];
            if (suit === this.denizen.suit) {
                this.edifice = new Edifice(this.game, key, ...data),
                this.edifice.putAtSite(this.site);
                break;
            }
        }
        this.site.region.discard.putCard(this.denizen);
    }

    revert(): void {
        if (!this.site) return;
        this.site.region.discard.drawSingleCard();
        this.denizen.putAtSite(this.site);
        this.edifice.setOwner(undefined);
    }
}

export class FlipEdificeEffect extends OathEffect<void> {
    edifice: Edifice;
    newEdifice: Edifice;

    constructor(edifice: Edifice) {
        super(edifice.game, undefined);
        this.edifice = edifice;
    }

    resolve(): void {
        if (!this.edifice.site) throw new InvalidActionResolution("Card is not at a site (How?)");

        for (const [key, [other, ...data]] of Object.entries(edificeData)) {
            if (key === this.edifice.name) {
                const [_, ...otherData] = edificeData[other];
                this.newEdifice = new Edifice(this.game, other, ...otherData);
                this.newEdifice.putAtSite(this.edifice.site);

                for (const [resource, amount] of this.edifice.resources)
                    new MoveResourcesToTargetEffect(this.game, undefined, resource, amount, this.newEdifice, this.edifice).do();
                for (const [player, amount] of this.edifice.warbands)
                    new MoveWarbandsToEffect(this.game, undefined, player, amount, this.newEdifice, this.edifice).do();
                
                break;
            }
        }
        this.edifice.setOwner(undefined);
    }

    revert(): void {
        if (!this.newEdifice?.site) return;
        this.edifice.putAtSite(this.newEdifice.site);
        this.newEdifice.setOwner(undefined);
    }
}

export class CleanUpMapEffect extends PlayerEffect<void> {
    oldRegions = new Map<Region, Site[]>();
    discardedDenizens = new Map<Site, Set<Denizen>>();

    resolve(): void {
        const storedSites: Site[] = [];
        const pushedSites: Site[] = [];

        // Discard and put aside sites 
        for (const region of Object.values(this.game.board.regions)) {
            this.oldRegions.set(region, [...region.sites]);

            for (const site of region.sites) {
                site.clear();
                for (const denizen of site.denizens) denizen.clear();
                
                region.sites.splice(region.sites.indexOf(site), 1);
                if (!site.ruler?.isImperial && site.ruler !== this.player) {
                    this.game.siteDeck.putCard(site);
                    this.discardedDenizens.set(site, new Set(site.denizens));
                    for (const denizen of site.denizens) {
                        if (denizen instanceof Edifice && denizen.suit !== OathSuit.None) {
                            new FlipEdificeEffect(denizen).do();
                            pushedSites.push(site);
                        } else {
                            new DiscardCardEffect(this.player, denizen, new DiscardOptions(region.discard, false, true));
                        }
                    }
                } else {
                    storedSites.push(site);
                }
            }
        }
        this.game.siteDeck.shuffle();
        let total = Object.values(this.game.board.regions).reduce((a, e) => a + e.size, 0) - storedSites.length - pushedSites.length;
        for (var i = 0; i < total; i++) {
            const site = this.game.siteDeck.drawSingleCard();
            if (!site) throw Error("Not enough sites");
            storedSites.push(site);
        }
        storedSites.push(...pushedSites);

        // Rebuild the map
        for (const region of Object.values(this.game.board.regions)) {
            let hasFaceupSite = false;
            while (region.sites.length < region.size) {
                const site = storedSites.shift()
                if (!site) break;
                region.sites.push(site);
                if (!site.facedown) hasFaceupSite = true;
            }

            if (!hasFaceupSite) region.sites[0].reveal();
        }

        // Collect and deal relics (technically not at this point of the Chronicle, but this has no impact)
        const futureReliquary = [...this.game.chancellor.reliquary.slots.map(e => e.relic).filter(e => e !== undefined)];
        const relicDeck = this.game.relicDeck;
        for (const player of Object.values(this.game.players)) {
            for (const relic of player.relics) {
                if (relic === this.game.grandScepter) continue;

                if (player === this.player)
                    futureReliquary.push(relic);
                else
                    relicDeck.putCard(relic);
            }
        }
        relicDeck.shuffle();
        for (const site of this.game.board.sites()) {
            if (site.facedown) continue;
            for (i = site.relics.size; i < site.startingRelics; i++) {
                const relic = relicDeck.drawSingleCard();
                relic?.putAtSite(site);
            }
        }

        shuffleArray(futureReliquary);
        while (futureReliquary.length) {
            const relic = futureReliquary.pop();
            if (relic) relicDeck.putCard(relic)
        }
        for (let i = 0; i < 4; i++) {
            this.game.chancellor.reliquary.slots[i].relic = relicDeck.drawSingleCard();
        }

        new AddCardsToWorldDeckAction(this.player).doNext();
    }

    revert(): void {
        // TODO: See if this is a good way of doing the revert
        for (const [region, sites] of this.oldRegions) {
            region.sites = sites;
        }

        for (const [site, denizens] of this.discardedDenizens) {
            site.denizens = denizens;
        }
    }
}