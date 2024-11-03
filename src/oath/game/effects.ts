import { Denizen, Edifice, OathCard, OwnableCard, Relic, Site, Vision, VisionBack, WorldCard } from "./cards/cards";
import { BannerName, CardRestriction, OathPhase, OathSuit, PlayerColor } from "./enums";
import { Exile, OathPlayer } from "./player";
import { ActionModifier, EffectModifier, OathPower, WhenPlayed } from "./powers/powers";
import { Favor, OathResource, OathResourceType, ResourceCost, ResourcesAndWarbands, Secret } from "./resources";
import { Banner, FavorBank, PeoplesFavor } from "./banks";
import { OwnableObject, WithPowers } from "./interfaces";
import { OathGame } from "./game";
import { OathGameObject } from "./gameObject";
import { InvalidActionResolution, ModifiableAction, OathAction, BuildOrRepairEdificeAction, ChooseNewCitizensAction, VowOathAction, RestAction, WakeAction, CampaignDefenseAction, CampaignResult, SearchDiscardAction, SearchPlayOrDiscardAction, ChooseSuitsAction, ResolveEffectAction } from "./actions/actions";
import { DiscardOptions } from "./cards/decks";
import { CardDeck } from "./cards/decks";
import { Constructor, isExtended, MaskProxyManager, shuffleArray, TreeNode } from "./utils";
import { D6, RollResult, Die, DieSymbol } from "./dice";
import { Oath } from "./oaths";
import { Region } from "./board";
import { edificeData } from "./cards/denizens";



//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export abstract class OathEffect<T = void> {
    game: OathGame;
    player: OathPlayer | undefined;
    modifiers: EffectModifier<any, OathEffect<T>>[] = [];
    maskProxyManager: MaskProxyManager;
    gameProxy: OathGame;
    playerProxy: OathPlayer | undefined;

    constructor(game: OathGame, player: OathPlayer | undefined) {
        this.game = game;
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
        for (const [sourceProxy, modifier] of this.gameProxy.getPowers(EffectModifier<any, OathEffect<T>>)) {
            const instance = new modifier(sourceProxy.original, this);
            if (this instanceof instance.modifiedEffect && instance.canUse()) {  // All Effect modifiers are must-use
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

    serialize(): Record<string, any> | undefined {
        return undefined;
    }
}

export abstract class PlayerEffect<T = void> extends OathEffect<T> {
    player: OathPlayer;
    playerProxy: OathPlayer;

    constructor(player: OathPlayer) {
        super(player.game, player);
    }
}


//////////////////////////////////////////////////
//                   EFFECTS                    //
//////////////////////////////////////////////////
export class AddActionToStackEffect extends OathEffect {
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

export class ApplyModifiersEffect<T extends ModifiableAction> extends OathEffect<boolean> {
    action: T;
    actionModifiers: Iterable<ActionModifier<WithPowers, T>>;

    constructor(action: T, actionModifiers: Iterable<ActionModifier<WithPowers, T>>) {
        super(action.game, undefined);
        this.action = action;
        this.actionModifiers = actionModifiers;
    }

    resolve(): boolean {
        this.action.modifiers.push(...this.actionModifiers);

        let interrupt = false;
        for (const modifier of this.actionModifiers) {
            if (!modifier.payCost(modifier.activator))
                throw modifier.cost.cannotPayError;

            if (!modifier.applyWhenApplied()) interrupt = true;

            // Modifiers can only be applied once
            modifier.sourceProxy.powers.delete(modifier.constructor as Constructor<ActionModifier<WithPowers, T>>);
        }

        return !interrupt;
    }

    revert(): void {
        for (const modifier of this.actionModifiers) {
            this.action.modifiers.pop();
            modifier.sourceProxy.powers.add(modifier.constructor as Constructor<ActionModifier<WithPowers, T>>);
        }
    }
}

export class GainPowerEffect<T extends WithPowers> extends OathEffect {
    target: T;
    power: Constructor<OathPower<T>>;
    resolved: boolean;

    constructor(game: OathGame, target: T, power: Constructor<OathPower<T>>) {
        super(game, undefined);
        this.target = target;
        this.power = power;
    }

    resolve(): void {
        this.resolved = !this.target.powers.has(this.power);
        this.target.powers.add(this.power);
    }

    revert(): void {
        if (this.resolved) this.target.powers.delete(this.power);
    }
}

export class LosePowerEffect<T extends WithPowers> extends OathEffect {
    target: T;
    power: Constructor<OathPower<T>>;
    resolved: boolean;

    constructor(game: OathGame, target: T, power: Constructor<OathPower<T>>) {
        super(game, undefined);
        this.target = target;
        this.power = power;
    }

    resolve(): void {
        this.resolved = this.target.powers.delete(this.power);
    }

    revert(): void {
        if (this.resolved) this.target.powers.add(this.power);
    }
}

export class ParentToTargetEffect extends OathEffect {
    objects: Set<OathGameObject>;
    target?: OathGameObject;
    onTop: boolean;
    oldParents: TreeNode<any>[];

    constructor(game: OathGame, player: OathPlayer | undefined, objects: Iterable<OathGameObject>, target?: OathGameObject, onTop: boolean = false) {
        super(game, player);
        this.objects = new Set(objects);
        this.target = target ?? this.player;
        this.onTop = onTop;
    }

    resolve(): void {
        const objectsArray = [...this.objects];
        this.oldParents = objectsArray.map(e => e.parent);
        if (this.target)
            this.target.addChildren(objectsArray, this.onTop);
        else
            for (const object of this.objects) object.unparent();
    }

    revert(): void {
        // TODO: Do proper revert
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

    revert(): void {
        // TODO: Do proper revert
    }
}

export class PutResourcesOnTargetEffect extends OathEffect<number> {
    resource: typeof OathResource;
    amount: number;
    target?: ResourcesAndWarbands;

    constructor(game: OathGame, player: OathPlayer | undefined, resource: typeof OathResource, amount: number, target?: ResourcesAndWarbands) {
        super(game, player);
        this.resource = resource;
        this.amount = Math.max(0, amount);
        this.target = target || this.player;
    }

    resolve(): number {
        return this.target?.putResources(this.resource, this.amount) || 0;
    }

    revert(): void {
        if (!this.target) return;
        for (const resource of this.target.getResources(this.resource, this.amount)) resource.burn();
    }

    serialize(): Record<string, any> | undefined {
        return {
            target: this.target?.name,
            resource: this.resource.name,
            amount: this.amount
        };
    }
}

export class MoveResourcesToTargetEffect extends OathEffect<number> {
    resource: OathResourceType;
    amount: number;
    target?: ResourcesAndWarbands;
    source?: ResourcesAndWarbands;

    constructor(game: OathGame, player: OathPlayer | undefined, resource: OathResourceType, amount: number, target: ResourcesAndWarbands | undefined, source?: ResourcesAndWarbands) {
        super(game, player);
        this.resource = resource;
        this.amount = Math.max(0, amount);
        this.target = target;
        this.source = source || this.player;
    }

    resolve(): number {
        if (!this.source) return 0;
        if (this.source.getResources(this.resource).length < this.amount) return 0;
        const resources = this.source.getResources(this.resource, this.amount)
        new ParentToTargetEffect(this.game, this.player, resources, this.target).do();
        return resources.length;
    }

    revert(): void {
        // Doesn't do anything on its own
    }

    serialize(): Record<string, any> | undefined {
        return {
            source: this.source?.name,
            target: this.target?.name,
            resource: this.resource.name,
            amount: this.amount
        };
    }
}

export class BurnResourcesEffect extends OathEffect<void> {
    resources: OathResource[];

    constructor(game: OathGame, player: OathPlayer | undefined, resources: Iterable<OathResource>) {
        super(game, player);
        this.resources = [...resources];
    }

    resolve(): void {
        for (const resource of this.resources)
            resource.burn();
    }

    revert(): void {
        // TODO: Do proper revert
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
            if (this.source.getResources(resource).length < amount) return false;

        for (const [resource, amount] of this.cost.burntResources)
            new BurnResourcesEffect(this.game, this.player, this.source.getResources(resource, amount)).do();

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
            if (this.source.getResources(resource).length < amount) return false;

        for (const [resource, amount] of this.cost.burntResources)
            new BurnResourcesEffect(this.game, this.player, this.source.getResources(resource, amount)).do();

        if (this.suit)
            new ParentToTargetEffect(this.game, this.player, this.source?.getResources(Favor, this.cost.placedResources.get(Favor)), this.game.byClass(FavorBank).byId(this.suit)[0]).do();
        
        new FlipSecretsEffect(this.game, this.player, this.cost.placedResources.get(Secret) || 0, true, this.source).do();

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

        const secrets = this.source.byClass(Secret).by("flipped", !this.facedown).max(this.amount);
        this.amount = secrets.length;
        for (const secret of secrets) secret.flipped = this.facedown;
        return this.amount;
    }

    revert(): void {
        if (!this.source) return;
        for (const secret of this.source.getResources(Secret, this.amount)) secret.flipped = false;
    }

    serialize(): Record<string, any> | undefined {
        return {
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
        this.source = source || this.player;
    }

    resolve(): number {
        this.amount = this.source?.moveWarbandsTo(this.owner.id, this.target, this.amount) || 0;
        return this.amount;
    }

    revert(): void {
        if (this.source) this.target.moveWarbandsTo(this.owner.id, this.source, this.amount);
    }

    serialize(): Record<string, any> | undefined {
        return {
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

    resolve(): number {
        this.amount = this.player.moveOwnWarbands(this.from, this.to, this.amount);
        return this.amount;
    }

    revert(): void {
        this.player.moveOwnWarbands(this.to, this.from, this.amount);
    }

    serialize(): Record<string, any> | undefined {
        return {
            owner: this.player.name,
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

    serialize(): Record<string, any> | undefined {
        return {
            player: this.player.name,
            site: this.site.name
        };
    }
}

export class PeekAtCardEffect extends PlayerEffect {
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

export class RevealCardEffect extends OathEffect {
    card: OathCard;

    constructor(game: OathGame, player: OathPlayer | undefined, card: OathCard) {
        super(game, player);
        this.card = card;
    }

    resolve(): void {
        for (const player of this.game.players)
            new PeekAtCardEffect(player, this.card).do();
    }

    revert(): void {
        // Doesn't do anything on its own
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

    revert(): void {
        this.card.seenBy = this.oldPeeks;
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

    resolve(): T[] {
        this.cards = this.deck.draw(this.amount, this.fromBottom, this.skip);
        for (const card of this.cards) {
            if (this.cards.length > 1) new ClearCardPeekEffect(this.player, card).do();
            new PeekAtCardEffect(this.player, card).do();
        }

        return this.cards;
    }

    revert(): void {
        for (const card of this.cards.reverse()) this.deck.addChild(card, this.fromBottom);
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

    revert(): void {
        // Doesn't do anything on its own
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
        new ParentToTargetEffect(this.game, this.player, [this.card], this.site).do();
        this.revealedCard = this.card.facedown;
        if (this.revealedCard) this.card.reveal();
        
        // TODO: Put this in an effect?
        const bank = this.game.byClass(FavorBank).byId(this.card.suit)[0];
        for (const [resource, amount] of this.getting) {
            if (bank && resource === Favor)
                new ParentToTargetEffect(this.game, this.player, bank.byClass(Favor).max(amount)).do();
            else
                new PutResourcesOnTargetEffect(this.game, this.player, resource, amount).do();
        }
    }

    revert(): void {
        if (this.revealedCard) this.card.hide();
    }
}

export class PlayWorldCardToAdviserEffect extends PlayerEffect {
    card: WorldCard;
    facedown: boolean;
    revealedCard: boolean;

    constructor(player: OathPlayer, card: WorldCard, facedown: boolean) {
        super(player);
        this.card = card;
        this.facedown = facedown;
    }

    resolve(): void {
        new ParentToTargetEffect(this.game, this.player, [this.card]).do();
        this.revealedCard = this.card.facedown && !this.facedown;
        if (this.revealedCard) this.card.reveal();
    }

    revert(): void {
        if (this.revealedCard) this.card.hide();
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

export class MoveWorldCardToAdvisersEffect extends OathEffect {
    card: WorldCard;
    target: OathPlayer | undefined;

    constructor(game: OathGame, player: OathPlayer | undefined, card: WorldCard, target?: OathPlayer) {
        super(game, player);
        this.card = card;
        this.target = target || this.player;
    }

    resolve(): void {
        if (!this.card.facedown && this.card instanceof Denizen && this.maskProxyManager.get(this.card).restriction === CardRestriction.Site)
            throw new InvalidActionResolution("Cannot move site-only cards to advisers.");

        if (!this.target) return;
        new ParentToTargetEffect(this.game, this.player, [this.card], this.target).do()
        new CheckCapacityEffect(this.target, [this.target]).do();
    }

    revert(): void {
        // Doesn't do anything on its own
    }

    serialize(): Record<string, any> | undefined {
        return {
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
        new ParentToTargetEffect(this.game, this.player, [this.card], this.target).do()
        new CheckCapacityEffect(this.player || this.game.currentPlayer, [this.target]).do();
    }

    revert(): void {
        // Doesn't do anything on its own
    }

    serialize(): Record<string, any> | undefined {
        return {
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

            new DiscardCardEffect(this.player, card, this.discardOptions).do();
        }

        new CheckCapacityEffect(this.player, origins, this.discardOptions).do();
    }

    revert(): void {
        // Doesn't do anything on its own
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
            const player = origin instanceof OathPlayer ? origin : origin.ruler || this.player;
            
            const [capacity, takesSpaceInTargetProxies, _] = SearchPlayOrDiscardAction.getCapacityInformation(this.maskProxyManager, player, site);
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

export class DiscardCardEffect<T extends OathCard> extends PlayerEffect {
    card: T;
    discardOptions: DiscardOptions<OathCard>;
    flipped: boolean;

    constructor(player: OathPlayer, card: T, discardOptions?: DiscardOptions<T>) {
        super(player);
        this.card = card;
        this.discardOptions = discardOptions || new DiscardOptions(card.discard || player.discard);
    }

    resolve(): void {
        this.flipped = !this.card.facedown;
        new ParentToTargetEffect(this.game, this.player, [this.card], this.discardOptions.discard, !this.discardOptions.onBottom);
        this.card.returnResources();
        for (const player of this.game.players)
            new ParentToTargetEffect(this.game, player, this.card.getWarbands(player.id), player.bag);
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        // This just removes it from the deck
        if (this.flipped) this.card.reveal();
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
            if (this.flipFaceup) this.target.reveal();
        }
        
        new ParentToTargetEffect(this.game, this.player, [this.target]).do();
    }

    revert(): void {
        if (this.target instanceof OwnableCard && this.flipFaceup) this.target.hide();
    }

    serialize(): Record<string, any> | undefined {
        return {
            player: this.player?.name,
            target: (this.target as unknown as ResourcesAndWarbands).name,
        };
    }
}

export class RollDiceEffect extends OathEffect<RollResult> {
    die: typeof Die;
    amount: number;
    result: RollResult;

    constructor(game: OathGame, player: OathPlayer | undefined, die: typeof Die, amount: number, result: RollResult = new RollResult()) {
        super(game, player);
        this.die = die;
        this.amount = Math.max(0, amount);
        this.result = result;
    }

    resolve(): RollResult {
        // NOTE: Because of powers like Jinx and Squalid District, the result of this should NOT be processed in its current action,
        // but in a consecutive one, so a new action can be slotted in-between
        this.result.roll(this.die, this.amount);
        return this.result;
    }

    revert(): void {
        // This is a "read" effect, and so cannot be reverted (and should not need to)
        // In this case, a dice roll should not get reverted
    }

    serialize(): Record<string, any> | undefined {
        return {
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
        this.campaignResult.defenderAllies.add(this.player);
    }
    
    revert(): void {
        this.campaignResult.defenderAllies.delete(this.player);
    }

    serialize(): Record<string, any> | undefined {
        return {
            player: this.player
        };
    }
}

export class CampaignResolveSuccessfulAndSkullsEffect extends PlayerEffect {
    action: CampaignDefenseAction;

    constructor(action: CampaignDefenseAction) {
        super(action.player);
        this.action = action;
    }
    
    resolve(): void {
        const campaignResult = this.action.campaignResult;
        campaignResult.successful = campaignResult.atk > campaignResult.def;

        if (!campaignResult.params.ignoreKilling)
            campaignResult.attackerKills(campaignResult.params.atkRoll.get(DieSymbol.Skull));
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class SetNewOathkeeperEffect extends PlayerEffect {
    oldOathkeeper: OathPlayer;

    resolve(): void {
        this.oldOathkeeper = this.game.oathkeeper;
        this.player.addChild(this.game.oath);
    }

    revert(): void {
        this.oldOathkeeper.addChild(this.game.oath);
    }

    serialize(): Record<string, any> | undefined {
        return {
            player: this.player.name
        };
    }
}

export class SetUsurperEffect extends OathEffect {
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

    serialize(): Record<string, any> | undefined {
        return {
            usurper: this.usurper
        };
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

    serialize(): Record<string, any> | undefined {
        return {
            player: this.player.name,
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
        const newSupply = Math.min(7, this.player.supply + this.amount);
        this.amount = newSupply - this.player.supply;
        this.player.supply += this.amount;
    }

    revert(): void {
        this.player.supply -= this.amount;
    }

    serialize(): Record<string, any> | undefined {
        return {
            player: this.player.name,
            amount: this.amount
        };
    }
}

export class ChangePhaseEffect extends OathEffect {
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

    serialize(): Record<string, any> | undefined {
        return {
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
            if (this.game.oathkeeper.isImperial)
                return this.game.empireWins();
            
            if (this.game.isUsurper)
                return new WinGameEffect(this.game.oathkeeper).do();

            // TODO: Break ties according to the rules. Maybe have constant references to the Visions?
            for (const player of this.game.players) {
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

export class HandleD6ResultEffect extends OathEffect {
    result: RollResult;

    constructor(game: OathGame, result: RollResult) {
        super(game, undefined);
        this.result = result;
    }

    resolve(): void {
        const threshold = [6, 5, 3][this.game.round - 6] ?? 7;
        if (this.result.value >= threshold)
            return this.game.empireWins();

        new ChangePhaseEffect(this.game, OathPhase.Wake).doNext();
        new WakeAction(this.game.currentPlayer).doNext();
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class BecomeCitizenEffect extends PlayerEffect {
    resolved = false;

    resolve(): void {
        if (!(this.player instanceof Exile) || this.player.isCitizen) return;
        this.resolved = true;
        
        const amount = this.player.getWarbandsAmount(this.player.id);
        new ParentToTargetEffect(this.game, this.player, this.player.getWarbands(this.player.id), this.player.bag).do();
        new ParentToTargetEffect(this.game, this.game.chancellor, this.game.chancellor.bag.get(amount), this.player).do();
        for (const site of this.game.board.sites()) {
            const amount = site.getWarbandsAmount(this.player.id);
            new ParentToTargetEffect(this.game, this.player, site.getWarbands(this.player.id), this.player.bag).do();
            new ParentToTargetEffect(this.game, this.game.chancellor, this.game.chancellor.bag.get(amount), site).do();
        }

        if (this.player.vision) new DiscardCardEffect(this.player, this.player.vision).do();
        this.player.isCitizen = true;
        new GainSupplyEffect(this.player, Infinity).do();
        if (this.game.currentPlayer === this.player) new RestAction(this.player).doNext();
    }

    revert(): void {
        if (!(this.player instanceof Exile) || !this.resolved) return;
        this.player.isCitizen = false;
    }

    serialize(): Record<string, any> | undefined {
        return {
            player: this.player
        };
    }
}

export class BecomeExileEffect extends PlayerEffect {
    resolved = false;

    resolve(): void {
        if (!(this.player instanceof Exile) || !this.player.isCitizen) return;
        this.resolved = true;
        this.player.isCitizen = false;
        
        const amount = this.player.getWarbandsAmount(PlayerColor.Purple);
        new ParentToTargetEffect(this.game, this.game.chancellor, this.player.getWarbands(PlayerColor.Purple), this.game.chancellor.bag).do();
        new ParentToTargetEffect(this.game, this.player, this.player.bag.get(amount), this.player).do();

        if (this.game.currentPlayer === this.player) new RestAction(this.player).doNext();
    }

    revert(): void {
        if (!(this.player instanceof Exile) || !this.resolved) return;
        this.player.isCitizen = true;
    }

    serialize(): Record<string, any> | undefined {
        return {
            player: this.player
        };
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
        this.game.dispossessed[this.denizen.name] = this.denizen.data;
    }

    revert(): void {
        // The thing that calls this effect is in charge of putting the card back where it was
        delete this.game.dispossessed[this.denizen.name];
    }

    serialize(): Record<string, any> | undefined {
        return {
            card: this.denizen.name
        };
    }
}

export class GetRandomCardFromDispossessed extends OathEffect<Denizen> {
    denizen: Denizen;

    resolve(): Denizen {
        const keys = Object.keys(this.game.dispossessed);
        const name = keys[Math.floor(Math.random() * keys.length)]!;
        this.denizen = new Denizen(name, ...this.game.dispossessed[name]!);
        delete this.game.dispossessed[name];
        return this.denizen;
    }

    revert(): void {
        this.game.dispossessed[this.denizen.name] = this.denizen.data;
    }

    serialize(): Record<string, any> | undefined {
        return {
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
    oldState: boolean;

    constructor(game: OathGame, player: OathPlayer | undefined, state: boolean) {
        super(game, player);
        const banner = game.banners.get(BannerName.PeoplesFavor) as PeoplesFavor | undefined;
        if (!banner) throw new InvalidActionResolution("No People's Favor");
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

    serialize(): Record<string, any> | undefined {
        return {
            state: this.state
        };
    }
}

export class SetGrandScepterLockEffect extends OathEffect {
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
            new ParentToTargetEffect(this.game, this.other, [thing]).do();

        for (const thing of this.thingsTaken)
            new ParentToTargetEffect(this.game, this.player, [thing]).do();

        new TakeReliquaryRelicEffect(this.other, this.reliquaryIndex).do();
        new BecomeCitizenEffect(this.other).do();
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

        new TakeOwnableObjectEffect(this.game, this.player, this.relic).do();
    }

    revert(): void {
        if (this.relic) this.game.chancellor.reliquary.putRelic(this.relic, this.index);
    }

    serialize(): Record<string, any> | undefined {
        return {
            player: this.player.name,
            relic: this.relic?.name
        };
    }
}


//////////////////////////////////////////////////
//               END OF THE GAME                //
//////////////////////////////////////////////////
// NOTE: In theory, none of those should get rolled back, but you never know
export class WinGameEffect extends PlayerEffect {
    oldOath: Oath;

    resolve(): void {
        this.oldOath = this.game.oath;
        new VowOathAction(this.player).doNext();

        if (!this.player.isImperial)
            new ChooseNewCitizensAction(this.player).doNext();
        else
            new BuildOrRepairEdificeAction(this.player).doNext();
        
        new FinishChronicleEffect(this.player).doNext();
    }

    revert(): void {
        this.game.oath = this.oldOath;
    }

    serialize(): Record<string, any> | undefined {
        return {
            player: this.player.name
        };
    }
}

export class BuildEdificeFromDenizenEffect extends OathEffect {
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
                this.edifice = new Edifice(key, ...data),
                new ParentToTargetEffect(this.game, this.player, [this.edifice], this.site).do();
                new ParentToTargetEffect(this.game, this.player, this.denizen.children, this.edifice).do();
                break;
            }
        }
        new ParentToTargetEffect(this.game, this.player, [this.denizen], this.site.region.discard).do();
    }

    revert(): void {
        // Doesn't do anything on its own;
    }

    serialize(): Record<string, any> | undefined {
        return {
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

        for (const [key, [other, ...data]] of Object.entries(edificeData)) {
            if (key === this.edifice.name) {
                const [_, ...otherData] = edificeData[other]!;
                this.newEdifice = new Edifice(other, ...otherData);
                new ParentToTargetEffect(this.game, this.player, [this.newEdifice], this.edifice.site).do();
                new ParentToTargetEffect(this.game, this.player, this.edifice.children, this.newEdifice).do();
                this.newEdifice.reveal();
                break;
            }
        }
        this.edifice.prune();
    }

    revert(): void {
        // Doesn't do anything on its own
    }

    serialize(): Record<string, any> | undefined {
        return {
            edifice: this.edifice.name,
            newEdifice: this.newEdifice.name
        };
    }
}

export class FinishChronicleEffect extends PlayerEffect {
    oldRegions = new Map<Region, Site[]>();

    resolve(): void {
        const storedSites: Site[] = [];
        const pushedSites: Site[] = [];

        // Discard and put aside sites 
        for (const regionProxy of this.gameProxy.board.children) {
            this.oldRegions.set(regionProxy, [...regionProxy.sites]);

            for (const siteProxy of regionProxy.sites) {
                regionProxy.sites.splice(regionProxy.sites.indexOf(siteProxy), 1);
                if (!siteProxy.ruler?.isImperial && siteProxy.ruler !== this.player) {
                    for (const denizenProxy of siteProxy.denizens) {
                        if (denizenProxy instanceof Edifice && denizenProxy.suit !== OathSuit.None) {
                            new FlipEdificeEffect(denizenProxy).do();
                            pushedSites.push(siteProxy.original);
                        } else {
                            new DiscardCardEffect(this.player, denizenProxy.original, new DiscardOptions(regionProxy.discard.original, false, true)).do();
                        }
                    }
                    new DiscardCardEffect(this.player, siteProxy.original, new DiscardOptions(this.game.siteDeck)).do();
                } else {
                    storedSites.push(siteProxy.original);
                }

                siteProxy.original.clear();
            }
        }
        this.game.siteDeck.shuffle();  // TODO: Shuffles in an effect to be reverted/replayed
        let total = this.game.board.byClass(Region).reduce((a, e) => a + e.size, 0) - storedSites.length - pushedSites.length;
        for (var i = 0; i < total; i++) {
            const site = this.game.siteDeck.drawSingleCard();
            if (!site) throw Error("Not enough sites");
            storedSites.push(site);
        }
        storedSites.push(...pushedSites);

        // Rebuild the map
        for (const region of this.game.board.children) {
            let hasFaceupSite = false;
            while (region.sites.length < region.size) {
                const site = storedSites.shift()
                if (!site) break;
                region.sites.push(site);
                if (!site.facedown) hasFaceupSite = true;
            }

            if (!hasFaceupSite) region.sites[0]?.reveal();
        }

        // Collect and deal relics (technically not at this point of the Chronicle, but this has no impact)
        const futureReliquary = [...this.game.chancellor.reliquary.children.map(e => e.children[0]).filter(e => e !== undefined)];
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
        for (const site of this.game.board.sites()) {
            if (site.facedown) continue;
            for (i = site.relics.length; i < site.startingRelics; i++) {
                const relic = relicDeck.drawSingleCard();
                if (relic) site.addChild(relic);
            }
        }

        shuffleArray(futureReliquary);
        while (futureReliquary.length) {
            const relic = futureReliquary.pop();
            if (relic) relicDeck.addChild(relic)
        }
        for (let i = 0; i < 4; i++) {
            const relic = relicDeck.drawSingleCard();
            if (relic) this.game.chancellor.reliquary.children[i]?.addChild(relic);
        }

        let max = 0;
        const suits = new Set<OathSuit>();
        for (let i: OathSuit = 0; i < 6; i++) {
            const count = this.player.suitAdviserCount(i);
            if (count >= max) {
                max = count;
                suits.clear();
                suits.add(i);
            } else if (count === max) {
                suits.add(i);
            }
        }
        new ChooseSuitsAction(
            this.player, "Choose a suit to add to the World Deck", 
            (suits: OathSuit[]) => { if (suits[0]) this.addCardsToWorldDeck(suits[0]); },
            [suits]
        ).doNext();
    }

    getRandomCardDataInArchive(suit: OathSuit): string[] {
        const cardKeys: string[] = [];
        for (const [key, data] of Object.entries(this.game.archive))
            if (data[0] === suit) cardKeys.push(key);

        shuffleArray(cardKeys);
        return cardKeys;
    }

    addCardsToWorldDeck(suit: OathSuit) {
        const worldDeck = this.game.worldDeck;
        const worldDeckDiscardOptions = new DiscardOptions(worldDeck, false, true);
        for (let i = 3; i >= 1; i--) {
            const cardKeys = this.getRandomCardDataInArchive(suit);
            for (let j = 0; j < i; j++) {
                const key = cardKeys.pop();
                if (!key) break;
                const data = this.game.archive[key];
                if (!data) break;
                delete this.game.archive[key];

                new DiscardCardEffect(this.player, new Denizen(key, ...data), worldDeckDiscardOptions).do();
            }

            suit++;
            if (suit > OathSuit.Nomad) suit = OathSuit.Discord;
        }

        // Remove cards to the Dispossessed
        const firstDiscard = this.game.board.children[0]!.discard;
        const firstDiscardOptions = new DiscardOptions(firstDiscard, false, true);
        for (const player of this.game.players) {
            const discardOptions = player === this.player ? worldDeckDiscardOptions : firstDiscardOptions;
            new DiscardCardGroupEffect(this.player, player.advisers, discardOptions).do();
        }
        for (const region of this.game.board.children) {
            const cards = new DrawFromDeckEffect(this.player, region.discard, region.discard.children.length).do();
            new DiscardCardGroupEffect(this.player, cards, firstDiscardOptions).do();
        }

        firstDiscard.shuffle(); // TODO: Put this in effect
        for (let i = 0; i < 6; i++) {
            const cards = new DrawFromDeckEffect(this.player, firstDiscard, 1).do();
            if (!cards[0]) break;
            const card = cards[0];

            if (!(card instanceof Denizen)) {
                new DiscardCardEffect(this.player, card, worldDeckDiscardOptions).do();
                continue;
            }
            this.game.dispossessed[card.name] = card.data;
        }
        const cards = new DrawFromDeckEffect(this.player, firstDiscard, firstDiscard.children.length).do();
        new DiscardCardGroupEffect(this.player, cards, worldDeckDiscardOptions).do();
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
        shuffleArray(topPile);
        shuffleArray(middlePile);

        // Those effectively just reorder the cards
        worldDeck.addChildren(middlePile);
        worldDeck.addChildren(topPile);

        this.game.updateSeed(this.player.id);
    }

    revert(): void {
        // TODO: Do proper revert
    }
}