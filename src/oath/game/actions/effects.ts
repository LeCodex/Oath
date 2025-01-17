import { InvalidActionResolution, OathEffect, PlayerEffect } from "./base";
import type { Relic, WorldCard } from "../cards";
import { Denizen, Edifice, OathCard, Site, Vision, VisionBack } from "../cards";
import { ALL_OATH_SUITS, BannerKey, CardRestriction, OathPhase, OathSuit, PlayerColor } from "../enums";
import { ExileBoard, OathPlayer } from "../player";
import type { OathPower } from "../powers";
import { WhenPlayed } from "../powers";
import type { OathResource, OathResourceType, ResourcesAndWarbands} from "../resources";
import { Favor, Secret } from "../resources";
import type { SupplyCostContext } from "../costs";
import { ResourceCost , ResourceTransferContext } from "../costs";
import type { Banner, PeoplesFavor } from "../banks";
import { FavorBank } from "../banks";
import type { OwnableObject, RecoverActionTarget, WithPowers } from "../interfaces";
import type { OathGame } from "../game";
import type { OathGameObject } from "../gameObject";
import { BuildOrRepairEdificeAction, ChooseNewCitizensAction, VowOathAction, RestAction, WakeAction, SearchDiscardAction, SearchPlayOrDiscardAction, ChooseSuitsAction, ChooseNumberAction, ChoosePayableCostContextAction } from ".";
import type { SearchableDeck , CardDeck } from "../cards/decks";
import { DiscardOptions } from "../cards/decks";
import type { Constructor } from "../utils";
import { inclusiveRange, isExtended, maxInGroup, NumberMap } from "../utils";
import type { Die } from "../dice";
import { D6, RollResult } from "../dice";
import { Region } from "../map";
import type { DenizenName } from "../cards/denizens";
import { denizenData, edificeFlipside } from "../cards/denizens";
import type { SiteName } from "../cards/sites";
import { sitesData } from "../cards/sites";
import type { CampaignResult } from "./utils";



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

// TODO: Integrate this into TransferResourcesEffect (source is undefined)
export class PutResourcesOnTargetEffect extends OathEffect<number> {
    resource: typeof OathResource;
    amount: number;
    target?: OathGameObject;

    constructor(game: OathGame, player: OathPlayer | undefined, resource: typeof OathResource, amount: number, target?: OathGameObject) {
        super(game, player);
        this.resource = resource;
        this.amount = Math.max(0, amount);
        this.target = target ?? this.executor;
    }

    resolve(): void {
        if (this.target) {
            this.resource.putOn(this.target, this.amount)
            this.result = this.target.byClass(this.resource).length;
        } else {
            this.result = 0;
        }
    }

    serialize() {
        return {
            ...super.serialize(),
            target: this.target?.id,
            resource: this.resource.name,
            amount: this.amount
        };
    }
}

export class TransferResourcesEffect extends OathEffect<boolean> {
    constructor(game: OathGame, public costContext: ResourceTransferContext) {
        super(game, costContext.player);
    }

    resolve(): void {
        new ChoosePayableCostContextAction(
            this.player, this.costContext,
            (costContext: ResourceTransferContext) => {
                if (costContext.target instanceof Denizen && this.game.currentPlayer !== this.executor) {
                    const bank = this.game.favorBank(costContext.target.suit);
                    if (!bank) {
                        this.result = false;
                        return;
                    }
                    costContext.target = bank;
                }
                this.result = true;

                if (!costContext.target) {
                    costContext.cost.burntResources = new NumberMap([...costContext.cost.burntResources].map(([k, v]) => [k, v + costContext.cost.placedResources.get(k)]));
                    costContext.cost.placedResources.clear()
                }

                const cantGiveSecrets = costContext.source instanceof FavorBank;
                const cantHaveSecrets = costContext.target instanceof FavorBank;
                for (const [resource, amount] of costContext.cost.burntResources) {
                    const resources = costContext.source.byClass(resource).max(amount);
                    if (resources.length < amount) {
                        this.result = false;
                        return;
                    }
                    for (const resource of resources) resource.burn();
                }
        
                for (const [resource, amount] of costContext.cost.placedResources) {
                    if (resource === Secret && cantHaveSecrets) {
                        new FlipSecretsEffect(this.game, this.player, amount, true, costContext.source);
                    } else if (resource === Secret && cantGiveSecrets) {
                        new PutResourcesOnTargetEffect(this.game, this.player, resource, amount, costContext.target);
                    } else {
                        const resources = resource.usable(costContext.source).max(amount);
                        if (resources.length < amount) {
                            this.result = false;
                            return;
                        }
                        new ParentToTargetEffect(this.game, this.executor, resources, costContext.target).doNext();
                    }
                }

                this.costContext = costContext;
            }
        ).doNext();
    }
}

export class PayPowerCostEffect extends PlayerEffect<boolean> {
    power: OathPower<WithPowers>;

    constructor(player: OathPlayer, power: OathPower<WithPowers>) {
        super(player);
        this.power = power;
    }

    resolve(): void {
        new TransferResourcesEffect(this.game, this.power.costContext).doNext(result => this.result = result);
    }
}

export class PaySupplyEffect extends PlayerEffect<boolean> {
    constructor(
        player: OathPlayer,
        public costContext: SupplyCostContext
    ) {
        super(player);
    }

    resolve(): void {
        new ChoosePayableCostContextAction(
            this.executor, this.costContext,
            (costContext: SupplyCostContext) => {
                if (this.executor.supply < costContext.cost.amount) {
                    this.result = false;
                    return;
                }

                this.executor.supply -= costContext.cost.amount;
                this.result = true;
                this.costContext = costContext;
            }
        ).doNext();
    }

    serialize() {
        return {
            ...super.serialize(),
            amount: this.costContext.cost.amount
        };
    }
}

export class FlipSecretsEffect extends OathEffect<number> {
    amount: number;
    source?: OathGameObject;
    facedown: boolean;

    constructor(game: OathGame, player: OathPlayer | undefined, amount: number, facedown: boolean = true, source?: OathGameObject) {
        super(game, player);
        this.amount = Math.max(0, amount);
        this.facedown = facedown;
        this.source = source ?? this.executor;
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

    serialize() {
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
        this.source = source ?? this.executor;
    }

    resolve(): void {
        this.amount = this.source?.moveWarbandsTo(this.owner.board.key, this.target, this.amount) ?? 0;
        this.result = this.amount;
    }

    serialize() {
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

    serialize() {
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

    serialize() {
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

export class DrawFromDeckEffect<T extends OathCard> extends PlayerEffect<T[]> {
    deck: CardDeck<T>;
    amount: number;
    fromBottom: boolean;
    skip: number;

    constructor(player: OathPlayer, deck: CardDeck<T>, amount: number, fromBottom: boolean = false, skip: number = 0) {
        super(player);
        this.deck = deck;
        this.amount = amount;
        this.fromBottom = fromBottom;
        this.skip = skip;
    }

    resolve(): void {
        this.result = this.deck.draw(this.amount, this.fromBottom, this.skip);
        for (const card of this.result) {
            if (this.result.length > 1) card.seenBy.clear();
            new PeekAtCardEffect(this.executor, card).doNext();
        }
    }
}

export class SearchDrawEffect extends PlayerEffect<WorldCard[]> {
    deck: SearchableDeck;
    amount: number;
    fromBottom: boolean;

    constructor(player: OathPlayer, deck: SearchableDeck, amount: number, fromBottom: boolean = false) {
        super(player);
        this.deck = deck;
        this.amount = amount;
        this.fromBottom = fromBottom;
    }

    resolve(): void {
        this.result = [];
        for (let i = 0; i < this.amount; i++) {
            const card = this.deck.drawSingleCard(this.fromBottom);
            if (!card) break;
            this.result.push(card);
            if (this.deck === this.game.worldDeck && card instanceof VisionBack) break;
        }

        for (const card of this.result) {
            if (this.result.length > 1) card.seenBy.clear();
            new PeekAtCardEffect(this.executor, card).doNext();
        }
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
            if (isExtended(power, WhenPlayed)) new power(this.card, this.player, this).whenPlayed();
    }
}

export class PlayDenizenAtSiteEffect extends PlayerEffect {
    card: Denizen;
    site: Site;

    constructor(player: OathPlayer, card: Denizen, site: Site) {
        super(player);
        this.card = card;
        this.site = site;
    }

    resolve(): void {
        new ParentToTargetEffect(this.game, this.executor, [this.card], this.site).doNext(() => { if (this.card.facedown) this.card.turnFaceup(); });
        
        const bank = this.game.byClass(FavorBank).byKey(this.card.suit)[0];
        if (bank)
            new TransferResourcesEffect(this.game, new ResourceTransferContext(this.executor, this, new ResourceCost([[Favor, 1]]), this.executor, bank)).doNext();
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
        new ParentToTargetEffect(this.game, this.executor, [this.card]).doNext(() => { if (!this.facedown) this.card.turnFaceup(); });
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
        if (!(this.executor.board instanceof ExileBoard) || this.executor.isImperial) throw new InvalidActionResolution("Only Exiles can play Visions faceup.");
        this.oldVision = this.executor.board.setVision(this.card);
        if (this.oldVision) new DiscardCardEffect(this.executor, this.oldVision).doNext();
    }
}

export class MoveWorldCardToAdvisersEffect extends OathEffect {
    card: WorldCard;
    target: OathPlayer | undefined;

    constructor(game: OathGame, player: OathPlayer | undefined, card: WorldCard, target?: OathPlayer) {
        super(game, player);
        this.card = card;
        this.target = target ?? this.executor;
    }

    resolve(): void {
        if (!this.card.facedown && this.card instanceof Denizen && this.maskProxyManager.get(this.card).restriction === CardRestriction.Site)
            throw new InvalidActionResolution("Cannot move site-only cards to advisers.");

        if (!this.target) return;
        new ParentToTargetEffect(this.game, this.executor, [this.card], this.target).doNext()
        new CheckCapacityEffect(this.target, [this.target]).doNext();
    }

    serialize() {
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

    serialize() {
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
        for (const card of this.cards) {
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

    constructor(player: OathPlayer, origins: Iterable<OathPlayer | Site>, discardOptions?: DiscardOptions<any>) {
        super(player);
        this.origins = new Set(origins);
        this.discardOptions = discardOptions;
    }

    resolve(): void {
        for (const origin of this.origins) {
            const site = origin instanceof Site ? origin : undefined;
            const player = origin instanceof OathPlayer ? origin : origin.ruler ?? this.executor;
            
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
        this.card.turnFacedown();
        for (const player of this.game.players)
            new ParentToTargetEffect(this.game, player, this.card.getWarbands(player.board.key), player.bag).doNext();
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

    serialize() {
        return {
            ...super.serialize(),
            target: this.target.name,
        };
    }
}

export class RecoverTargetEffect extends PlayerEffect {
    target: RecoverActionTarget;

    constructor(player: OathPlayer, target: RecoverActionTarget) {
        super(player);
        this.target = target;
    }

    resolve(): void {
        new TakeOwnableObjectEffect(this.game, this.player, this.target).doNext();
    }
}

export class RollDiceEffect<T extends Die<any>> extends OathEffect<RollResult<T>> {
    amount: number;
    result: RollResult<T>;

    constructor(game: OathGame, player: OathPlayer | undefined, dieOrResult: T | RollResult<T>, amount: number) {
        super(game, player);
        this.amount = Math.max(0, amount);
        this.result = dieOrResult instanceof RollResult ? dieOrResult : new RollResult(game.random, dieOrResult);
    }

    resolve(): void {
        this.game.actionManager.markEventAsOneWay = true;
        this.result.roll(this.amount);
    }

    serialize() {
        return {
            ...super.serialize(),
            die: this.result.die.constructor.name,
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

    serialize() {
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

    serialize() {
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
                if (playerProxy.board instanceof ExileBoard && playerProxy.board.vision) {
                    const candidates = playerProxy.board.vision.oath.getOathkeeperCandidates();
                    if (candidates.size === 1 && candidates.has(playerProxy))
                        return new WinGameEffect(playerProxy.original).doNext();
                }
            }

            return this.game.empireWins();
        }

        if (this.game.round > 5 && this.game.oathkeeper.isImperial) {
            new RollDiceEffect(this.game, this.game.chancellor, new D6(), 1).doNext(result => {
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
        if (!(this.executor.board instanceof ExileBoard) || this.executor.board.isCitizen) return;
        
        const exileBag = this.executorProxy.leader.bag.original;
        const playerColor = this.executorProxy.leader.board.key;
        for (const source of [...this.game.map.sites(), this.executor]) {
            const amount = source.getWarbandsAmount(playerColor);
            if (!amount) continue;
            new ParentToTargetEffect(this.game, this.executor, source.getWarbands(playerColor), exileBag).doNext();
            new ParentToTargetEffect(this.game, this.game.chancellor, this.game.chancellor.bag.get(amount), source).doNext();
        }

        if (this.executor.board.vision) new DiscardCardEffect(this.executor, this.executor.board.vision).doNext();
        this.executor.board.isCitizen = true;
        new GainSupplyEffect(this.executor, Infinity).doNext();
        if (this.game.currentPlayer === this.executor) new RestAction(this.executor).doNext();
    }
}

export class BecomeExileEffect extends PlayerEffect {
    resolve(): void {
        if (!(this.executor.board instanceof ExileBoard) || !this.executor.board.isCitizen) return;
        this.executor.board.isCitizen = false;
        
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

    serialize() {
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

    serialize() {
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

    serialize() {
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
            new TransferResourcesEffect(this.game, new ResourceTransferContext(this.executor, this, new ResourceCost([[resource, amount]]), this.other)).doNext();

        for (const [resource, amount]of this.resourcesTaken)
            new TransferResourcesEffect(this.game, new ResourceTransferContext(this.other, this, new ResourceCost([[resource, amount]]), this.executor)).doNext();
    }
}

export class SiteExchangeOfferEffect extends BindingExchangeEffect {
    sitesGiven = new Set<Site>();
    sitesTaken = new Set<Site>();

    resolve(): void {
        super.resolve();

        for (const site of this.sitesGiven) {
            new MoveOwnWarbandsEffect(this.executor, site, this.executor).doNext();
            new ChooseNumberAction(
                this.other, "Move warbands to " + site.name, inclusiveRange(Math.max(0, 1 - site.getWarbandsAmount(this.other.leader.board.key)), this.other.getWarbandsAmount(this.other.leader.board.key)),
                (amount: number) => new MoveOwnWarbandsEffect(this.other, this.other, site, amount).doNext()
            ).doNext();
        }

        for (const site of this.sitesTaken) {
            new MoveOwnWarbandsEffect(this.other, site, this.other).doNext();
            new ChooseNumberAction(
                this.executor, "Move warbands to " + site.name, inclusiveRange(Math.max(0, 1 - site.getWarbandsAmount(this.executor.leader.board.key)), this.executor.getWarbandsAmount(this.executor.leader.board.key)),
                (amount: number) => new MoveOwnWarbandsEffect(this.executor, this.executor, site, amount).doNext()
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
        this.relic = this.game.reliquary.children[this.index]?.children[0];
        if (!this.relic)
            throw new InvalidActionResolution("No relics at the designated Reliquary slot");

        new TakeOwnableObjectEffect(this.game, this.executor, this.relic).doNext();
    }

    serialize() {
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
            
        for (const key of Object.keys(edificeFlipside) as DenizenName[]) {
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

    serialize() {
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

    serialize() {
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
        const sitesKeysSet = new Set(Object.keys(sitesData) as SiteName[]);

        // Discard and put aside sites
        for (const regionProxy of this.gameProxy.map.children) {
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
        const total = this.game.map.byClass(Region).reduce((a, e) => a + e.size, 0) - storedSites.length - pushedSites.length;
        const sitesKey = [...sitesKeysSet];
        for (let i = 0; i < total; i++) {
            if (!sitesKey.length) throw Error("Not enough sites");
            const site = sitesKey.splice(this.game.random.nextInt(sitesKey.length), 1)[0]!;
            storedSites.push(new Site(site));
        }
        storedSites.push(...pushedSites);

        // Rebuild the map
        for (const region of this.game.map.children) {
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
        const futureReliquary = [...this.game.reliquary.children.map(e => e.children[0]).filter(e => e !== undefined)];
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
        for (const site of this.game.map.sites()) {
            if (site.facedown) continue;
            for (let i = site.relics.length; i < site.startingRelics; i++) {
                const relic = relicDeck.drawSingleCard();
                if (relic) site.addChild(relic);
            }
        }

        this.game.random.shuffleArray(futureReliquary);
        relicDeck.addChildren(futureReliquary, true);

        new ChooseSuitsAction(
            this.executor, "Choose a suit to add to the World Deck", 
            (suits: OathSuit[]) => { if (suits[0] !== undefined) this.addCardsToWorldDeck(suits[0]); },
            [maxInGroup(ALL_OATH_SUITS, this.executor.suitAdviserCount.bind(this.executor))]
        ).doNext();
    }

    getRandomCardDataInArchive(suit: OathSuit) {
        const cardKeys: DenizenName[] = [];
        for (const key of this.game.archive) {
            const data = denizenData[key];
            if (data[0] === suit) cardKeys.push(key);
        }

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
        const firstDiscard = this.game.map.children[0]!.discard;
        for (const player of this.game.players) {
            const deck = player === this.executor ? worldDeck : firstDiscard;
            deck.addChildren(player.advisers);
        }
        for (const region of this.game.map.children) {
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
    
            this.game.updateSeed(this.executor.board.key);
        });
        new ChangePhaseEffect(this.game, OathPhase.Over).doNext();
    }
}