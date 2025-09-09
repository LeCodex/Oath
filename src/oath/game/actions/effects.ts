import { OathEffect, PlayerEffect } from "./base";
import { cannotPayError, InvalidActionResolution } from "./utils";
import type { WorldCard } from "../model/cards";
import { Relic , Denizen, Edifice, OathCard, Site, Vision, VisionBack } from "../model/cards";
import { ALL_OATH_SUITS, BannerKey, CardRestriction, OathPhase, OathSuit, PlayerColor } from "../enums";
import { ExileBoard, OathPlayer } from "../model/player";
import { OathResource, OathResourceType, ResourcesAndWarbands, Warband} from "../model/resources";
import { Favor, Secret } from "../model/resources";
import type { SupplyCost, SupplyCostContext } from "../costs";
import { ResourceTransferContext , ResourceCost } from "../costs";
import { FavorBank, Banner, DarkestSecret, PeoplesFavor } from "../model/banks";
import { isOwnable, type CampaignActionTarget, type OwnableObject, type RecoverActionTarget } from "../model/interfaces";
import type { OathGameObject } from "../model/gameObject";
import type { CapacityInformation } from ".";
import { BuildOrRepairEdificeAction, ChooseNewCitizensAction, VowOathAction, RestAction, WakeAction, SearchDiscardAction, ChooseSuitsAction, ChooseNumberAction, RecoverBannerPitchAction, CampaignSeizeSiteAction, CampaignBanishPlayerAction } from ".";
import type { SearchableDeck , CardDeck } from "../model/decks";
import { DiscardOptions  } from "../model/decks";
import { inclusiveRange, maxInGroup, NumberMap } from "../utils";
import type { Die } from "../dice";
import { D6, RollResult } from "../dice";
import { Region } from "../model/map";
import type { DenizenName} from "../cards/denizens";
import { denizenData, edificeFlipside } from "../cards/denizens";
import type { SiteName} from "../cards/sites";
import { sitesData } from "../cards/sites";
import type { CampaignResult } from "./utils";
import type { OathActionManager } from "./manager";



//////////////////////////////////////////////////
//                   EFFECTS                    //
//////////////////////////////////////////////////
export class ParentToTargetEffect extends OathEffect {
    objects: Set<OathGameObject>;
    target?: OathGameObject;
    onTop: boolean;

    constructor(actionManager: OathActionManager, player: OathPlayer | undefined, objects: Iterable<OathGameObject>, target?: OathGameObject, onTop: boolean = false) {
        super(actionManager, player);
        this.objects = new Set(objects);
        this.target = target ?? this.player;
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

    constructor(actionManager: OathActionManager, player: OathPlayer | undefined, objects: Iterable<OathGameObject>) {
        super(actionManager, player);
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

    constructor(actionManager: OathActionManager, player: OathPlayer | undefined, resource: typeof OathResource, amount: number, target?: OathGameObject) {
        super(actionManager, player);
        this.resource = resource;
        this.amount = Math.max(0, amount);
        this.target = target ?? this.player;
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
    constructor(
        actionManager: OathActionManager,
        public context: ResourceTransferContext,
    ) {
        super(actionManager, context.player);
    }

    resolve(): void {
        if (!this.context.valid) {
            this.result = false;
            return;
        }

        if (this.context.target instanceof Denizen && this.game.currentPlayer !== this.player) {
            const bank = this.game.favorBank(this.context.target.suit);
            if (!bank) {
                this.result = false;
                return;
            }
            this.context.target = bank;
        }
        this.result = true;

        if (!this.context.target) {
            this.context.cost.burntResources = new NumberMap([...this.context.cost.burntResources].map(([k, v]) => [k, v + this.context.cost.placedResources.get(k)]));
            this.context.cost.placedResources.clear()
        }

        for (const [resource, amount] of this.context.cost.burntResources) {
            const resources = this.context.source!.byClass(resource).max(amount);
            if (resources.length < amount) {
                this.result = false;
                return;
            }
            for (const resource of resources) resource.burn();
        }

        const cantGiveSecrets = this.context.source instanceof FavorBank;
        const cantHaveSecrets = this.context.target instanceof FavorBank;
        for (const [resource, amount] of this.context.cost.placedResources) {
            if (!amount) continue;
            if (resource === Secret && cantHaveSecrets) {
                new FlipSecretsEffect(this.actionManager, this.player, amount, true, this.context.source).doNext();
            } else if (resource === Secret && cantGiveSecrets) {
                new PutResourcesOnTargetEffect(this.actionManager, this.player, resource, amount, this.context.target).doNext();
            } else {
                const resources = this.context.source!.byClass(resource).filter((e) => e.usable).max(amount);
                if (!this.context.partial && resources.length < amount) {
                    this.result = false;
                    return;
                }
                if (resources.length)
                    new ParentToTargetEffect(this.actionManager, this.player, resources, this.context.target).doNext();
            }
        }
    }
}

export class PaySupplyEffect extends OathEffect<boolean> {
    constructor(
        actionManager: OathActionManager,
        public context: SupplyCostContext
    ) {
        super(actionManager, context.player);
    }

    resolve(): void {
        if (!this.context.valid) {
            this.result = false;
            return;
        }

        this.context.source!.supply -= this.context.cost.amount;
        this.result = true;
    }

    serialize() {
        return {
            ...super.serialize(),
            amount: this.context.cost.amount
        };
    }
}

export class FlipSecretsEffect extends OathEffect<number> {
    amount: number;
    source?: OathGameObject;
    facedown: boolean;

    constructor(actionManager: OathActionManager, player: OathPlayer | undefined, amount: number, facedown: boolean = true, source?: OathGameObject) {
        super(actionManager, player);
        this.amount = Math.max(0, amount);
        this.facedown = facedown;
        this.source = source ?? this.player;
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
    amount: number;
    source: ResourcesAndWarbands | undefined;

    constructor(
        actionManager: OathActionManager,
        player: OathPlayer | undefined,
        public owner: OathPlayer,
        amount: number = Infinity,
        public target: ResourcesAndWarbands,
        source?: ResourcesAndWarbands
    ) {
        super(actionManager, player);
        this.amount = Math.max(0, amount);
        this.source = source ?? player;
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

    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        public from: ResourcesAndWarbands,
        public to: ResourcesAndWarbands,
        amount: number = Infinity
    ) {
        super(actionManager, player);
        this.amount = Math.max(0, amount);
        this.from = from;
        this.to = to;
    }

    resolve(): void {
        this.amount = this.player.moveOwnWarbands(this.from, this.to, this.amount);
        this.result = this.amount;
    }

    serialize() {
        return {
            ...super.serialize(),
            owner: this.player.name,
            source: this.from.name,
            target: this.to.name,
            amount: this.amount
        };
    }
}

export class PutPawnAtSiteEffect extends PlayerEffect {
    constructor(actionManager: OathActionManager, player: OathPlayer, public site: Site) {
        super(actionManager, player);
        this.site = site;
    }

    resolve(): void {
        this.player.site = this.site;
        if (this.site.facedown) this.site.turnFaceup();

        // TODO: Technically, this is a minor action
        for (const relic of this.site.relics) new PeekAtCardEffect(this.actionManager, this.player, relic).doNext();
    }

    serialize() {
        return {
            ...super.serialize(),
            site: this.site.name
        };
    }
}

export class PeekAtCardEffect extends PlayerEffect {
    constructor(actionManager: OathActionManager, player: OathPlayer, public card: OathCard) {
        super(actionManager, player);
    }

    resolve(): void {
        this.card.seenBy.add(this.player);
        this.actionManager.markEventAsOneWay = true;
    }
}

export class RevealCardEffect extends OathEffect {
    card: OathCard;

    constructor(actionManager: OathActionManager, player: OathPlayer | undefined, card: OathCard) {
        super(actionManager, player);
        this.card = card;
    }

    resolve(): void {
        for (const player of this.game.players) this.card.seenBy.add(player);
        this.actionManager.markEventAsOneWay = true;
    }
}

export class DrawFromDeckEffect<T extends OathCard> extends PlayerEffect<T[]> {
    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        public deck: CardDeck<T>,
        public amount: number,
        public fromBottom: boolean = false,
        public skip: number = 0
    ) {
        super(actionManager, player);
    }

    resolve(): void {
        this.result = this.deck.draw(this.amount, this.fromBottom, this.skip);
        for (const card of this.result) {
            if (this.result.length > 1) card.seenBy.clear();
            new PeekAtCardEffect(this.actionManager, this.player, card).doNext();
        }
    }
}

export class SearchDrawEffect extends PlayerEffect<WorldCard[]> {
    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        public deck: SearchableDeck,
        public amount: number,
        public fromBottom: boolean = false
    ) {
        super(actionManager, player);
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
            new PeekAtCardEffect(this.actionManager, this.player, card).doNext();
        }
    }
}

export class PlayWorldCardEffect extends PlayerEffect {
    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        public card: WorldCard,
        public facedown: boolean = false,
        public site?: Site
    ) {
        super(actionManager, player);
    }

    resolve(): void {
        if (this.site) {
            if (!(this.card instanceof Denizen)) throw new InvalidActionResolution("Only Denizens can be played to sites.");
            if (this.maskProxyManager.get(this.card).restriction === CardRestriction.Adviser) throw new InvalidActionResolution("Cannot play adviser-only cards to sites.");

            new PlayDenizenAtSiteEffect(this.actionManager, this.player, this.card, this.site).doNext();
        } else {
            if (!this.facedown && this.card instanceof Denizen && this.maskProxyManager.get(this.card).restriction === CardRestriction.Site)
                throw new InvalidActionResolution("Cannot play site-only cards to advisers.");
            
            if (!this.facedown && this.card instanceof Vision) {
                new PlayVisionEffect(this.actionManager, this.player, this.card).doNext();
                return;
            }

            new PlayWorldCardToAdviserEffect(this.actionManager, this.player, this.card, this.facedown).doNext();
        }
        if (!this.facedown) new RevealCardEffect(this.actionManager, this.player, this.card).doNext();
    }
}

export class PlayDenizenAtSiteEffect extends PlayerEffect {
    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        public card: Denizen,
        public site: Site
    ) {
        super(actionManager, player);
    }

    resolve(): void {
        new ParentToTargetEffect(this.actionManager, this.player, [this.card], this.site).doNext(() => {
            if (this.card.facedown) this.card.turnFaceup();
            const bank = this.game.favorBank(this.card.suit);
            if (bank) new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.player, this, new ResourceCost([[Favor, 1]]), this.player, bank)).doNext();
        });
    }
}

export class PlayWorldCardToAdviserEffect extends PlayerEffect {
    constructor(actionManager: OathActionManager, player: OathPlayer, public card: WorldCard, public facedown: boolean) {
        super(actionManager, player);
    }

    resolve(): void {
        new ParentToTargetEffect(this.actionManager, this.player, [this.card]).doNext(() => { if (!this.facedown) this.card.turnFaceup(); });
    }
}

export class PlayVisionEffect extends PlayerEffect {
    oldVision: Vision | undefined;

    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        public card: Vision
    ) {
        super(actionManager, player);
    }

    resolve(): void {
        if (!(this.player.board instanceof ExileBoard) || this.player.isImperial) throw new InvalidActionResolution("Only Exiles can play Visions faceup.");
        this.oldVision = this.player.board.setVision(this.card);
        this.card.turnFaceup();
        if (this.oldVision) new DiscardCardEffect(this.actionManager, this.player, this.oldVision).doNext();
    }
}

export class MoveWorldCardToAdvisersEffect extends OathEffect {
    target: OathPlayer | undefined;

    constructor(
        actionManager: OathActionManager,
        player: OathPlayer | undefined,
        public card: WorldCard,
        target?: OathPlayer
    ) {
        super(actionManager, player);
        this.target = target ?? this.player;
    }

    resolve(): void {
        if (!this.card.facedown && this.card instanceof Denizen && this.maskProxyManager.get(this.card).restriction === CardRestriction.Site)
            throw new InvalidActionResolution("Cannot move site-only cards to advisers.");

        if (!this.target) return;
        new ParentToTargetEffect(this.actionManager, this.player, [this.card], this.target).doNext()
        new CheckCapacityEffect(this.actionManager, this.target, [this.target]).doNext();
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
    constructor(
        actionManager: OathActionManager,
        player: OathPlayer | undefined,
        public card: Denizen,
        public target: Site
    ) {
        super(actionManager, player);
    }

    resolve(): void {
        if (this.maskProxyManager.get(this.card).restriction === CardRestriction.Adviser)
            throw new InvalidActionResolution("Cannot move adviser-only cards to sites.");

        if (!this.target) return;
        new ParentToTargetEffect(this.actionManager, this.player, [this.card], this.target).doNext()
        new CheckCapacityEffect(this.actionManager, this.player ?? this.game.currentPlayer, [this.target]).doNext();
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

    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        cards: Iterable<WorldCard>,
        public discardOptions?: DiscardOptions<any>
    ) {
        super(actionManager, player);
        this.cards = new Set(cards);
    }

    resolve(): void {
        const origins = new Set<Site | OathPlayer>();
        for (const card of this.cards) {
            if (card instanceof Denizen && card.site)
                origins.add(card.site);
            else if (card.owner)
                origins.add(card.owner);

            new DiscardCardEffect(this.actionManager, this.player, card, this.discardOptions).doNext();
        }

        new CheckCapacityEffect(this.actionManager, this.player, origins, this.discardOptions).doNext();
    }
}

export class CheckCapacityEffect extends PlayerEffect {
    origins: Set<OathPlayer | Site>;
    capacityInformations = new Map<OathPlayer | Site, CapacityInformation>();

    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        origins: Iterable<OathPlayer | Site>,
        public discardOptions?: DiscardOptions<any>
    ) {
        super(actionManager, player);
        this.origins = new Set(origins);
    }

    resolve(): void {
        for (const origin of this.origins) {
            const { capacity, takesSpaceInTargetProxies } = this.capacityInformations.get(origin)!;
            const excess = Math.max(0, takesSpaceInTargetProxies.length - capacity);
            const discardable = takesSpaceInTargetProxies.filter((e) => !(e instanceof Denizen && e.activelyLocked)).map((e) => e.original);

            if (excess > discardable.length)
                throw new InvalidActionResolution(`Cannot satisfy the capacity of ${origin.name}'s cards`);
            else if (excess)
                new SearchDiscardAction(this.actionManager, origin instanceof OathPlayer ? origin : this.player, discardable, excess, this.discardOptions).doNext();
        }
    }
}

export class DiscardCardEffect<T extends OathCard> extends OathEffect {
    discardOptions: DiscardOptions<OathCard>;

    constructor(
        actionManager: OathActionManager,
        player: OathPlayer | undefined,
        public card: T,
        discardOptions?: DiscardOptions<T>
    ) {
        super(actionManager, player);
        this.discardOptions = discardOptions ?? new DiscardOptions(card.discard ?? player?.discard ?? this.game.worldDeck);
    }

    resolve(): void {
        new ParentToTargetEffect(this.actionManager, this.player, [this.card], this.discardOptions.discard, !this.discardOptions.onBottom).doNext();
        new ReturnResourcesEffect(this.actionManager, this.card).doNext();
        this.card.turnFacedown();
        for (const player of this.game.players) {
            const warbands = this.card.getWarbands(player.board.key)
            if (warbands.length)
                new ParentToTargetEffect(this.actionManager, player, warbands, player.bag).doNext();
        }
    }
}

export class ReturnResourcesEffect extends OathEffect {
    constructor(
        actionManager: OathActionManager,
        public card: OathCard
    ) {
        super(actionManager, undefined);
    }

    resolve(): void {
        const player = this.game.currentPlayer;
        const secretAmount = this.card.byClass(Secret).length;
        if (secretAmount) {
            new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(player, this, new ResourceCost([[Secret, secretAmount]]), player, this.card)).doNext();
            new FlipSecretsEffect(this.actionManager, player, secretAmount).doNext();
        }
        
        const favorAmount = this.card.byClass(Favor).length;
        if (favorAmount && this.card instanceof Denizen) {
            const bank = this.game.favorBank(this.card.suit);
            if (!bank) return;
            new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(player, this, new ResourceCost([[Favor, favorAmount]]), bank, this.card)).doNext();
        }
    }
}

export class ReturnAllResourcesEffect extends PlayerEffect {
    ignore: Set<OathGameObject>;

    constructor(actionManager: OathActionManager, ignore?: Iterable<OathGameObject>) {
        super(actionManager, actionManager.game.currentPlayer);
        this.ignore = new Set<OathGameObject>(ignore);
    }

    resolve(): void {
        for (const site of this.game.map.sites())
            for (const denizen of site.denizens)
                if (!this.ignore.has(denizen) && denizen.byClass(OathResource).length)
                    new ReturnResourcesEffect(this.actionManager, denizen).doNext();

        for (const player of this.game.players) {
            for (const adviser of player.advisers)
                if (!this.ignore.has(adviser) && adviser.byClass(OathResource).length)
                    new ReturnResourcesEffect(this.actionManager, adviser).doNext();
            
            for (const relic of player.relics)
                if (!this.ignore.has(relic) && relic.byClass(OathResource).length)
                    new ReturnResourcesEffect(this.actionManager, relic).doNext();
        }

        new FlipSecretsEffect(this.actionManager, this.player, Infinity, false).doNext();
    }
}

export class SeizeTargetEffect extends PlayerEffect {
    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        public target: CampaignActionTarget
    ) {
        super(actionManager, player);
    }

    resolve(): void {
        if (isOwnable(this.target)) {
            new TakeOwnableObjectEffect(this.actionManager, this.player, this.target).doNext();
            if (this.target instanceof Banner)
                new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.player, this, new ResourceCost([], [[this.target.cls as OathResourceType, 2]]), undefined, this.target)).doNext();
        } else if (this.target instanceof Site) {
            if (this.target.ruler) new MoveOwnWarbandsEffect(this.actionManager, this.target.ruler.leader, this.target, this.target.ruler).doNext();
            new CampaignSeizeSiteAction(this.actionManager, this.player, this.target).doNext();
        } else if (this.target instanceof OathPlayer) {
            const cost = new ResourceCost([], [[Favor, Math.floor(this.target.byClass(Favor).length / 2)]]);
            new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.player, this, cost, undefined)).doNext();
            new CampaignBanishPlayerAction(this.actionManager, this.player, this.target).doNext();
        }
    }
}

export class TakeOwnableObjectEffect extends OathEffect {
    constructor(
        actionManager: OathActionManager,
        player: OathPlayer | undefined,
        public target: OwnableObject,
        public flipFaceup: boolean = true
    ) {
        super(actionManager, player);
    }

    resolve(): void {
        if (this.target instanceof OathCard) {
            this.flipFaceup = this.flipFaceup && this.target.facedown;
            if (this.flipFaceup) this.target.turnFaceup();
        }
        
        new ParentToTargetEffect(this.actionManager, this.player, [this.target]).doNext();
    }

    serialize() {
        return {
            ...super.serialize(),
            target: this.target.name,
        };
    }
}

export class RecoverTargetEffect extends PlayerEffect {
    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        public target: RecoverActionTarget
    ) {
        super(actionManager, player);
    }

    resolve(): void {
        if (this.target instanceof Relic) {
            if (!this.target.site) return;
            const cost = this.target.site.recoverCost;
            new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.player, this, cost, this.game.favorBank(this.target.site.recoverSuit))).doNext((success) => {
                if (!success) throw cannotPayError(cost);
            });
        } else if (this.target instanceof Banner) {
            new RecoverBannerPitchAction(this.actionManager, this.player, this.target).doNext();
            if (this.target instanceof PeoplesFavor) {
                let amount = this.target.amount;
                new SetPeoplesFavorMobState(this.actionManager, this.player, false).doNext();
                new ChooseSuitsAction(
                    this.actionManager, this.player, "Choose where to start returning the favor (" + amount + ")",
                    (suits: OathSuit[]) => {
                        let suit = suits[0];
                        if (suit === undefined) return;

                        while (amount > 0) {
                            const bank = this.game.byClass(FavorBank).byKey(suit)[0];
                            if (bank) {
                                new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.player, this, new ResourceCost([[bank.cls, 1]]), bank, this.target)).doNext();
                                amount--;
                            }
                            if (++suit > OathSuit.Nomad) suit = OathSuit.Discord;
                        }
                    }
                ).doNext();
            } else if (this.target instanceof DarkestSecret) {
                const amount = this.target.amount;
                new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.player, this, new ResourceCost([[Secret, 1]]), this.player, this.target)).doNext();
                if (this.target.owner)
                    new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.target.owner, this, new ResourceCost([[Secret, amount - 1]]), this.target)).doNext();
            }
        }

        new TakeOwnableObjectEffect(this.actionManager, this.player, this.target, true).doNext();
    }
}

export class RollDiceEffect<T extends Die<any>> extends OathEffect<RollResult<T>> {
    amount: number;
    result: RollResult<T>;

    constructor(
        actionManager: OathActionManager,
        player: OathPlayer | undefined,
        dieOrResult: T | RollResult<T>,
        amount: number
    ) {
        super(actionManager, player);
        this.amount = Math.max(0, amount);
        this.result = dieOrResult instanceof RollResult ? dieOrResult : new RollResult(this.game.random, dieOrResult);
    }

    resolve(): void {
        this.result.roll(this.amount);
        this.actionManager.markEventAsOneWay = true;
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
    constructor(
        actionManager: OathActionManager,
        public campaignResult: CampaignResult,
        player: OathPlayer
    ) {
        super(actionManager, player);
    }

    resolve(): void {
        this.campaignResult.defenderAllies.add(this.player);
    }
}

export class SetNewOathkeeperEffect extends PlayerEffect {
    resolve(): void {
        new ParentToTargetEffect(this.actionManager, this.player, [this.game.oathkeeperTile]).doNext();
    }
}

export class SetUsurperEffect extends OathEffect {
    constructor(
        actionManager: OathActionManager,
        public usurper: boolean
    ) {
        super(actionManager, undefined);
    }

    resolve(): void {
        this.game.isUsurper = this.usurper;
    }
}

export class GainSupplyEffect extends PlayerEffect {
    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        public amount: number
    ) {
        super(actionManager, player);
    }

    resolve(): void {
        const newSupply = Math.min(7, this.player.supply + this.amount);
        this.amount = newSupply - this.player.supply;
        this.player.supply += this.amount;
    }

    serialize() {
        return {
            ...super.serialize(),
            amount: this.amount
        };
    }
}

export class ChangePhaseEffect extends OathEffect {
    constructor(
        actionManager: OathActionManager,
        public phase: OathPhase
    ) {
        super(actionManager, undefined);
    }

    resolve(): void {
        this.game.phase = this.phase;
        this.actionManager.checkForOathkeeper();
    }

    serialize() {
        return {
            ...super.serialize(),
            phase: this.phase
        };
    }
}

export class NextTurnEffect extends OathEffect {
    constructor(actionManager: OathActionManager) {
        super(actionManager, undefined);
    }

    resolve(): void {
        this.game.turn = (this.game.turn + 1) % this.game.order.length;
        if (this.game.turn === 0) this.game.round++;

        if (this.game.round > 8) {
            if (this.gameProxy.oathkeeper.isImperial)
                return this.actionManager.empireWins();
            
            if (this.gameProxy.isUsurper)
                return new WinGameEffect(this.actionManager, this.gameProxy.oathkeeper.original).doNext();

            // TODO: Break ties according to the rules. Maybe have constant references to the Visions?
            for (const playerProxy of this.gameProxy.players) {
                if (playerProxy.board instanceof ExileBoard && playerProxy.board.vision) {
                    const candidates = playerProxy.board.vision.oath.getOathkeeperCandidates();
                    if (candidates.size === 1 && candidates.has(playerProxy))
                        return new WinGameEffect(this.actionManager, playerProxy.original).doNext();
                }
            }

            return this.actionManager.empireWins();
        }

        if (this.game.round > 5 && this.game.oathkeeper.isImperial) {
            new RollDiceEffect(this.actionManager, this.game.chancellor, new D6(), 1).doNext((result) => {
                const threshold = [6, 5, 3][this.game.round - 6] ?? 7;
                if (result.value >= threshold)
                    return this.actionManager.empireWins();

                new ChangePhaseEffect(this.actionManager, OathPhase.Wake).doNext();
                new WakeAction(this.actionManager, this.game.currentPlayer).doNext();
            });
            return;
        }

        new ChangePhaseEffect(this.actionManager, OathPhase.Wake).doNext();
        new WakeAction(this.actionManager, this.game.currentPlayer).doNext();
    }
}

export class BecomeCitizenEffect extends PlayerEffect {
    resolve(): void {
        if (!(this.player.board instanceof ExileBoard) || this.player.board.isCitizen) return;
        
        const exileBag = this.playerProxy.leader.bag.original;
        const playerColor = this.playerProxy.leader.board.key;
        for (const source of [...this.game.map.sites(), this.player]) {
            const amount = source.getWarbandsAmount(playerColor);
            if (!amount) continue;
            new ParentToTargetEffect(this.actionManager, this.player, source.getWarbands(playerColor), exileBag).doNext();
            new ParentToTargetEffect(this.actionManager, this.game.chancellor, this.game.chancellor.bag.get(amount), source).doNext();
        }

        if (this.player.board.vision) new DiscardCardEffect(this.actionManager, this.player, this.player.board.vision).doNext();
        this.player.board.isCitizen = true;
        new GainSupplyEffect(this.actionManager, this.player, Infinity).doNext();
        if (this.game.currentPlayer === this.player) new RestAction(this.actionManager, this.player).doNext();
    }
}

export class BecomeExileEffect extends PlayerEffect {
    resolve(): void {
        if (!(this.player.board instanceof ExileBoard) || !this.player.board.isCitizen) return;
        this.player.board.isCitizen = false;
        
        const amount = this.player.getWarbandsAmount(PlayerColor.Purple);
        new ParentToTargetEffect(this.actionManager, this.game.chancellor, this.player.getWarbands(PlayerColor.Purple), this.game.chancellor.bag).doNext();
        new ParentToTargetEffect(this.actionManager, this.player, this.playerProxy.leader.bag.original.get(amount), this.player).doNext();

        if (this.game.currentPlayer === this.player) new RestAction(this.actionManager, this.player).doNext();
    }
}

export class PutDenizenIntoDispossessedEffect extends OathEffect {
    constructor(
        actionManager: OathActionManager,
        player: OathPlayer | undefined,
        public denizen: Denizen
    ) {
        super(actionManager, player);
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

    constructor(
        actionManager: OathActionManager,
        player: OathPlayer | undefined,
        public state: boolean
    ) {
        super(actionManager, player);
        const banner = this.game.banners.get(BannerKey.PeoplesFavor) as PeoplesFavor | undefined;
        if (!banner) throw new InvalidActionResolution("No People's Favor");
        this.banner = banner;
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

export class RegionDiscardEffect extends PlayerEffect {
    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        public suits: OathSuit[],
        public source: Denizen | undefined = undefined
    ) {
        super(actionManager, player);
    }

    resolve(): void {
        const cards: Denizen[] = [];
        if (this.player.site.region)
            for (const site of this.player.site.region.sites)
                for (const denizen of site.denizens)
                    if (this.suits.includes(denizen.suit) && denizen !== this.source)
                        cards.push(denizen);

        new DiscardCardGroupEffect(this.actionManager, this.player, cards).doNext();
    }
}

export class BindingExchangeEffect extends PlayerEffect {
    resourcesGiven = new Map<OathResourceType, number>();
    resourcesTaken = new Map<OathResourceType, number>();

    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        public other: OathPlayer
    ) {
        super(actionManager, player);
    }

    resolve(): void {
        for (const [resource, amount] of this.resourcesGiven)
            new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.player, this, new ResourceCost([[resource, amount]]), this.other)).doNext();

        for (const [resource, amount] of this.resourcesTaken)
            new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.other, this, new ResourceCost([[resource, amount]]), this.player)).doNext();
    }
}

export class SiteExchangeOfferEffect extends BindingExchangeEffect {
    sitesGiven = new Set<Site>();
    sitesTaken = new Set<Site>();

    resolve(): void {
        super.resolve();

        for (const site of this.sitesGiven) {
            new MoveOwnWarbandsEffect(this.actionManager, this.player, site, this.player).doNext();
            new ChooseNumberAction(
                this.actionManager, this.other, "Move warbands to " + site.name,
                inclusiveRange(Math.max(0, 1 - site.getWarbandsAmount(this.other.leader.board.key)), this.other.getWarbandsAmount(this.other.leader.board.key)),
                (amount: number) => new MoveOwnWarbandsEffect(this.actionManager, this.other, this.other, site, amount).doNext()
            ).doNext();
        }

        for (const site of this.sitesTaken) {
            new MoveOwnWarbandsEffect(this.actionManager, this.other, site, this.other).doNext();
            new ChooseNumberAction(
                this.actionManager, this.player, "Move warbands to " + site.name,
                inclusiveRange(Math.max(0, 1 - site.getWarbandsAmount(this.player.leader.board.key)), this.player.getWarbandsAmount(this.player.leader.board.key)),
                (amount: number) => new MoveOwnWarbandsEffect(this.actionManager, this.player, this.player, site, amount).doNext()
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
            new ParentToTargetEffect(this.actionManager, this.other, [thing]).doNext();

        for (const thing of this.thingsTaken)
            new ParentToTargetEffect(this.actionManager, this.player, [thing]).doNext();
    }
}

export class CitizenshipOfferEffect extends ThingsExchangeOfferEffect<Relic | Banner> {
    reliquaryIndex: number;

    resolve(): void {
        super.resolve();

        new TakeReliquaryRelicEffect(this.actionManager, this.other, this.reliquaryIndex).doNext();
        new BecomeCitizenEffect(this.actionManager, this.other).doNext();
    }
}

export class TakeReliquaryRelicEffect extends PlayerEffect {
    relic: Relic | undefined;

    constructor(
        actionManager: OathActionManager,
        player: OathPlayer,
        public index: number
    ) {
        super(actionManager, player);
    }

    resolve(): void {
        this.relic = this.game.reliquary.children[this.index]?.children[0];
        if (!this.relic)
            throw new InvalidActionResolution("No relics at the designated Reliquary slot");

        new TakeOwnableObjectEffect(this.actionManager, this.player, this.relic).doNext();
    }

    serialize() {
        return {
            ...super.serialize(),
            relic: this.relic?.name
        };
    }
}

export class ClearResourcesAndWarbandsEffect extends OathEffect {
    constructor(
        actionManager: OathActionManager,
        public target: ResourcesAndWarbands
    ) {
        super(actionManager, undefined);
    }

    resolve(): void {
        for (const resource of [Favor, Secret])
            new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.game.currentPlayer, this, new ResourceCost([], [[resource, Infinity]]), undefined, this.target)).doNext();

        for (const player of this.game.players)
            new ParentToTargetEffect(this.actionManager, player, this.target.getWarbands(player.board.key), player.bag).doNext();
    }
}


//////////////////////////////////////////////////
//               END OF THE GAME                //
//////////////////////////////////////////////////
// NOTE: In theory, none of those should get rolled back, but you never know
export class WinGameEffect extends PlayerEffect {
    resolve(): void {
        new VowOathAction(this.actionManager, this.player).doNext();

        if (!this.player.isImperial)
            new ChooseNewCitizensAction(this.actionManager, this.player).doNext();
        else
            new BuildOrRepairEdificeAction(this.actionManager, this.player).doNext();
        
        new FinishChronicleEffect(this.actionManager, this.player).doNext();
    }
}

export class BuildEdificeFromDenizenEffect extends OathEffect {
    edifice: Edifice;

    constructor(
        actionManager: OathActionManager,
        public denizen: Denizen
    ) {
        super(actionManager, undefined);
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
                new ParentToTargetEffect(this.actionManager, this.player, [this.edifice], site).doNext();
                new ParentToTargetEffect(this.actionManager, this.player, this.denizen.children, this.edifice).doNext();
                break;
            }
        }
        new ParentToTargetEffect(this.actionManager, this.player, [this.denizen], site.region?.discard).doNext();
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
    newEdifice: Edifice;

    constructor(
        actionManager: OathActionManager,
        public edifice: Edifice
    ) {
        super(actionManager, undefined);
    }

    resolve(): void {
        if (!this.edifice.site) throw new InvalidActionResolution("Card is not at a site (How?)");

        for (const [key, other] of Object.entries(edificeFlipside)) {
            if (key === this.edifice.name) {
                this.newEdifice = new Edifice(other);
                new ParentToTargetEffect(this.actionManager, this.player, [this.newEdifice], this.edifice.site).doNext();
                new ParentToTargetEffect(this.actionManager, this.player, this.edifice.children, this.newEdifice).doNext();
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
                if (!siteProxy.ruler?.isImperial && siteProxy.ruler !== this.playerProxy) {
                    for (const denizenProxy of siteProxy.denizens) {
                        if (denizenProxy instanceof Edifice && denizenProxy.suit !== OathSuit.None) {
                            new FlipEdificeEffect(this.actionManager, denizenProxy).doNext();
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
                new ClearResourcesAndWarbandsEffect(this.actionManager, siteProxy.original).doNext();
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
        const futureReliquary = [...this.game.reliquary.children.map((e) => e.children[0]).filter((e) => e !== undefined)];
        const relicDeck = this.game.relicDeck;
        for (const player of this.game.players) {
            for (const relic of player.relics) {
                if (relic === this.game.grandScepter) continue;

                if (player === this.player)
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
            this.actionManager, this.player, "Choose a suit to add to the World Deck", 
            (suits: OathSuit[]) => { if (suits[0] !== undefined) this.addCardsToWorldDeck(suits[0]); },
            [maxInGroup(ALL_OATH_SUITS, this.player.suitAdviserCount.bind(this.player))]
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
            const deck = player === this.player ? worldDeck : firstDiscard;
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

            new PutDenizenIntoDispossessedEffect(this.actionManager, this.player, card).doNext();
        }

        new DiscardCardGroupEffect(this.actionManager, this.player, firstDiscard.children, new DiscardOptions(worldDeck, false, true)).doNext(() => {
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
    
            this.game.updateSeed(this.player.board.key);
        });
        new ChangePhaseEffect(this.actionManager, OathPhase.Over).doNext();
    }
}