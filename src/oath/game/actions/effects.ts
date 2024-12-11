import { InvalidActionResolution, OathEffect, PlayerEffect } from "./base";
import { Denizen, Edifice, OathCard, Relic, Site, Vision, VisionBack, WorldCard } from "../cards/cards";
import { ALL_OATH_SUITS, BannerKey, CardRestriction, OathPhase, OathSuit, PlayerColor } from "../enums";
import { Exile, OathPlayer } from "../player";
import { OathPower, WhenPlayed } from "../powers/powers";
import { Favor, OathResource, OathResourceType, ResourceCost, ResourcesAndWarbands, Secret } from "../resources";
import { Banner, FavorBank, PeoplesFavor } from "../banks";
import { OwnableObject, WithPowers } from "../interfaces";
import { OathGame } from "../game";
import { OathGameObject } from "../gameObject";
import { BuildOrRepairEdificeAction, ChooseNewCitizensAction, VowOathAction, RestAction, WakeAction, CampaignResult, SearchDiscardAction, SearchPlayOrDiscardAction, ChooseSuitsAction, ChooseNumberAction } from "./actions";
import { DiscardOptions } from "../cards/decks";
import { CardDeck } from "../cards/decks";
import { Constructor, inclusiveRange, isExtended, maxInGroup } from "../utils";
import { D6, RollResult, Die } from "../dice";
import { Region } from "../board";
import { denizenData, edificeFlipside } from "../cards/denizens";
import { sitesData } from "../cards/sites";



//////////////////////////////////////////////////
//                   EFFECTS                    //
//////////////////////////////////////////////////
export class GainPowerEffect<T extends WithPowers> extends OathEffect {
    target: T;
    power: Constructor<OathPower<T>>;

    constructor(game: OathGame, target: T, power: Constructor<OathPower<T>>) {
        super(game, undefined);
        this.target = target;
        this.power = power;
    }

    resolve(): void {
        this.target.powers.add(this.power);
    }
}

export class LosePowerEffect<T extends WithPowers> extends OathEffect {
    target: T;
    power: Constructor<OathPower<T>>;

    constructor(game: OathGame, target: T, power: Constructor<OathPower<T>>) {
        super(game, undefined);
        this.target = target;
        this.power = power;
    }

    resolve(): void {
        this.target.powers.delete(this.power);
    }
}

export class ParentToTargetEffect extends OathEffect {
    objects: Set<OathGameObject>;
    target?: OathGameObject;
    onTop: boolean;

    constructor(game: OathGame, player: OathPlayer | undefined, objects: Iterable<OathGameObject>, target?: OathGameObject, onTop: boolean = false) {
        super(game, player);
        this.objects = new Set(objects);
        this.target = target ?? this.executor;
        this.onTop = onTop;
    }

    resolve(): void {
        const objectsArray = [...this.objects];
        if (this.target)
            this.target.addChildren(objectsArray, this.onTop);
        else
            for (const object of this.objects) object.unparent();
    }
}

export class UnparentEffect extends OathEffect {
    objects: OathGameObject[];

    constructor(game: OathGame, player: OathPlayer | undefined, objects: Iterable<OathGameObject>) {
        super(game, player);
        this.objects = [...objects];
    }

    resolve(): void {
        for (const object of this.objects)
            object.unparent();
    }
}

export class PutResourcesOnTargetEffect extends OathEffect<number> {
    resource: typeof OathResource;
    amount: number;
    target?: OathGameObject;

    constructor(game: OathGame, player: OathPlayer | undefined, resource: typeof OathResource, amount: number, target?: OathGameObject) {
        super(game, player);
        this.resource = resource;
        this.amount = Math.max(0, amount);
        this.target = target || this.executor;
    }

    resolve(): void {
        if (this.target) {
            this.resource.putOn(this.target, this.amount)
            this.result = this.target.byClass(this.resource).length;
        } else {
            this.result = 0;
        }
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            target: this.target?.id,
            resource: this.resource.name,
            amount: this.amount
        };
    }
}

export class MoveResourcesToTargetEffect extends OathEffect<number> {
    resource: OathResourceType;
    amount: number;
    target?: OathGameObject;
    source?: OathGameObject;

    constructor(game: OathGame, player: OathPlayer | undefined, resource: OathResourceType, amount: number, target: OathGameObject | undefined, source?: OathGameObject) {
        super(game, player);
        this.resource = resource;
        this.amount = Math.max(0, amount);
        this.target = target;
        this.source = source || this.executor;
    }

    resolve(): void {
        if (!this.source) {
            this.result = 0;
            return;
        }

        const resources = this.source.byClass(this.resource).max(this.amount);
        if (resources.length < this.amount) {
            this.result = 0;
            return;
        }

        new ParentToTargetEffect(this.game, this.executor, resources, this.target).doNext();
        this.result = resources.length;
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            source: this.source?.key,
            target: this.target?.key,
            resource: this.resource.name,
            amount: this.amount
        };
    }
}

export class BurnResourcesEffect extends OathEffect<number> {
    resource: OathResourceType;
    amount: number;
    source?: OathGameObject;

    constructor(game: OathGame, player: OathPlayer | undefined, resource: OathResourceType, amount: number, source?: OathGameObject) {
        super(game, player);
        this.resource = resource;
        this.amount = Math.max(0, amount);
        this.source = source || this.executor;
    }

    resolve(): void {
        if (!this.source) {
            this.result = 0;
            return;
        }

        const resources = this.source.byClass(this.resource).max(this.amount);
        if (resources.length < this.amount) {
            this.result = 0;
            return;
        }

        for (const resource of resources) resource.burn();
        this.result = resources.length;
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
        this.source = source || this.executor;
    }

    resolve(): void {
        if (!this.source) {
            this.result = false;
            return;
        }

        if (this.target instanceof Denizen && this.game.currentPlayer !== this.executor) {
            new PayCostToBankEffect(this.game, this.executor, this.cost, this.target.suit, this.source).doNext(result => this.result = result);
            return;
        }

        this.result = true;
        for (const [resource, amount] of this.cost.burntResources) {
            new BurnResourcesEffect(this.game, this.executor, resource, amount, this.source).doNext(result => { if (result < amount) this.result = false; });
        }

        for (const [resource, amount] of this.cost.placedResources) {
            new MoveResourcesToTargetEffect(this.game, this.executor, resource, amount, this.target, this.source).doNext(result => { if (result < amount) this.result = false; });
        }
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
        this.source = source || this.executor;
    }

    resolve(): void {
        if (!this.source) {
            this.result = false;
            return;
        }
    
        for (const [resource, amount] of this.cost.burntResources) {
            new BurnResourcesEffect(this.game, this.executor, resource, amount, this.source).doNext(result => { if (result < amount) this.result = false; });
            return;
        }

        this.result = true;
        if (this.suit) {
            const bank = this.game.byClass(FavorBank).byKey(this.suit)[0];
            if (bank) {
                const favorsToGive = this.cost.placedResources.get(Favor) ?? 0;
                new MoveResourcesToTargetEffect(this.game, this.executor, Favor, favorsToGive, bank, this.source).doNext(result => { if (result < favorsToGive) this.result = false; });
            }
        }
        
        const secretsToFlip = this.cost.placedResources.get(Secret) ?? 0;
        new FlipSecretsEffect(this.game, this.executor, secretsToFlip, true, this.source).doNext(result => { if (result < secretsToFlip) this.result = false; });
    }
}

export class PayPowerCostEffect extends PlayerEffect<boolean> {
    power: OathPower<WithPowers>;

    constructor(player: OathPlayer, power: OathPower<WithPowers>) {
        super(player);
        this.power = power;
    }

    resolve(): void {
        const target = this.power.source instanceof ResourcesAndWarbands ? this.power.source : undefined;
        new PayCostToTargetEffect(this.game, this.executor, this.power.cost, target).doNext(result => this.result = result);
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
        this.source = source || this.executor;
    }

    resolve(): void {
        if (!this.source) {
            this.result = 0;
            return;
        }

        const secrets = this.source.byClass(Secret).by("flipped", !this.facedown).max(this.amount);
        this.amount = secrets.length;
        for (const secret of secrets) secret.flipped = this.facedown;
        this.result = this.amount;
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            source: this.source?.name,
            amount: this.amount,
            facedown: this.facedown
        };
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
        this.source = source || this.executor;
    }

    resolve(): void {
        this.amount = this.source?.moveWarbandsTo(this.owner.key, this.target, this.amount) ?? 0;
        this.result = this.amount;
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            owner: this.owner.name,
            source: this.source?.name,
            target: this.target?.name,
            amount: this.amount
        };
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

    resolve(): void {
        this.amount = this.executor.moveOwnWarbands(this.from, this.to, this.amount);
        this.result = this.amount;
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            owner: this.executor.name,
            source: this.from.name,
            target: this.to.name,
            amount: this.amount
        };
    }
}

export class PutPawnAtSiteEffect extends PlayerEffect {
    site: Site;
    oldSite: Site;
    revealedSite: boolean;

    constructor(player: OathPlayer, site: Site) {
        super(player);
        this.site = site;
    }

    resolve(): void {
        this.oldSite = this.executor.site;
        this.executor.site = this.site;

        this.revealedSite = this.site.facedown;
        if (this.revealedSite) this.site.turnFaceup();

        // TODO: Technically, this is a minor action
        for (const relic of this.site.relics) new PeekAtCardEffect(this.executor, relic).doNext();
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            site: this.site.name
        };
    }
}

export class PeekAtCardEffect extends PlayerEffect {
    card: OathCard;

    constructor(player: OathPlayer, card: OathCard) {
        super(player);
        this.card = card;
    }

    resolve(): void {
        this.card.seenBy.add(this.executor);
        this.game.actionManager.markEventAsOneWay = true;
    }
}

export class RevealCardEffect extends OathEffect {
    card: OathCard;

    constructor(game: OathGame, player: OathPlayer | undefined, card: OathCard) {
        super(game, player);
        this.card = card;
    }

    resolve(): void {
        for (const player of this.game.players) this.card.seenBy.add(player);
        this.game.actionManager.markEventAsOneWay = true;
    }
}

export class ClearCardPeekEffect extends PlayerEffect {
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
}

export class DrawFromDeckEffect<T extends OathCard> extends PlayerEffect<T[]> {
    deck: CardDeck<T>;
    amount: number;
    fromBottom: boolean;
    skip: number;
    cards: T[];

    constructor(player: OathPlayer, deck: CardDeck<T>, amount: number, fromBottom: boolean = false, skip: number = 0) {
        super(player);
        this.deck = deck;
        this.amount = amount;
        this.fromBottom = fromBottom;
        this.skip = skip;
    }

    resolve(): void {
        this.cards = this.deck.draw(this.amount, this.fromBottom, this.skip);
        for (const card of this.cards) {
            if (this.cards.length > 1) new ClearCardPeekEffect(this.executor, card).doNext();
            new PeekAtCardEffect(this.executor, card).doNext();
        }

        this.result = this.cards;
    }
}

export class PlayWorldCardEffect extends PlayerEffect {
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

            new PlayDenizenAtSiteEffect(this.executor, this.card, this.site).doNext();
        } else {
            if (!this.facedown && this.card instanceof Denizen && this.maskProxyManager.get(this.card).restriction === CardRestriction.Site)
                throw new InvalidActionResolution("Cannot play site-only cards to advisers.");
            
            if (!this.facedown && this.card instanceof Vision) {
                new PlayVisionEffect(this.executor, this.card).doNext();
                return;
            }

            new PlayWorldCardToAdviserEffect(this.executor, this.card, this.facedown).doNext();
        }
        
        if (!this.facedown)
            new ApplyWhenPlayedEffect(this.executor, this.card).doNext();
    }
}

export class ApplyWhenPlayedEffect extends PlayerEffect {
    card: WorldCard;

    constructor(player: OathPlayer, card: WorldCard) {
        super(player);
        this.card = card;
    }

    resolve(): void {
        for (const power of this.card.powers)
            if (isExtended(power, WhenPlayed)) new power(this.card, this).whenPlayed();
    }
}

export class PlayDenizenAtSiteEffect extends PlayerEffect {
    card: Denizen;
    site: Site;

    getting = new Map([[Favor, 1]]);
    revealedCard: boolean;

    constructor(player: OathPlayer, card: Denizen, site: Site) {
        super(player);
        this.card = card;
        this.site = site;
    }

    resolve(): void {
        new ParentToTargetEffect(this.game, this.executor, [this.card], this.site).doNext();
        this.revealedCard = this.card.facedown;
        if (this.revealedCard) this.card.turnFaceup();
        
        // TODO: Put this in an effect?
        const bank = this.game.byClass(FavorBank).byKey(this.card.suit)[0];
        for (const [resource, amount] of this.getting) {
            if (bank && resource === Favor)
                new ParentToTargetEffect(this.game, this.executor, bank.byClass(Favor).max(amount)).doNext();
            else
                new PutResourcesOnTargetEffect(this.game, this.executor, resource, amount).doNext();
        }
    }
}

export class PlayWorldCardToAdviserEffect extends PlayerEffect {
    card: WorldCard;
    facedown: boolean;

    constructor(player: OathPlayer, card: WorldCard, facedown: boolean) {
        super(player);
        this.card = card;
        this.facedown = facedown;
    }

    resolve(): void {
        new ParentToTargetEffect(this.game, this.executor, [this.card]).doNext();
        if (!this.facedown) this.card.turnFaceup();
    }
}

export class PlayVisionEffect extends PlayerEffect {
    card: Vision;
    oldVision: Vision | undefined;

    constructor(player: OathPlayer, card: Vision) {
        super(player);
        this.card = card;
    }

    resolve(): void {
        if (!(this.executor instanceof Exile) || this.executor.isImperial) throw new InvalidActionResolution("Only Exiles can play Visions faceup.");
        this.oldVision = this.executor.setVision(this.card);
        if (this.oldVision) new DiscardCardEffect(this.executor, this.oldVision).doNext();
    }
}

export class MoveWorldCardToAdvisersEffect extends OathEffect {
    card: WorldCard;
    target: OathPlayer | undefined;

    constructor(game: OathGame, player: OathPlayer | undefined, card: WorldCard, target?: OathPlayer) {
        super(game, player);
        this.card = card;
        this.target = target || this.executor;
    }

    resolve(): void {
        if (!this.card.facedown && this.card instanceof Denizen && this.maskProxyManager.get(this.card).restriction === CardRestriction.Site)
            throw new InvalidActionResolution("Cannot move site-only cards to advisers.");

        if (!this.target) return;
        new ParentToTargetEffect(this.game, this.executor, [this.card], this.target).doNext()
        new CheckCapacityEffect(this.target, [this.target]).doNext();
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            card: this.card.name,
            target: this.target?.name
        };
    }
}

export class MoveDenizenToSiteEffect extends OathEffect {
    card: Denizen;
    target: Site;

    constructor(game: OathGame, player: OathPlayer | undefined, card: Denizen, target: Site) {
        super(game, player);
        this.card = card;
        this.target = target;
    }

    resolve(): void {
        if (this.maskProxyManager.get(this.card).restriction === CardRestriction.Adviser)
            throw new InvalidActionResolution("Cannot move adviser-only cards to sites.");

        if (!this.target) return;
        new ParentToTargetEffect(this.game, this.executor, [this.card], this.target).doNext()
        new CheckCapacityEffect(this.executor || this.game.currentPlayer, [this.target]).doNext();
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            card: this.card.name,
            target: this.target?.name
        };
    }
}

export class DiscardCardGroupEffect extends PlayerEffect {
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

            new DiscardCardEffect(this.executor, card, this.discardOptions).doNext();
        }

        new CheckCapacityEffect(this.executor, origins, this.discardOptions).doNext();
    }
}

export class CheckCapacityEffect extends PlayerEffect {
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
            const player = origin instanceof OathPlayer ? origin : origin.ruler || this.executor;
            
            const [capacity, takesSpaceInTargetProxies, _] = SearchPlayOrDiscardAction.getCapacityInformation(this.maskProxyManager, player, site);
            const excess = Math.max(0, takesSpaceInTargetProxies.length - capacity);
            const discardable = takesSpaceInTargetProxies.filter(e => !(e instanceof Denizen && e.activelyLocked)).map(e => e.original);

            if (excess > discardable.length)
                throw new InvalidActionResolution(`Cannot satisfy the capacity of ${origin.name}'s cards`);
            else if (excess)
                new SearchDiscardAction(origin instanceof OathPlayer ? origin : this.executor, discardable, excess, this.discardOptions).doNext();
        }
    }
}

export class DiscardCardEffect<T extends OathCard> extends PlayerEffect {
    card: T;
    discardOptions: DiscardOptions<OathCard>;

    constructor(player: OathPlayer, card: T, discardOptions?: DiscardOptions<T>) {
        super(player);
        this.card = card;
        this.discardOptions = discardOptions || new DiscardOptions(card.discard ?? player.discard ?? this.game.worldDeck);
    }

    resolve(): void {
        new ParentToTargetEffect(this.game, this.executor, [this.card], this.discardOptions.discard, !this.discardOptions.onBottom).doNext();
        this.card.returnResources();
        for (const player of this.game.players)
            new ParentToTargetEffect(this.game, player, this.card.getWarbands(player.key), player.bag).doNext();
    }
}

export class TakeOwnableObjectEffect extends OathEffect {
    target: OwnableObject;
    flipFaceup: boolean;
    oldOwner: OathPlayer | undefined;

    constructor(game: OathGame, player: OathPlayer | undefined, target: OwnableObject, flipFaceup: boolean = true) {
        super(game, player);
        this.target = target;
        this.flipFaceup = flipFaceup;
    }

    resolve(): void {
        if (this.target instanceof OathCard) {
            this.flipFaceup = this.flipFaceup && this.target.facedown;
            if (this.flipFaceup) this.target.turnFaceup();
        }
        
        new ParentToTargetEffect(this.game, this.executor, [this.target]).doNext();
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            target: (this.target as unknown as ResourcesAndWarbands).name,
        };
    }
}

export class RollDiceEffect extends OathEffect<RollResult> {
    die: typeof Die;
    amount: number;
    result: RollResult;

    constructor(game: OathGame, player: OathPlayer | undefined, die: typeof Die, amount: number, result: RollResult = new RollResult(game.random)) {
        super(game, player);
        this.die = die;
        this.amount = Math.max(0, amount);
        this.result = result;
    }

    resolve(): void {
        this.game.actionManager.markEventAsOneWay = true;
        this.result.roll(this.die, this.amount);
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            die: this.die.name,
            result: Object.fromEntries(this.result.symbols.entries())
        };
    }
}

export class CampaignJoinDefenderAlliesEffect extends PlayerEffect {
    campaignResult: CampaignResult;

    constructor(campaignResult: CampaignResult, player: OathPlayer) {
        super(player);
        this.campaignResult = campaignResult;
    }

    resolve(): void {
        this.campaignResult.defenderAllies.add(this.executor);
    }
}

export class SetNewOathkeeperEffect extends PlayerEffect {
    resolve(): void {
        this.executor.addChild(this.game.oath);
    }
}

export class SetUsurperEffect extends OathEffect {
    usurper: boolean;

    constructor(game: OathGame, usurper: boolean) {
        super(game, undefined);
        this.usurper = usurper;
    }

    resolve(): void {
        this.game.isUsurper = this.usurper;
    }
}

export class PaySupplyEffect extends PlayerEffect<boolean> {
    amount: number;

    constructor(player: OathPlayer, amount: number) {
        super(player);
        this.amount = amount;
    }

    resolve(): void {
        if (this.executor.supply < this.amount) {
            this.amount = 0;
            this.result = false;
            return;
        }

        this.executor.supply -= this.amount;
        this.result = true;
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            amount: this.amount
        };
    }
}

export class GainSupplyEffect extends PlayerEffect {
    amount: number;

    constructor(player: OathPlayer, amount: number) {
        super(player);
        this.amount = amount;
    }

    resolve(): void {
        const newSupply = Math.min(7, this.executor.supply + this.amount);
        this.amount = newSupply - this.executor.supply;
        this.executor.supply += this.amount;
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            amount: this.amount
        };
    }
}

export class ChangePhaseEffect extends OathEffect {
    phase: OathPhase;

    constructor(game: OathGame, phase: OathPhase) {
        super(game, undefined);
        this.phase = phase;
    }

    resolve(): void {
        this.game.phase = this.phase;
        this.game.checkForOathkeeper();
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            phase: this.phase
        };
    }
}

export class NextTurnEffect extends OathEffect {
    constructor(game: OathGame) {
        super(game, undefined);
    }

    resolve(): void {
        this.game.turn = (this.game.turn + 1) % this.game.order.length;
        if (this.game.turn === 0) this.game.round++;

        if (this.game.round > 8) {
            if (this.gameProxy.oathkeeper.isImperial)
                return this.game.empireWins();
            
            if (this.gameProxy.isUsurper)
                return new WinGameEffect(this.gameProxy.oathkeeper.original).doNext();

            // TODO: Break ties according to the rules. Maybe have constant references to the Visions?
            for (const playerProxy of this.gameProxy.players) {
                if (playerProxy instanceof Exile && playerProxy.vision) {
                    const candidates = playerProxy.vision.oath.getOathkeeperCandidates();
                    if (candidates.size === 1 && candidates.has(playerProxy))
                        return new WinGameEffect(playerProxy.original).doNext();
                }
            }

            return this.game.empireWins();
        }

        if (this.game.round > 5 && this.game.oathkeeper.isImperial) {
            new RollDiceEffect(this.game, this.game.chancellor, D6, 1).doNext(result => {
                const threshold = [6, 5, 3][this.game.round - 6] ?? 7;
                if (result.value >= threshold)
                    return this.game.empireWins();

                new ChangePhaseEffect(this.game, OathPhase.Wake).doNext();
                new WakeAction(this.game.currentPlayer).doNext();
            });
            return;
        }

        new ChangePhaseEffect(this.game, OathPhase.Wake).doNext();
        new WakeAction(this.game.currentPlayer).doNext();
    }
}

export class BecomeCitizenEffect extends PlayerEffect {
    resolve(): void {
        if (!(this.executor instanceof Exile) || this.executor.isCitizen) return;
        
        const exileBag = this.executorProxy.leader.bag.original;
        const exileKey = this.executorProxy.leader.key;
        for (const source of [...this.game.board.sites(), this.executor]) {
            const amount = source.getWarbandsAmount(exileKey);
            if (!amount) continue;
            new ParentToTargetEffect(this.game, this.executor, source.getWarbands(exileKey), exileBag).doNext();
            new ParentToTargetEffect(this.game, this.game.chancellor, this.game.chancellor.bag.get(amount), source).doNext();
        }

        if (this.executor.vision) new DiscardCardEffect(this.executor, this.executor.vision).doNext();
        this.executor.isCitizen = true;
        new GainSupplyEffect(this.executor, Infinity).doNext();
        if (this.game.currentPlayer === this.executor) new RestAction(this.executor).doNext();
    }
}

export class BecomeExileEffect extends PlayerEffect {
    resolve(): void {
        if (!(this.executor instanceof Exile) || !this.executor.isCitizen) return;
        this.executor.isCitizen = false;
        
        const amount = this.executor.getWarbandsAmount(PlayerColor.Purple);
        new ParentToTargetEffect(this.game, this.game.chancellor, this.executor.getWarbands(PlayerColor.Purple), this.game.chancellor.bag).doNext();
        new ParentToTargetEffect(this.game, this.executor, this.executorProxy.leader.bag.original.get(amount), this.executor).doNext();

        if (this.game.currentPlayer === this.executor) new RestAction(this.executor).doNext();
    }
}

export class PutDenizenIntoDispossessedEffect extends OathEffect {
    denizen: Denizen;

    constructor(game: OathGame, player: OathPlayer | undefined, denizen: Denizen) {
        super(game, player);
        this.denizen = denizen;
    }

    resolve(): void {
        this.denizen.prune();
        this.game.dispossessed.add(this.denizen.id);
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            card: this.denizen.name
        };
    }
}

export class GetRandomCardFromDispossessed extends OathEffect<Denizen> {
    denizen: Denizen;

    resolve(): Denizen {
        const name = this.game.random.pick([...this.game.dispossessed]);
        this.denizen = new Denizen(name);
        this.game.dispossessed.delete(name);
        return this.denizen;
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            card: this.denizen.name
        };
    }
}


//////////////////////////////////////////////////
//              SPECIFIC EFFECTS                //
//////////////////////////////////////////////////
export class SetPeoplesFavorMobState extends OathEffect {
    banner: PeoplesFavor;
    state: boolean;

    constructor(game: OathGame, player: OathPlayer | undefined, state: boolean) {
        super(game, player);
        const banner = game.banners.get(BannerKey.PeoplesFavor) as PeoplesFavor | undefined;
        if (!banner) throw new InvalidActionResolution("No People's Favor");
        this.banner = banner;
        this.state = state;
    }

    resolve(): void {
        this.banner.isMob = this.state;
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            state: this.state
        };
    }
}

export class SetGrandScepterLockEffect extends OathEffect {
    state: boolean;

    constructor(game: OathGame,state: boolean) {
        super(game, undefined);
        this.state = state;
    }
   
    resolve(): void {
        this.game.grandScepter.seizedThisTurn = this.state;
    }
}

export class RegionDiscardEffect extends PlayerEffect {
    suits: OathSuit[];
    source?: Denizen;

    constructor(player: OathPlayer, suits: OathSuit[], source: Denizen | undefined = undefined) {
        super(player);
        this.suits = suits;
        this.source = source;
    }

    resolve(): void {
        const cards: Denizen[] = [];
        if (this.executor.site.region)
            for (const site of this.executor.site.region.sites)
                for (const denizen of site.denizens)
                    if (this.suits.includes(denizen.suit) && denizen !== this.source)
                        cards.push(denizen);

        new DiscardCardGroupEffect(this.executor, cards).doNext();
    }
}

export class BindingExchangeEffect extends PlayerEffect {
    other: OathPlayer;
    resourcesGiven = new Map<OathResourceType, number>();
    resourcesTaken = new Map<OathResourceType, number>();

    constructor(player: OathPlayer, other: OathPlayer) {
        super(player);
        this.other = other;
    }

    resolve(): void {
        for (const [resource, amount]of this.resourcesGiven)
            new MoveResourcesToTargetEffect(this.game, this.executor, resource, amount, this.other).doNext();

        for (const [resource, amount]of this.resourcesTaken)
            new MoveResourcesToTargetEffect(this.game, this.other, resource, amount, this.executor).doNext();
    }
}

export class SiteExchangeOfferEffect extends BindingExchangeEffect {
    sitesGiven = new Set<Site>();
    sitesTaken = new Set<Site>();

    resolve(): void {
        super.resolve();

        for (const site of this.sitesGiven) {
            new MoveOwnWarbandsEffect(this.player, site, this.player).doNext();
            new ChooseNumberAction(
                this.other, "Move warbands to " + site.name, inclusiveRange(Math.max(0, 1 - site.getWarbandsAmount(this.other.leader.key)), this.other.getWarbandsAmount(this.other.leader.key)),
                (amount: number) => new MoveOwnWarbandsEffect(this.other, this.other, site, amount).doNext()
            ).doNext();
        }

        for (const site of this.sitesTaken) {
            new MoveOwnWarbandsEffect(this.other, site, this.other).doNext();
            new ChooseNumberAction(
                this.player, "Move warbands to " + site.name, inclusiveRange(Math.max(0, 1 - site.getWarbandsAmount(this.player.leader.key)), this.player.getWarbandsAmount(this.player.leader.key)),
                (amount: number) => new MoveOwnWarbandsEffect(this.player, this.player, site, amount).doNext()
            ).doNext();
        }
    }
}

export class ThingsExchangeOfferEffect<T extends OathGameObject> extends BindingExchangeEffect {
    thingsGiven = new Set<T>();
    thingsTaken = new Set<T>();

    resolve(): void {
        super.resolve();

        for (const thing of this.thingsGiven)
            new ParentToTargetEffect(this.game, this.other, [thing]).doNext();

        for (const thing of this.thingsTaken)
            new ParentToTargetEffect(this.game, this.executor, [thing]).doNext();
    }
}

export class CitizenshipOfferEffect extends ThingsExchangeOfferEffect<Relic | Banner> {
    reliquaryIndex: number;

    resolve(): void {
        super.resolve();

        new TakeReliquaryRelicEffect(this.other, this.reliquaryIndex).doNext();
        new BecomeCitizenEffect(this.other).doNext();
    }
}

export class TakeReliquaryRelicEffect extends PlayerEffect {
    index: number;
    relic: Relic | undefined;

    constructor(player: OathPlayer, index: number) {
        super(player);
        this.index = index;
    }

    resolve(): void {
        this.relic = this.game.chancellor.reliquary.children[this.index]?.children[0];
        if (!this.relic)
            throw new InvalidActionResolution("No relics at the designated Reliquary slot");

        new TakeOwnableObjectEffect(this.game, this.executor, this.relic).doNext();
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            relic: this.relic?.name
        };
    }
}


//////////////////////////////////////////////////
//               END OF THE GAME                //
//////////////////////////////////////////////////
// NOTE: In theory, none of those should get rolled back, but you never know
export class WinGameEffect extends PlayerEffect {
    resolve(): void {
        new VowOathAction(this.executor).doNext();

        if (!this.executor.isImperial)
            new ChooseNewCitizensAction(this.executor).doNext();
        else
            new BuildOrRepairEdificeAction(this.executor).doNext();
        
        new FinishChronicleEffect(this.executor).doNext();
    }
}

export class BuildEdificeFromDenizenEffect extends OathEffect {
    denizen: Denizen;
    edifice: Edifice;

    constructor(denizen: Denizen) {
        super(denizen.game, undefined);
        this.denizen = denizen
    }

    resolve(): void {
        if (!this.denizen.site) throw new InvalidActionResolution("Card is not at a site");
        const site = this.denizen.site;
            
        for (const key of Object.keys(edificeFlipside)) {
            const data = denizenData[key]!;
            const suit = data[0];
            if (suit === this.denizen.suit) {
                this.edifice = new Edifice(key);
                this.edifice.turnFaceup();
                new ParentToTargetEffect(this.game, this.executor, [this.edifice], site).doNext();
                new ParentToTargetEffect(this.game, this.executor, this.denizen.children, this.edifice).doNext();
                break;
            }
        }
        new ParentToTargetEffect(this.game, this.executor, [this.denizen], site.region?.discard).doNext();
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            denizen: this.denizen.name,
            edifice: this.edifice.name
        };
    }
}

export class FlipEdificeEffect extends OathEffect {
    edifice: Edifice;
    newEdifice: Edifice;

    constructor(edifice: Edifice) {
        super(edifice.game, undefined);
        this.edifice = edifice;
    }

    resolve(): void {
        if (!this.edifice.site) throw new InvalidActionResolution("Card is not at a site (How?)");

        for (const [key, other] of Object.entries(edificeFlipside)) {
            if (key === this.edifice.name) {
                this.newEdifice = new Edifice(other);
                new ParentToTargetEffect(this.game, this.executor, [this.newEdifice], this.edifice.site).doNext();
                new ParentToTargetEffect(this.game, this.executor, this.edifice.children, this.newEdifice).doNext();
                this.newEdifice.turnFaceup();
                break;
            }
        }
        this.edifice.prune();
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            edifice: this.edifice.name,
            newEdifice: this.newEdifice.name
        };
    }
}

export class FinishChronicleEffect extends PlayerEffect {
    resolve(): void {
        const storedSites: Site[] = [];
        const pushedSites: Site[] = [];
        const sitesKeysSet = new Set(Object.keys(sitesData));

        // Discard and put aside sites
        for (const regionProxy of this.gameProxy.board.children) {
            for (const siteProxy of regionProxy.sites) {
                let keepSite = false;
                if (!siteProxy.ruler?.isImperial && siteProxy.ruler !== this.executorProxy) {
                    for (const denizenProxy of siteProxy.denizens) {
                        if (denizenProxy instanceof Edifice && denizenProxy.suit !== OathSuit.None) {
                            new FlipEdificeEffect(denizenProxy).doNext();
                            pushedSites.push(siteProxy.original);
                            keepSite = true;
                        } else {
                            regionProxy.discard.original.addChild(denizenProxy.original);
                        }
                    }
                    siteProxy.original.unparent();
                } else {
                    storedSites.push(siteProxy.original);
                    keepSite = true;
                }

                sitesKeysSet.delete(siteProxy.id);
                siteProxy.original.clear();
                if (!keepSite) siteProxy.original.prune();
            }
        }
        const total = this.game.board.byClass(Region).reduce((a, e) => a + e.size, 0) - storedSites.length - pushedSites.length;
        const sitesKey = [...sitesKeysSet];
        for (var i = 0; i < total; i++) {
            if (!sitesKey.length) throw Error("Not enough sites");
            const site = sitesKey.splice(this.game.random.nextInt(sitesKey.length), 1)[0]!;
            storedSites.push(new Site(site));
        }
        storedSites.push(...pushedSites);

        // Rebuild the map
        for (const region of this.game.board.children) {
            let hasFaceupSite = false;
            while (region.sites.length < region.size) {
                const site = storedSites.shift()
                if (!site) break;
                region.addChild(site);
                if (!site.facedown) hasFaceupSite = true;
            }
            if (!hasFaceupSite) region.sites[0]?.turnFaceup();
        }

        // Collect and deal relics (technically not at this point of the Chronicle, but this has no impact)
        const futureReliquary = [...this.game.chancellor.reliquary.children.map(e => e.children[0]).filter(e => e !== undefined)];
        const relicDeck = this.game.relicDeck;
        for (const player of this.game.players) {
            for (const relic of player.relics) {
                if (relic === this.game.grandScepter) continue;

                if (player === this.executor)
                    futureReliquary.push(relic);
                else
                    relicDeck.addChild(relic);
            }
        }
        relicDeck.shuffle();
        for (const site of this.game.board.sites()) {
            if (site.facedown) continue;
            for (i = site.relics.length; i < site.startingRelics; i++) {
                const relic = relicDeck.drawSingleCard();
                if (relic) site.addChild(relic);
            }
        }

        this.game.random.shuffleArray(futureReliquary);
        relicDeck.addChildren(futureReliquary, true);

        new ChooseSuitsAction(
            this.executor, "Choose a suit to add to the World Deck", 
            (suits: OathSuit[]) => { if (suits[0] !== undefined) this.addCardsToWorldDeck(suits[0]); },
            [maxInGroup(ALL_OATH_SUITS, this.executor.suitAdviserCount.bind(this.executor))],
            [[1]]
        ).doNext();
    }

    getRandomCardDataInArchive(suit: OathSuit): string[] {
        const cardKeys: string[] = [];
        for (const [key, data] of Object.entries(this.game.archive))
            if (data[0] === suit) cardKeys.push(key);

        this.game.random.shuffleArray(cardKeys);
        return cardKeys;
    }

    addCardsToWorldDeck(suit: OathSuit) {
        // Add cards from Archive
        const worldDeck = this.game.worldDeck;
        for (let i = 3; i >= 1; i--) {
            const cardKeys = this.getRandomCardDataInArchive(suit);
            for (let j = 0; j < i; j++) {
                const key = cardKeys.pop();
                if (!key || !(key in this.game.archive)) break;
                this.game.archive.delete(key);
                worldDeck.addChild(new Denizen(key));
            }

            suit++;
            if (suit > OathSuit.Nomad) suit = OathSuit.Discord;
        }

        // Remove cards to the Dispossessed
        const firstDiscard = this.game.board.children[0]!.discard;
        for (const player of this.game.players) {
            const deck = player === this.executor ? worldDeck : firstDiscard;
            deck.addChildren(player.advisers);
        }
        for (const region of this.game.board.children) {
            firstDiscard.addChildren(region.discard.children);
        }
        
        firstDiscard.shuffle();
        for (let i = 0; i < 6; i++) {
            const card = firstDiscard.drawSingleCard();
            if (!card) break;   
            if (!(card instanceof Denizen)) {
                worldDeck.addChild(card);
                i++;
                continue;
            }

            new PutDenizenIntoDispossessedEffect(this.game, this.executor, card).doNext();
        }

        new DiscardCardGroupEffect(this.executor, firstDiscard.children, new DiscardOptions(worldDeck, false, true)).doNext(() => {
            worldDeck.shuffle();

            // Rebuild the World Deck
            const visions: VisionBack[] = [];
            const topPile: WorldCard[] = [];
            const middlePile: WorldCard[] = [];
            for (const card of worldDeck.children) {
                if (card instanceof VisionBack)
                    visions.push(card);
                else if (topPile.length < 10)
                    topPile.push(card);
                else if (middlePile.length < 15)
                    middlePile.push(card);
            }
    
            topPile.push(...visions.splice(0, 2));
            middlePile.push(...visions.splice(0, 3));
            this.game.random.shuffleArray(topPile);
            this.game.random.shuffleArray(middlePile);
    
            // Those effectively just reorder the cards
            worldDeck.addChildren(middlePile, true);
            worldDeck.addChildren(topPile, true);
    
            this.game.updateSeed(this.executor.key);
        });
        new ChangePhaseEffect(this.game, OathPhase.Over).doNext();
    }
}