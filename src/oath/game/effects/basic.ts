import { InvalidActionResolution } from "../utils";
import { SearchPlayAction, SearchDiscardAction, WakeAction, RestAction } from "../actions/major";
import { SearchDiscardOptions } from "../actions/types";
import { OwnableCard, WorldCard } from "../cards/base";
import { Site } from "../cards/sites";
import { Denizen } from "../cards/denizens";
import { Vision } from "../cards/visions";
import { CardDeck } from "../cards/decks";
import { Die } from "../dice";
import { OathResource, OathSuit, CardRestriction, OathPhase } from "../enums";
import { OathGame } from "../game";
import { OathPlayer, Exile, OwnableObject } from "../player";
import { OathPower, WhenPlayed } from "../powers/base";
import { ResourcesAndWarbands, ResourceBank, ResourceCost } from "../resources";
import { isExtended } from "../utils";
import { OathEffect, PlayerEffect } from "./base";
import { ChangePhaseEffect } from "./phases";


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
        return this.target?.original.putResources(this.resource, this.amount) || 0;
    }

    revert(): void {
        this.target?.original.takeResources(this.resource, this.amount);
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
        this.amount = this.source?.original.moveResourcesTo(this.resource, this.target?.original, this.amount) || 0;
        return this.amount;
    }

    revert(): void {
        if (this.target)
            this.target.original.moveResourcesTo(this.resource, this.source?.original, this.amount);

        else
            this.source?.original.putResources(this.resource, this.amount);
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
        if (!this.source) return this.bank?.original.put(this.amount) || 0;
        return this.source.original.putResourcesIntoBank(this.bank?.original, this.amount);
    }

    revert(): void {
        if (!this.source)
            this.bank?.original.take(this.amount);

        else
            this.source.original.takeResourcesFromBank(this.bank?.original, this.amount);
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
            this.amount = this.bank?.original.take(this.amount) || 0;

        else
            this.amount = this.target.original.takeResourcesFromBank(this.bank?.original, this.amount);

        return this.amount;
    }

    revert(): void {
        if (!this.target)
            this.bank?.original.put(this.amount);

        else
            this.target.original.putResourcesIntoBank(this.bank?.original, this.amount);
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
        this.amount = this.from.original.moveTo(this.to.original, this.amount);
        return this.amount;
    }

    revert(): void {
        this.to.original.moveTo(this.from.original, this.amount);
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
        this.source = source || this.player?.original;
    }

    resolve(): boolean {
        if (!this.source) return false;

        for (const [resource, amount] of this.cost.totalResources)
            if (this.source.getResources(resource) < amount) return false;

        for (const [resource, amount] of this.cost.burntResources)
            new MoveResourcesToTargetEffect(this.game, this.player?.original, resource, amount, undefined, this.source).do(); // TODO: Move burnt favor to supply

        if (this.suit)
            new PutResourcesIntoBankEffect(this.game, this.player?.original, this.game.favorBanks.get(this.suit), this.cost.placedResources.get(OathResource.Favor) || 0, this.source).do();

        new FlipSecretsEffect(this.game, this.player?.original, this.cost.placedResources.get(OathResource.Secret) || 0, true, this.source).do();

        return true;
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class PayPowerCost extends PlayerEffect<boolean> {
    power: OathPower<any>;

    constructor(player: OathPlayer, power: OathPower<any>) {
        super(player);
        this.power = power;
    }

    resolve(): boolean {
        return new PayCostToTargetEffect(this.game, this.player, this.power.cost, this.power.source).do();
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

        this.amount = this.source.original.takeResources(this.facedown ? OathResource.Secret : OathResource.FlippedSecret, this.amount);
        this.source.original.putResources(this.facedown ? OathResource.FlippedSecret : OathResource.Secret, this.amount);
        return this.amount;
    }

    revert(): void {
        if (!this.source) return;

        this.source.original.takeResources(this.facedown ? OathResource.FlippedSecret : OathResource.Secret, this.amount);
        this.source.original.putResources(this.facedown ? OathResource.Secret : OathResource.FlippedSecret, this.amount);
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
        this.amount = this.source?.original.moveWarbandsTo(this.owner, this.target.original, this.amount) || 0;
        return this.amount;
    }

    revert(): void {
        if (this.source) this.target.original.moveWarbandsTo(this.owner, this.source.original, this.amount);
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
        this.amount = this.player.original.moveOwnWarbands(this.from.original, this.to.original, this.amount);
        return this.amount;
    }

    revert(): void {
        this.player.original.moveOwnWarbands(this.to.original, this.from.original, this.amount);
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
        this.amount = this.player.original.moveWarbandsFromBagOnto(this.target.original, this.amount);
        return this.amount;
    }

    revert(): void {
        this.player.original.moveWarbandsIntoBagFrom(this.target.original, this.amount);
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
        this.amount = this.player.original.moveWarbandsIntoBagFrom(this.target.original, this.amount);
        return this.amount;
    }

    revert(): void {
        this.player.original.moveWarbandsFromBagOnto(this.target.original, this.amount);
    }
}

export class TravelEffect extends PlayerEffect<void> {
    site: Site;
    initiatedBy: OathPlayer;
    oldSite: Site;
    revealedSite: boolean;

    constructor(player: OathPlayer, site: Site, initiatedBy?: OathPlayer) {
        super(player);
        this.site = site;
        this.initiatedBy = initiatedBy || this.player;
    }

    resolve(): void {
        this.oldSite = this.player.original.site;
        this.player.original.site = this.site.original;

        this.revealedSite = this.site.original.facedown;
        if (this.revealedSite) this.site.original.reveal();
    }

    revert(): void {
        // This effect SHOULD NOT get reverted
        this.player.original.site = this.oldSite;
        if (this.revealedSite) this.site.original.hide();
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
        this.cards = this.deck.original.draw(this.amount, this.fromBottom);
        return this.cards;
    }

    revert(): void {
        for (const card of this.cards.reverse()) this.deck.original.putCard(card, this.fromBottom);
    }
}

export class PlayFromAdvisersEffect extends PlayerEffect<void> {
    card: WorldCard;
    site?: Site;

    constructor(player: OathPlayer, card: WorldCard, site?: Site) {
        super(player);
        this.card = card;
        this.site = site;
    }

    resolve(): void {
        new PlayWorldCardEffect(this.player, this.card, false, this.site);
    }

    revert(): void {
        this.card.setOwner(this.player.original);
        this.card.hide();
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
            if (this.card.restriction === CardRestriction.Adviser) throw new InvalidActionResolution("Cannot play adviser-only cards to sites.");

            new PlayDenizenAtSiteEffect(this.player, this.card, this.site).do();
        } else {
            if (!this.facedown && this.card instanceof Denizen && this.card.restriction === CardRestriction.Site)
                throw new InvalidActionResolution("Cannot play site-only cards to advisers.");

            if (!this.facedown && this.card instanceof Vision) {
                new PlayVisionEffect(this.player, this.card).do();
                return;
            }

            new PlayWorldCardToAdviserEffect(this.player, this.card, this.facedown).do();
        }

        if (!this.facedown)
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
    revealedCard: boolean;

    constructor(player: OathPlayer, card: Denizen, site: Site) {
        super(player);
        this.card = card;
        this.site = site;
    }

    resolve(): void {
        this.card.original.putAtSite(this.site.original);
        this.revealedCard = this.card.facedown;
        if (this.revealedCard) this.card.original.reveal();

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
        // It should, if it calls setOwner, revert the placement at the site
        if (this.revealedCard) this.card.original.hide();
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
        this.card.setOwner(this.player.original);
        this.revealedCard = this.card.original.facedown && !this.facedown;
        if (this.revealedCard) this.card.original.reveal();
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        if (this.revealedCard) this.card.original.hide();
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
        if (!(this.player.original instanceof Exile) || this.player.isImperial) throw new InvalidActionResolution("Only Exiles can play Visions faceup.");
        this.oldVision = this.player.original.setVision(this.card);
        if (this.oldVision) new DiscardCardEffect(this.player.original, this.oldVision).do();
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        // This just replaces the old Vision (if there was one) and removes the current one
        if (!(this.player.original instanceof Exile) || this.player.isImperial) return;
        this.player.original.setVision(this.oldVision);
    }
}

export class MoveAdviserEffect extends PlayerEffect<WorldCard> {
    card: WorldCard;

    constructor(player: OathPlayer, card: WorldCard) {
        super(player);
        this.card = card;
    }

    resolve(): WorldCard {
        if (!this.card.original.owner) throw new InvalidActionResolution("Trying to move a non-adviser.");
        this.card.original.setOwner(undefined);
        return this.card.original;
    }

    revert(): void {
        this.card.original.setOwner(this.player.original);
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
        if (!this.card.original.site) throw new InvalidActionResolution("Trying to move a site card not at a site.");
        this.oldSite = this.card.original.site;
        this.card.original.setOwner(undefined);
        return this.card.original;
    }

    revert(): void {
        this.card.original.putAtSite(this.oldSite.original);
    }
}

export class MoveWorldCardToAdvisersEffect extends OathEffect<void> {
    card: WorldCard;
    target: OathPlayer | undefined;
    oldOwner: OathPlayer | undefined;

    constructor(game: OathGame, player: OathPlayer | undefined, card: WorldCard, target?: OathPlayer) {
        super(game, player);
        this.card = card;
        this.target = target || this.player;
    }

    resolve(): void {
        if (!this.target) return;
        this.card.original.setOwner(this.target.original);
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        this.card.original.setOwner(undefined);
    }
}

export class DiscardCardGroupEffect extends PlayerEffect<void> {
    cards: Set<WorldCard>;
    discardOptions?: SearchDiscardOptions;

    constructor(player: OathPlayer, cards: Iterable<WorldCard>, discardOptions?: SearchDiscardOptions) {
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

        // TODO: Move this to an effect
        for (const origin of origins) {
            const site = origin instanceof Site ? origin : undefined;
            const player = origin instanceof OathPlayer ? origin : origin.ruler || this.player;

            const [capacity, takesSpaceInTarget, _] = SearchPlayAction.getCapacityInformation(player, site);
            const excess = Math.max(0, takesSpaceInTarget.length - capacity);
            if (excess > takesSpaceInTarget.length)
                throw new InvalidActionResolution(`Cannot satisfy the capacity of ${origin.name}'s cards`);
            else if (excess)
                new SearchDiscardAction(origin instanceof OathPlayer ? origin : this.player, takesSpaceInTarget, excess, this.discardOptions).doNext();
        }
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class DiscardCardEffect extends PlayerEffect<void> {
    card: WorldCard;
    discardOptions: SearchDiscardOptions;

    constructor(player: OathPlayer, card: WorldCard, discardOptions?: SearchDiscardOptions) {
        super(player);
        this.card = card;
        this.discardOptions = discardOptions || new SearchDiscardOptions(card.owner ? card.owner.discard : card instanceof Denizen && card.site ? this.game.board.nextRegion(card.site.region).discard : player.discard);
    }

    resolve(): void {
        if (this.card instanceof Denizen) {
            if (this.card.activelyLocked && !this.discardOptions.ignoreLocked) return;
            if (this.card.site) new MoveSiteDenizenEffect(this.game, this.player, this.card).do();
        }
        if (this.card.owner) new MoveAdviserEffect(this.player, this.card).do();

        this.discardOptions.discard.original.putCard(this.card.original, this.discardOptions.onBottom);
        this.card.original.returnResources();
        for (const player of this.card.original.warbands.keys()) new TakeWarbandsIntoBagEffect(player, Infinity, this.card).do();
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        // This just removes it from the deck
        this.discardOptions.discard.original.drawSingleCard(this.discardOptions.onBottom);
    }
}

export class TakeOwnableObjectEffect extends OathEffect<void> {
    target: OwnableObject;
    oldOwner: OathPlayer | undefined;

    constructor(game: OathGame, player: OathPlayer | undefined, target: OwnableObject) {
        super(game, player);
        this.target = target;
    }

    resolve(): void {
        this.oldOwner = this.target.original.owner;
        this.target.original.setOwner(this.player?.original);
    }

    revert(): void {
        this.target.original.setOwner(this.oldOwner);
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

export class SetNewOathkeeperEffect extends PlayerEffect<void> {
    oldOathkeeper: OathPlayer;

    resolve(): void {
        this.oldOathkeeper = this.game.original.oathkeeper;
        this.game.original.oathkeeper = this.player.original;
    }

    revert(): void {
        this.game.original.oathkeeper = this.oldOathkeeper;
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
        this.oldUsurper = this.game.original.isUsurper;
        this.game.original.isUsurper = this.usurper;
    }

    revert(): void {
        this.game.original.isUsurper = this.oldUsurper;
    }
}

export class PaySupplyEffect extends PlayerEffect<boolean> {
    amount: number;

    constructor(player: OathPlayer, amount: number) {
        super(player);
        this.amount = amount;
    }

    resolve(): boolean {
        if (this.player.original.supply < this.amount) {
            this.amount = 0;
            return false;
        }
        this.player.original.supply -= this.amount;
        return true;
    }

    revert(): void {
        this.player.original.supply += this.amount;
    }
}

export class GainSupplyEffect extends PlayerEffect<void> {
    amount: number;

    constructor(player: OathPlayer, amount: number) {
        super(player);
        this.amount = amount;
    }

    resolve(): void {
        const newSupply = Math.min(7, this.player.original.supply + this.amount);
        this.amount = newSupply - this.player.original.supply;
        this.player.original.supply += this.amount;
    }

    revert(): void {
        this.player.original.supply -= this.amount;
    }
}

export class HandleD6ResultEffect extends OathEffect<void> {
    result: number[];

    constructor(game: OathGame, result: number[]) {
        super(game, undefined);
        this.result = result;
    }

    resolve(): void {
        const threshold = [6, 5, 3][this.game.original.round - 6];
        if (this.result[0] >= threshold)
            return this.game.original.empireWins();

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
        if (!(this.player instanceof Exile)) return;
        if (this.player.isCitizen) return;
        this.resolved = true;
        this.player.isCitizen = true;

        for (const site of this.game.board.sites())
            new PutWarbandsFromBagEffect(this.game.chancellor, new TakeWarbandsIntoBagEffect(this.player, Infinity, site).do(), site).do();

        new PutWarbandsFromBagEffect(this.game.chancellor, new TakeWarbandsIntoBagEffect(this.player, Infinity, this.player).do(), this.player).do();

        if (this.player.original.vision) {
            new DiscardCardEffect(this.player, this.player.original.vision).do();
            this.oldVision = this.player.original.setVision(undefined);
        }

        new GainSupplyEffect(this.player, Infinity).do();
        if (this.game.currentPlayer.original === this.player.original) new RestAction(this.player).doNext();
    }

    revert(): void {
        if (!(this.player instanceof Exile)) return;
        if (!this.resolved) return;
        this.player.original.isCitizen = false;
        this.player.original.setVision(this.oldVision);
    }
}

export class BecomeExileEffect extends PlayerEffect<void> {
    resolved = false;

    resolve(): void {
        if (!(this.player instanceof Exile)) return;
        if (!this.player.isCitizen) return;
        this.resolved = true;
        this.player.original.isCitizen = false;
        new PutWarbandsFromBagEffect(this.player, new TakeWarbandsIntoBagEffect(this.game.chancellor, Infinity, this.player).do(), this.player).do();

        if (this.game.currentPlayer.original === this.player.original) new RestAction(this.player).doNext();
    }

    revert(): void {
        if (!(this.player instanceof Exile)) return;
        if (!this.resolved) return;
        this.player.original.isCitizen = true;
    }
}
