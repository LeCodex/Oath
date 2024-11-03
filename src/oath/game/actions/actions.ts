import { Denizen, Edifice, OathCard, OwnableCard, Relic, Site, WorldCard } from "../cards/cards";
import { DiscardOptions, SearchableDeck } from "../cards/decks";
import { AttackDie, DefenseDie, RollResult } from "../dice";
import { MoveResourcesToTargetEffect, PayCostToTargetEffect, PlayWorldCardEffect, RollDiceEffect, DrawFromDeckEffect, PutPawnAtSiteEffect, DiscardCardEffect, MoveOwnWarbandsEffect, SetPeoplesFavorMobState, OathEffect, PaySupplyEffect, ChangePhaseEffect, NextTurnEffect, PutResourcesOnTargetEffect, SetUsurperEffect, BecomeCitizenEffect, BecomeExileEffect, BuildEdificeFromDenizenEffect, WinGameEffect, FlipEdificeEffect, CampaignResolveSuccessfulAndSkullsEffect, BindingExchangeEffect, CitizenshipOfferEffect, PeekAtCardEffect, TakeReliquaryRelicEffect, CheckCapacityEffect, ApplyModifiersEffect, CampaignJoinDefenderAlliesEffect, MoveWorldCardToAdvisersEffect, DiscardCardGroupEffect, ParentToTargetEffect } from "../effects";
import { ALL_OATH_SUITS, OathPhase, OathSuit, OathSuitName, OathType, OathTypeName } from "../enums";
import { OathGame } from "../game";
import { OathTypeToOath } from "../oaths";
import { Exile, OathPlayer } from "../player";
import { ActionModifier, ActivePower, CapacityModifier } from "../powers/powers";
import { Favor, OathResource, OathResourceType, ResourceCost, ResourcesAndWarbands, Secret } from "../resources";
import { Banner, FavorBank, PeoplesFavor } from "../banks";
import { Constructor, inclusiveRange, isExtended, MaskProxyManager, minInGroup, DataObject} from "../utils";
import { SelectNOf, SelectBoolean, SelectNumber } from "./selects";
import { CampaignActionTarget, RecoverActionTarget, WithPowers } from "../interfaces";
import { Region } from "../board";



//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export class InvalidActionResolution extends Error { }

export abstract class OathAction {
    game: OathGame;
    readonly selects: Record<string, SelectNOf<any>> = {};
    readonly parameters: Record<string, any> = {};
    readonly autocompleteSelects: boolean = true;
    abstract readonly message: string;

    player: OathPlayer;     // This is the original player. Modifying it modifies the game state

    constructor(player: OathPlayer) {
        this.game = player.game;
        this.player = player;
    }

    doNext(): void {
        this.game.actionManager.futureActionsList.unshift(this);
    }

    parse(data: Record<string, string[]>): Record<string, any[]> {
        const values: Record<string, any[]> = {};
        for (const [key, select] of Object.entries(this.selects)) {
            if (!data[key]) throw new InvalidActionResolution(`Missing choice for select ${key}`);
            values[key] = select.parse(data[key]);
        }

        return values;
    }

    applyParameters(values: Record<string, any[]>) {
        for (const [key, value] of Object.entries(values)) {
            this.parameters[key] = value;
        }
    }

    start(): boolean {
        // NOTE: Setup the selects before
        for (const [key, select] of Object.entries(this.selects)) {
            if (this.autocompleteSelects && select.choices.size <= select.min || select.choices.size === 0) {
                this.parameters[key] = [...select.choices.values()];
                delete this.selects[key];
            }
        }

        // If all needed parameters were filled out (or there are no selects), just execute immediately
        return Object.keys(this.selects).length === 0;
    }

    abstract execute(): void;

    serialize(): Record<string, any> {
        return {
            message: this.message,
            player: this.player.id,
            selects: Object.fromEntries(Object.entries(this.selects).map(([k, v]) => [k, v.serialize()])),
        }
    }
}

export class ChooseModifiers<T extends ModifiableAction> extends OathAction {
    readonly selects: { modifiers: SelectNOf<ActionModifier<WithPowers, T>> };
    readonly parameters: { modifiers: ActionModifier<WithPowers, T>[] };
    readonly action: T;
    readonly next: T | ChooseModifiers<T>;
    readonly message = "Choose modifiers";

    persistentModifiers: Set<ActionModifier<WithPowers, T>>;

    constructor(next: T | ChooseModifiers<T>, chooser: OathPlayer = next.player) {
        super(chooser);
        this.next = next;
        this.action = next instanceof ChooseModifiers ? next.action : next;
    }

    start() {
        this.persistentModifiers = new Set();
        const choices = new Map<string, ActionModifier<WithPowers, T>>();
        for (const modifier of ChooseModifiers.gatherModifiers(this.action, this.player)) {
            if (modifier.mustUse)
                this.persistentModifiers.add(modifier);
            else
                choices.set(modifier.name, modifier);
        }
        this.selects.modifiers = new SelectNOf("Modifiers", choices);

        return super.start();
    }

    static gatherModifiers<T extends ModifiableAction>(action: T, activator: OathPlayer): Set<ActionModifier<WithPowers, T>> {
        const instances = new Set<ActionModifier<WithPowers, T>>();
        for (const [sourceProxy, modifier] of action.gameProxy.getPowers(ActionModifier<WithPowers, T>)) {
            const instance = new modifier(sourceProxy.original, action, activator);
            if (action instanceof instance.modifiedAction && instance.canUse()) instances.add(instance);
        }

        return instances;
    }

    execute() {
        const modifiers = new Set([...this.persistentModifiers, ...this.parameters.modifiers]);
        
        // NOTE: For ignore loops, all powers in the loop are ignored.
        const ignore = new Set<ActionModifier<WithPowers, T>>();
        for (const modifier of modifiers) for (const toIgnore of modifier.applyImmediately(modifiers)) ignore.add(toIgnore);
        for (const modifier of ignore) modifiers.delete(modifier);

        if (!new ApplyModifiersEffect(this.action, modifiers).do()) return;
        
        if (this.next instanceof ModifiableAction)
            this.next.doNextWithoutModifiers();
        else
            this.next.doNext();
    }
}

export abstract class ModifiableAction extends OathAction {
    modifiers: ActionModifier<WithPowers, ModifiableAction>[] = [];
    maskProxyManager: MaskProxyManager;
    gameProxy: OathGame;            // Effects and powers are allowed to modify the proxies to "lie" to the action
    playerProxy: OathPlayer;        // This is a simple reference for simplicity

    constructor(player: OathPlayer) {
        super(player);
        this.maskProxyManager = new MaskProxyManager();
        this.gameProxy = this.maskProxyManager.get(player.game);
        this.playerProxy = this.maskProxyManager.get(player);
    }

    doNext(): void {
        new ChooseModifiers(this).doNext();
    }

    doNextWithoutModifiers(): void {
        super.doNext();
    }

    start(): boolean {
        for (const modifier of this.modifiers) modifier.applyAtStart();
        return super.start();
    }

    execute() {
        for (const modifier of this.modifiers) modifier.applyBefore();
        new ResolveCallbackAction(this.player, () => this.modifiedExecution()).doNext();  // This allows actions to be slotted before the actual resolution of the action
        for (const modifier of this.modifiers) modifier.applyAfter();
        new ResolveCallbackAction(this.player, () => { for (const modifier of this.modifiers) modifier.applyAtEnd(); }).doNext();
    }

    abstract modifiedExecution(): void;

    serialize(): Record<string, any> {
        const obj = super.serialize();
        obj.modifiers = this.modifiers.map(e => e.serialize());
        return obj;
    }
}

export abstract class MajorAction extends ModifiableAction {
    readonly autocompleteSelects: boolean = false;

    _supplyCost: number;            // Set those if you're modifying the action before its start
    _supplyCostModifier = 0;
    _noSupplyCost: boolean = false;

    supplyCost: number              // You may set the Supply cost if the effect replaces it. Multiple instances will just be tie-broken with timestamps
    supplyCostModifier: number;     // Use this for linear modifications to the Supply cost
    noSupplyCost: boolean;
    get actualSupplyCost() { return this.noSupplyCost ? 0 : this.supplyCost + this.supplyCostModifier; }

    start(): boolean {
        this.supplyCost = this._supplyCost;
        this.supplyCostModifier = this._supplyCostModifier;
        this.noSupplyCost = this._noSupplyCost;
        return super.start();
    }

    modifiedExecution() {
        if (!new PaySupplyEffect(this.player, this.actualSupplyCost).do())
            throw new InvalidActionResolution(`Cannot pay Supply cost (${this.actualSupplyCost}).`);
    }
}


////////////////////////////////////////////
//                 SETUP                  //
////////////////////////////////////////////
export class SetupChooseAction extends OathAction {
    readonly selects: { card: SelectNOf<WorldCard> };
    readonly parameters: { card: Denizen[] };
    readonly message = "Choose a card to start with";

    cards: WorldCard[];

    constructor(player: OathPlayer, cards: Iterable<WorldCard>) {
        super(player);
        this.cards = [...cards];
    }

    start(): boolean {
        this.selects.card = new SelectNOf("Card", this.cards.map(e => [e.name, e]), 1);
        return super.start();
    }

    execute(): void {
        const card = this.parameters.card[0];
        if (!card) return;
        new MoveWorldCardToAdvisersEffect(this.game, this.player, card).do();
        new DiscardCardGroupEffect(this.player, this.cards.filter(e => e !== card)).do();
    }
}



////////////////////////////////////////////
//              MAJOR ACTIONS             //
////////////////////////////////////////////
export class MusterAction extends MajorAction {
    readonly selects: { card: SelectNOf<Denizen> };
    readonly parameters: { card: Denizen[] };
    readonly message = "Put a favor on a card to muster";

    _supplyCost = 1;
    cardProxy: Denizen;
    using: OathResourceType = Favor;
    amount = 1;
    getting = 2;

    start() {
        const choices = new Map<string, Denizen>();
        for (const denizenProxy of this.playerProxy.site.denizens)
            if (denizenProxy.suit !== OathSuit.None && denizenProxy.empty) choices.set(denizenProxy.name, denizenProxy);
        this.selects.card = new SelectNOf("Card", choices, 1);
        return super.start();
    }

    execute() {
        this.cardProxy = this.parameters.card[0]!;
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        const cost = new ResourceCost([[this.using, this.amount]]);
        if (!new PayCostToTargetEffect(this.game, this.player, cost, this.cardProxy.original).do())
            throw cost.cannotPayError;

        new ParentToTargetEffect(this.game, this.player, this.playerProxy.leader.original.bag.get(this.getting)).do();
    }
}


export class TradeAction extends MajorAction {
    readonly selects: { card: SelectNOf<Denizen>, forFavor: SelectBoolean };
    readonly parameters: { card: Denizen[], forFavor: boolean[] };
    readonly message = "Put resources on a card to trade";

    _supplyCost = 1;
    cardProxy: Denizen;
    forFavor: boolean;
    paying: ResourceCost;
    getting: Map<OathResourceType, number>;

    start() {
        const choices = new Map<string, Denizen>();
        for (const denizenProxy of this.playerProxy.site.denizens)
            if (denizenProxy.suit !== OathSuit.None && denizenProxy.empty)
                choices.set(denizenProxy.name, denizenProxy);
        this.selects.card = new SelectNOf("Card", choices, 1);
        this.selects.forFavor = new SelectBoolean("Type", ["For favors", "For secrets"]);
        return super.start();
    }

    execute() {
        this.cardProxy = this.parameters.card[0]!;
        this.forFavor = this.parameters.forFavor[0]!;
        this.paying = new ResourceCost([[this.forFavor ? Secret : Favor, this.forFavor ? 1 : 2]]);
        this.getting = new Map([[this.forFavor ? Favor : Secret, this.forFavor ? 1 : 0]]);
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();

        if (!new PayCostToTargetEffect(this.game, this.player, this.paying, this.cardProxy.original).do())
            throw this.paying.cannotPayError;

        const resource = this.forFavor ? Favor : Secret;
        this.getting.set(resource, (this.getting.get(resource) || 0) + this.playerProxy.suitAdviserCount(this.cardProxy.suit));

        const bank = this.gameProxy.favorBank(this.cardProxy.suit)?.original;
        if (bank) new ParentToTargetEffect(this.game, this.player, bank.get(this.getting.get(Favor) || 0)).do();
        new PutResourcesOnTargetEffect(this.game, this.player, Secret, this.getting.get(Secret) || 0).do();
    }
}


export class TravelAction extends MajorAction {
    readonly selects: { site: SelectNOf<Site> };
    readonly parameters: { site: Site[] };
    readonly message: string = "Choose a site to travel to";
    readonly autocompleteSelects: boolean;

    travelling: OathPlayer;
    choosing: OathPlayer;
    siteProxy: Site;
    restriction: (s: Site) => boolean;

    constructor(travelling: OathPlayer, choosing: OathPlayer = travelling, restriction?: (s: Site) => boolean) {
        super(travelling);
        this.autocompleteSelects = !!restriction;
        this.restriction = restriction || ((_: Site) => true);
        this.choosing = choosing;
        this.travelling = travelling;
    }

    start() {
        this.player = this.choosing;
        const choices = new Map<string, Site>();
        for (const siteProxy of this.gameProxy.board.sites())
            if (siteProxy !== this.playerProxy.site && this.restriction(siteProxy))
                choices.set(siteProxy.visualName(this.player), siteProxy);
        this.selects.site = new SelectNOf("Site", choices, 1);
        return super.start();
    }

    execute() {
        this.player = this.travelling;
        this.siteProxy = this.parameters.site[0]!;
        this.supplyCost = this.gameProxy.board.travelCosts.get(this.player.site.region.regionKey)?.get(this.siteProxy.region.regionKey) || 2;
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        new PutPawnAtSiteEffect(this.player, this.siteProxy.original).do();
    }
}


export class RecoverAction extends MajorAction {
    readonly selects: { target: SelectNOf<RecoverActionTarget> };
    readonly parameters: { target: RecoverActionTarget[] };
    readonly message = "Choose a target to recover";
    
    _supplyCost = 1;
    targetProxy: RecoverActionTarget;

    start() {
        const choices = new Map<string, RecoverActionTarget>();
        for (const relicProxy of this.playerProxy.site.relics) if (relicProxy.canRecover(this)) choices.set(relicProxy.visualName(this.player), relicProxy);
        for (const bannerProxy of this.gameProxy.banners.values()) if (bannerProxy.canRecover(this)) choices.set(bannerProxy.name, bannerProxy);
        this.selects.target = new SelectNOf("Target", choices, 1);
        return super.start();
    }

    execute() {
        this.targetProxy = this.parameters.target[0]!;
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        this.targetProxy.original.recover(this.player);
    }
}

export class RecoverBannerPitchAction extends ModifiableAction {
    readonly selects: { amount: SelectNumber };
    readonly parameters: { amount: number[] };
    readonly message = "Put resources onto the banner";

    banner: Banner;
    amount: number;

    constructor(player: OathPlayer, banner: Banner) {
        super(player);
        this.banner = banner;
    }

    start() {
        this.selects.amount = new SelectNumber("Amount", inclusiveRange(this.banner.amount + 1, this.player.byClass(this.banner.resourceType).length));
        return super.start();
    }

    modifiedExecution() {
        this.amount = this.parameters.amount[0]!;
        this.banner.original.finishRecovery(this.player, this.amount);
    }
}


export class SearchAction extends MajorAction {
    readonly selects: { deck: SelectNOf<SearchableDeck> };
    readonly parameters: { deck: SearchableDeck[] };
    readonly message = "Draw 3 cards from a deck";

    deckProxy: SearchableDeck;
    amount = 3;
    fromBottom = false;
    cards: Set<WorldCard>;
    discardOptions = new DiscardOptions(this.player.discard);

    start() {
        const choices = new Map<string, SearchableDeck>();
        choices.set("World Deck", this.gameProxy.worldDeck);
        choices.set(this.playerProxy.site.region.name, this.playerProxy.site.region.discard);
        this.selects.deck = new SelectNOf("Deck", choices, 1);
        return super.start();
    }

    execute() {
        this.deckProxy = this.parameters.deck[0]!;
        this.supplyCost = this.deckProxy.searchCost;
        super.execute();
        new ResolveCallbackAction(this.player, () => { new SearchChooseAction(this.player, this.cards, this.discardOptions).doNext(); }).doNext();
    }

    modifiedExecution() {
        super.modifiedExecution();
        this.cards = new Set(new DrawFromDeckEffect(this.player, this.deckProxy.original, this.amount, this.fromBottom).do());
    }
}

export class SearchChooseAction extends ModifiableAction {
    readonly selects: { cards: SelectNOf<WorldCard> }
    readonly parameters: { cards: WorldCard[] }
    readonly message = "Choose which card(s) to keep";

    cards: Set<WorldCard>;
    playing: WorldCard[];  // For this action, order is important
    playingAmount: number;
    discardOptions: DiscardOptions<OathCard>;

    playActions: SearchPlayOrDiscardAction[] = [];

    constructor(player: OathPlayer, cards: Iterable<WorldCard>, discardOptions?: DiscardOptions<OathCard>, amount: number = 1) {
        super(player);
        this.discardOptions = discardOptions || new DiscardOptions(player.discard);
        this.cards = new Set(cards);
        this.playingAmount = Math.min(amount, this.cards.size);
    }

    start() {
        const cardsChoice = new Map<string, WorldCard>();
        for (const card of this.cards) cardsChoice.set(card.name, card);
        this.selects.cards = new SelectNOf("Card(s)", cardsChoice, 1, this.playingAmount);
        return super.start();
    }

    execute(): void {
        this.playing = this.parameters.cards;
        super.execute();
    }

    modifiedExecution(): void {
        const discarding = new Set(this.cards);
        for (const card of this.playing) discarding.delete(card);
        new SearchDiscardAction(this.player, discarding, Infinity, this.discardOptions).doNext();
        
        this.playActions.length = 0;
        for (const card of this.playing) {
            const playAction = new SearchPlayOrDiscardAction(this.player, card.original, this.discardOptions)
            this.playActions.push(playAction);
            playAction.doNext();
        }
    }
}

export class SearchDiscardAction extends ModifiableAction {
    readonly selects: { cards: SelectNOf<WorldCard> }
    readonly parameters: { cards: WorldCard[] };
    readonly autocompleteSelects = false;
    readonly message = "Choose the order of the discards";

    cards: Set<WorldCard>;
    discarding: WorldCard[];  // For this action, order is important
    amount: number;
    discardOptions: DiscardOptions<OathCard>;

    constructor(player: OathPlayer, cards: Iterable<WorldCard>, amount?: number, discardOptions?: DiscardOptions<OathCard>) {
        super(player);
        this.cards = new Set(cards);
        this.amount = Math.min(this.cards.size, amount || this.cards.size);
        this.discardOptions = discardOptions || new DiscardOptions(player.discard);
    }

    start() {
        const choices = new Map<string, WorldCard>();
        for (const card of this.cards) choices.set(card.name, card);
        this.selects.cards = new SelectNOf("Card(s)", choices, this.amount);
        return super.start();
    }

    execute(): void {
        this.discarding = this.parameters.cards;
        super.execute();
    }

    modifiedExecution(): void {
        for (const card of this.discarding)
            new DiscardCardEffect(this.player, card, this.discardOptions).do();
    }
}

export class SearchPlayOrDiscardAction extends ModifiableAction {
    readonly selects: { choice: SelectNOf<Site | boolean | undefined>}
    readonly parameters: { choice: (Site | boolean | undefined)[] }
    readonly message: string;
    
    cardProxy: WorldCard;
    siteProxy: Site | undefined;
    facedown: boolean;
    discardOptions: DiscardOptions<OathCard>;
    canReplace: boolean;

    constructor(player: OathPlayer, card: WorldCard, discardOptions?: DiscardOptions<OathCard>) {
        super(player);
        this.cardProxy = this.maskProxyManager.get(card);
        this.message = "Play or discard " + this.cardProxy.name;
        this.discardOptions = discardOptions || new DiscardOptions(player.discard);
    }

    start() {
        const sitesChoice = new Map<string, Site | boolean | undefined>();
        sitesChoice.set("Faceup adviser", false);
        sitesChoice.set("Facedown adviser", true);
        sitesChoice.set(this.playerProxy.site.name, this.playerProxy.site);
        sitesChoice.set("Discard", undefined);
        this.selects.choice = new SelectNOf("Choice", sitesChoice, 1);

        return super.start();
    }

    execute() {
        const choice = this.parameters.choice[0]!;
        if (choice === undefined) {
            new DiscardCardEffect(this.player, this.cardProxy, this.discardOptions).do();
            return;
        }

        this.siteProxy = typeof choice === "boolean" ? undefined : choice;
        this.facedown = typeof choice === "boolean" ? choice : false;
        this.canReplace = this.siteProxy === undefined;
        super.execute();
    }

    static getCapacityInformation(maskProxyManager: MaskProxyManager, playerProxy: OathPlayer, siteProxy?: Site, playingProxy?: WorldCard): [number, WorldCard[], boolean] {
        const capacityModifiers: CapacityModifier<WorldCard>[] = [];
        for (const [sourceProxy, modifier] of playerProxy.game.getPowers(CapacityModifier)) {
            const instance = new modifier(sourceProxy.original, maskProxyManager);
            if (instance.canUse(playerProxy, siteProxy)) capacityModifiers.push(instance);
        }

        if (playingProxy && !playingProxy.facedown) {
            for (const modifier of playingProxy.powers) {
                if (isExtended(modifier, CapacityModifier)) {
                    const instance = new modifier(playingProxy.original, maskProxyManager);
                    capacityModifiers.push(instance);  // Always assume the card influences the capacity
                }
            }
        }

        let capacity = siteProxy ? siteProxy.capacity : 3;
        let ignoresCapacity = false;
        let takesNoSpaceProxies = new Set<WorldCard>();
        const targetProxy = siteProxy ? siteProxy.denizens : playerProxy.advisers;

        for (const capacityModifier of capacityModifiers) {
            const [cap, noSpaceProxy] = capacityModifier.updateCapacityInformation(targetProxy);
            capacity = Math.min(capacity, cap);
            for (const cardProxy of noSpaceProxy) takesNoSpaceProxies.add(cardProxy);
            if (playingProxy) ignoresCapacity ||= capacityModifier.ignoreCapacity(playingProxy);
        }

        return [capacity, [...targetProxy].filter(e => !takesNoSpaceProxies.has(e)), ignoresCapacity];
    }

    modifiedExecution() {
        this.cardProxy.facedown = this.facedown;  // Editing the copy to reflect the new state
        const [capacity, takesSpaceInTargetProxies, ignoresCapacity] = SearchPlayOrDiscardAction.getCapacityInformation(this.maskProxyManager, this.playerProxy, this.siteProxy, this.cardProxy);

        const excess = Math.max(0, takesSpaceInTargetProxies.length - capacity + 1);  // +1 because we are playing a card there
        const discardable = takesSpaceInTargetProxies.filter(e => !(e instanceof Denizen && e.activelyLocked)).map(e => e.original);

        if (!ignoresCapacity && excess)
            if (!this.canReplace || excess > discardable.length)
                throw new InvalidActionResolution("Target is full and cards there cannot be replaced");
            else
                new SearchDiscardAction(this.player, discardable, excess, this.discardOptions).doNext();
        
        new PlayWorldCardEffect(this.player, this.cardProxy.original, this.facedown, this.siteProxy?.original).doNext();
        new CheckCapacityEffect(this.player, [this.siteProxy?.original || this.player], this.discardOptions).doNext();
    }
}

export class MayDiscardACardAction extends OathAction {
    readonly selects: { card: SelectNOf<Denizen> };
    readonly parameters: { card: Denizen[] };
    readonly message = "You may discard a card";

    cards: Set<Denizen>;
    discardOptions: DiscardOptions<OathCard>;

    constructor(player: OathPlayer, discardOptions?: DiscardOptions<OathCard>, cards?: Iterable<Denizen>) {
        super(player);
        this.discardOptions = discardOptions || new DiscardOptions(player.discard);
        if (cards) {
            this.cards = new Set(cards);
        } else {
            this.cards = new Set();
            for (const site of this.player.site.region.sites)
                for (const denizen of site.denizens)
                    if (!denizen.activelyLocked) this.cards.add(denizen);
        }
    }

    start() {
        const choices = new Map<string, Denizen>();
        for (const card of this.cards) choices.set(card.visualName(this.player), card);
        this.selects.card = new SelectNOf("Card", choices, 0, 1);
        return super.start();
    }

    execute(): void {
        const card = this.parameters.card[0]!;
        if (!card) return;
        new DiscardCardEffect(this.player, card, this.discardOptions).do();
    }
}


export class CampaignAction extends MajorAction {
    readonly selects: { defender: SelectNOf<OathPlayer | undefined> };
    readonly parameters: { defender: (OathPlayer | undefined)[] };
    readonly message = "Choose a defender";
    
    _supplyCost = 2;
    defenderProxy: OathPlayer | undefined;

    start() {
        const choices = new Map<string, OathPlayer | undefined>();
        for (const playerProxy of Object.values(this.gameProxy.players)) choices.set(playerProxy.name, playerProxy);
        if (this.playerProxy.site.ruler === undefined) choices.set("Bandits", undefined);
        this.selects.defender = new SelectNOf("Defender", choices, 1);
        return super.start();
    }

    execute() {
        this.defenderProxy = this.parameters.defender[0]!;
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        const next = new CampaignAttackAction(this.player, this.defenderProxy?.original);
        if (this.defenderProxy?.isImperial) new CampaignJoinDefenderAlliesEffect(next.campaignResult, this.gameProxy.chancellor.original).do();
        next.doNext();
    }
}

export class CampaignAttackAction extends ModifiableAction {
    readonly selects: { targets: SelectNOf<CampaignActionTarget>, pool: SelectNumber };
    readonly parameters: { targets: CampaignActionTarget[], pool: number[] };
    readonly next: CampaignDefenseAction;
    readonly message = "Choose targets and attack pool";

    defender: OathPlayer | undefined;
    defenderProxy: OathPlayer | undefined;

    constructor(player: OathPlayer, defender: OathPlayer | undefined) {
        super(player);
        this.next = new CampaignDefenseAction(defender || player, player);
        this.campaignResult.attacker = player;
        this.campaignResult.defender = defender;
        this.defender = defender;
        this.defenderProxy = this.maskProxyManager.get(defender);
        this.campaignResult.checkForImperialInfighting(this.maskProxyManager);
    }

    doNext(): void {
        super.doNext();
        this.campaignResult.params.save();
    }

    start() {
        this.campaignResult.params.restore();
        const choices = new Map<string, CampaignActionTarget>();
        for (const siteProxy of this.gameProxy.board.sites()) { 
            if (!siteProxy.facedown && siteProxy.ruler === this.defenderProxy?.leader) {
                if (this.playerProxy.site === siteProxy) {
                    this.campaignResult.params.targets.add(siteProxy.original);
                } else {
                    choices.set(siteProxy.visualName(this.player), siteProxy);
                }
            }
        }

        if (this.defenderProxy && this.defenderProxy.site === this.playerProxy.site) {
            choices.set("Banish " + this.defenderProxy.name, this.defenderProxy);
            for (const relicProxy of this.defenderProxy.relics) choices.set(relicProxy.visualName(this.player), relicProxy)
            for (const bannerProxy of this.defenderProxy.banners) choices.set(bannerProxy.name, bannerProxy);
        }
        this.selects.targets = new SelectNOf("Target(s)", choices, 1 - this.campaignResult.params.targets.size, choices.size);

        this.selects.pool = new SelectNumber("Attack pool", inclusiveRange(this.playerProxy.warbands.length));
        
        return super.start();
    }

    get campaignResult() { return this.next.campaignResult; }
    get campaignResultProxy() { return this.next.campaignResultProxy; }

    execute() {
        for (const targetProxy of this.parameters.targets) this.campaignResult.params.targets.add(targetProxy.original);
        this.campaignResult.params.atkPool = this.parameters.pool[0]!;
        this.campaignResult.params.defPool = 0;

        const allyProxiesCandidates = new Set<OathPlayer>();
        for (const target of this.campaignResult.params.targets) {
            const targetProxy = this.maskProxyManager.get(target);
            this.campaignResult.params.defPool += targetProxy.defense;
            
            for (const playerProxy of Object.values(this.gameProxy.players)) {
                const siteProxy = targetProxy instanceof Site ? targetProxy : this.playerProxy.site;
                if (playerProxy.site === siteProxy)
                    allyProxiesCandidates.add(playerProxy);
            }
        }
        
        if (this.campaignResult.defender && this.maskProxyManager.get(this.campaignResult.defender) === this.gameProxy.oathkeeper)
            this.campaignResult.params.defPool += this.gameProxy.isUsurper ? 2 : 1;

        for (const allyProxy of allyProxiesCandidates) {
            const ally = allyProxy.original;
            console.log("Trying allying with", ally.name);
            if (!this.campaignResult.defenderAllies.has(ally) && allyProxy.leader === this.defenderProxy?.leader)
                new MakeDecisionAction(ally, "Join as an Imperial Ally?", () => new CampaignJoinDefenderAlliesEffect(this.campaignResult, ally).do()).doNext();
        }

        super.execute();
    }

    modifiedExecution() {
        this.campaignResult.params.defForce = new Set();
        for (const target of this.campaignResult.params.targets) {
            const force = target.force;
            if (force) this.campaignResult.params.defForce.add(force);
        }

        for (const ally of this.campaignResult.defenderAllies) {
            if (ally.site === this.player.site) {
                this.campaignResult.params.defForce.add(ally);
                continue;
            }
            
            for (const target of this.campaignResult.params.targets) {
                if (target instanceof Site && ally.site === target) {
                    this.campaignResult.params.defForce.add(ally);
                    continue;
                }
            }
        }
        
        this.campaignResult.params.atkForce = new Set([this.player]);

        if (this.campaignResult.defender) {
            this.next.doNext();
            return;
        }

        // Bandits use all battle plans that are free
        const modifiers: ActionModifier<WithPowers, CampaignAttackAction | CampaignDefenseAction>[] = [];
        for (const modifier of ChooseModifiers.gatherModifiers(this, this.player)) {
            if (modifier.mustUse || modifier.cost.free)
                modifiers.push(modifier);
        };

        // If any powers cost something, then the attacker pays. Shouldn't happen though
        if (new ApplyModifiersEffect(this.next, modifiers).do())
            this.next.doNextWithoutModifiers();
    }
}

export class CampaignDefenseAction extends ModifiableAction {
    readonly next: CampaignEndAction;
    readonly message = "";

    constructor(player: OathPlayer, attacker: OathPlayer) {
        super(player);
        this.next = new CampaignEndAction(attacker);
        this.campaignResult.checkForImperialInfighting(this.maskProxyManager);
    }

    get campaignResult() { return this.next.campaignResult; }
    get campaignResultProxy() { return this.next.campaignResultProxy; }

    doNext(): void {
        let next = new ChooseModifiers(this);
        for (const ally of this.campaignResult.defenderAllies) 
            if (ally !== this.player)
                next = new ChooseModifiers(next, ally);
        next.doNext();
        this.campaignResult.params.save();
    }

    start(): boolean {
        this.campaignResult.params.restore();
        return super.start();
    }

    execute() {
        super.execute();
        new CampaignResolveSuccessfulAndSkullsEffect(this).doNext();
        this.next.doNext();
    }

    modifiedExecution() {
        this.campaignResult.resolve();
    }
}

export class CampaignResultParameters extends DataObject {
    targets = new Set<CampaignActionTarget>();
    atkPool: number;
    defPool: number;
    atkForce: Set<ResourcesAndWarbands>;  // The force is all your warbands on the objects in this array
    defForce: Set<ResourcesAndWarbands>;
    endCallbacks: (() => void)[] = [];
    
    atkRoll = new RollResult();
    defRoll = new RollResult();

    ignoreKilling: boolean = false;
    attackerKillsNoWarbands: boolean = false;
    defenderKillsNoWarbands: boolean = false;
    attackerKillsEntireForce: boolean = false;
    defenderKillsEntireForce: boolean = false;
    sacrificeValue: number = 1;
}
export class CampaignResult {
    game: OathGame;
    attacker: OathPlayer;
    defender: OathPlayer | undefined;
    defenderAllies = new Set<OathPlayer>();
    
    params = new CampaignResultParameters();
    successful: boolean;
    attackerLoss: number = 0;
    defenderLoss: number = 0;
    
    constructor(game: OathGame) {
        this.game = game;
    }

    get winner() { return this.successful ? this.attacker : this.defender; }
    get loser() { return this.successful ? this.defender : this.attacker; }
    get loserTotalForce() { return this.successful ? this.totalDefForce : this.totalAtkForce; }
    get loserKillsNoWarbands() { return this.successful ? this.params.defenderKillsNoWarbands : this.params.attackerKillsNoWarbands; }
    get loserKillsEntireForce() { return this.successful ? this.params.defenderKillsEntireForce : this.params.attackerKillsEntireForce; }
    get loserLoss() { return this.successful ? this.defenderLoss : this.attackerLoss; }
    get loserKills() { return this.successful ? this.defenderKills : this.attackerKills; }

    get totalAtkForce() { return [...this.params.atkForce].reduce((a, e) => a + e.getWarbandsAmount(this.attacker.leader.original.id), 0); }
    get totalDefForce() { return [...this.params.defForce].reduce((a, e) => a + e.getWarbandsAmount(this.defender?.leader.original.id), 0); }

    get atk() { return this.params.atkRoll.value; }
    get def() { return this.params.defRoll.value + this.totalDefForce; }

    get requiredSacrifice() {
        const diff = this.def - this.atk + 1;
        return this.params.sacrificeValue === 0 ? diff > 0 ? Infinity : 0 : Math.ceil(diff / this.params.sacrificeValue);
    }
    get couldSacrifice() { return this.requiredSacrifice > 0 && this.requiredSacrifice <= this.totalAtkForce; }

    atEnd(callback: () => void) {
        this.params.endCallbacks.push(callback);
    }

    discardAtEnd(denizen: Denizen) {
        this.atEnd(() => new DiscardCardEffect(denizen.ruler || this.attacker, denizen).do());
    }

    onSuccessful(successful: boolean, callback: () => void) {
        this.atEnd(() => { if (this.successful === successful) callback(); });
    }

    checkForImperialInfighting(maskProxyManager: MaskProxyManager) {
        if (maskProxyManager.get(this.defender)?.isImperial) {
            if (this.attacker instanceof Exile)  // Citizen attacks: revoke Citizen priviledges
                maskProxyManager.get(this.attacker).isCitizen = false;
            else if (this.defender instanceof Exile)  // Chancellor attacks: revoke defender's Citizen priviledges
                maskProxyManager.get(this.defender).isCitizen = false;
        }
    }

    rollAttack() {
        this.params.atkRoll = new RollDiceEffect(this.game, this.attacker, AttackDie, this.params.atkPool, this.params.atkRoll).do();
    }

    rollDefense() {
        const pool = this.params.defPool + (this.params.atkPool < 0 ? -this.params.atkPool : 0);
        this.params.defRoll = new RollDiceEffect(this.game, this.defender, DefenseDie, pool, this.params.defRoll).do();
    }
    
    attackerKills(amount: number) {
        if (amount) new CampaignKillWarbandsInForceAction(this, true, amount).doNext();
    }

    defenderKills(amount: number) {
        if (!this.defender) return;
        if (amount) new CampaignKillWarbandsInForceAction(this, false, amount).doNext();
    }

    resolve() {
        this.rollDefense();
        this.rollAttack();
    }
}

export class CampaignEndAction extends ModifiableAction {
    readonly selects: { doSacrifice: SelectBoolean };
    readonly parameters: { doSacrifice: boolean[] };
    readonly message = "Sacrifice is needed to win";
    
    campaignResult = new CampaignResult(this.game);
    campaignResultProxy = this.maskProxyManager.get(this.campaignResult);
    doSacrifice: boolean;

    constructor(player: OathPlayer) {
        super(player);
        this.campaignResult.checkForImperialInfighting(this.maskProxyManager);
    }

    doNext(): void {
        super.doNext();
        this.campaignResult.params.save();
    }

    start() {
        this.campaignResult.params.restore();
        if (this.campaignResultProxy.couldSacrifice) {
            this.selects.doSacrifice = new SelectBoolean("Decision", [`Sacrifice ${this.campaignResultProxy.requiredSacrifice} warbands`, "Abandon"]);
        } else {
            this.parameters.doSacrifice = [false];
        }
        
        return super.start();
    }

    execute() {
        this.doSacrifice = this.parameters.doSacrifice[0]!;
        super.execute();
    }

    modifiedExecution() {
        if (this.doSacrifice) {
            this.campaignResult.attackerKills(this.campaignResultProxy.requiredSacrifice);
            this.campaignResult.successful = true;
        }

        if (this.campaignResult.loser && !this.campaignResult.params.ignoreKilling && !this.campaignResult.loserKillsNoWarbands)
            this.campaignResult.loserKills(Math.floor(this.campaignResultProxy.loserTotalForce / (this.campaignResult.loserKillsEntireForce ? 1 : 2)));

        if (this.campaignResult.successful)
            for (const target of this.campaignResult.params.targets) target.seize(this.campaignResult.attacker);

        for (const func of this.campaignResult.params.endCallbacks)
            func();

        console.log(this.campaignResult);
    }
}

export class CampaignKillWarbandsInForceAction extends OathAction {
    selects: Record<string, SelectNumber> = {};
    parameters: Record<string, number[]> = {};
    readonly message;

    result: CampaignResult;
    owner: OathPlayer | undefined;
    force: Set<ResourcesAndWarbands>;
    attacker: boolean;
    amount: number;

    constructor(result: CampaignResult, attacker: boolean, amount: number) {
        super(attacker ? result.attacker.leader : result.defender?.leader || result.attacker.leader);
        this.message = `Kill ${amount} warbands`;
        this.result = result;
        this.owner = attacker ? result.attacker.leader : result.defender?.leader;
        this.force = attacker ? result.params.atkForce : result.params.defForce;
        this.attacker = attacker;
        this.amount = Math.min(attacker ? result.totalAtkForce : result.totalDefForce, amount);
    }

    start(): boolean {
        if (this.owner) {
            const sources: [string, number][] = [...this.force].map(e => [e.name, e.getWarbandsAmount(this.owner?.id)]);
            for (const [key, warbands] of sources) {
                const min = Math.min(warbands, Math.max(0, this.amount - sources.filter(([k, _]) => k !== key).reduce((a, [_, v]) => a + Math.min(v, this.amount), 0)));
                const max = Math.min(warbands, this.amount);
                this.selects[key] = new SelectNumber(key, inclusiveRange(min, max));
            }
        }
        return super.start();
    }

    execute(): void {
        if (!this.owner) return;

        const total = Object.values(this.parameters).reduce((a, e) => a + e[0]!, 0);
        if (total !== this.amount)
            throw new InvalidActionResolution("Invalid total amount of warbands");
        
        for (const source of this.force) {
            const warbands = source.getWarbands(this.owner.leader.id, this.parameters[source.name]![0]);
            new ParentToTargetEffect(this.game, this.player, warbands, this.owner.leader.bag).do();
            if (this.attacker)
                this.result.attackerLoss += warbands.length;
            else
                this.result.defenderLoss += warbands.length;
        }
    }
}

export class CampaignBanishPlayerAction extends TravelAction {
    readonly message: string;
    _noSupplyCost = true;

    constructor(player: OathPlayer, banished: OathPlayer) {
        super(banished, player);
        this.message = "Choose where to banish " + banished.name;
    }
}

export class CampaignSeizeSiteAction extends OathAction {
    readonly selects: { amount: SelectNumber };
    readonly parameters: { amount: number[] };
    readonly message: string;
    readonly autocompleteSelects = false;
    
    site: Site;

    constructor(player: OathPlayer, site: Site) {
        super(player);
        this.site = site;
        this.message = "Choose how many warbands to move to " + site.visualName(player);
    }

    start() {
        this.selects.amount = new SelectNumber("Amount", inclusiveRange(this.player.getWarbandsAmount(this.player.leader.original.id)));
        return super.start();
    }

    execute() {
        new MoveOwnWarbandsEffect(this.player.leader, this.player, this.site, this.parameters.amount[0]!).do();
    }
}


export class WakeAction extends ModifiableAction {
    readonly message = "";

    modifiedExecution(): void {
        if (this.gameProxy.oathkeeper === this.playerProxy && !this.playerProxy.isImperial)
            if (this.gameProxy.isUsurper)
                return new WinGameEffect(this.player).do();
            else
                new SetUsurperEffect(this.game, true).do();
        
        if (this.playerProxy instanceof Exile && this.playerProxy.vision && this.gameProxy.worldDeck.visionsDrawn >= 3) {
            const candidates = this.playerProxy.vision.oath.getOathkeeperCandidates();
            if (candidates.size === 1 && candidates.has(this.playerProxy))
                return new WinGameEffect(this.player).do();
        }
        
        new ChangePhaseEffect(this.game, OathPhase.Act).doNext();
    }
}


export class RestAction extends ModifiableAction {
    readonly message = "";

    execute(): void {
        super.execute();
        new NextTurnEffect(this.game).doNext();
    }

    modifiedExecution(): void {
        new ChangePhaseEffect(this.game, OathPhase.Rest).do();
        this.player.rest();
    }
}


////////////////////////////////////////////
//              MINOR ACTIONS             //
////////////////////////////////////////////
export class UsePowerAction extends ModifiableAction {
    readonly selects: { power: SelectNOf<ActivePower<OwnableCard>> }
    readonly parameters: { power: ActivePower<OwnableCard>[] };
    readonly autocompleteSelects = false;
    readonly message = "Choose a power to use";

    power: ActivePower<OwnableCard>;

    start() {
        const choices = new Map<string, ActivePower<OwnableCard>>();
        for (const [sourceProxy, power] of this.gameProxy.getPowers(ActivePower<OwnableCard>)) {
            const instance = new power(sourceProxy.original, this);
            if (instance.canUse()) choices.set(instance.name, instance);
        }
        this.selects.power = new SelectNOf("Power", choices, 1);
        return super.start();
    }

    execute(): void {
        this.power = this.parameters.power[0]!;
        super.execute();
    }

    modifiedExecution(): void {
        if (!this.power.payCost(this.player))
            throw this.power.cost.cannotPayError;

        this.power.usePower();
    }
}


export class PlayFacedownAdviserAction extends ModifiableAction {
    readonly selects: { cards: SelectNOf<WorldCard> }
    readonly parameters: { cards: WorldCard[] }
    readonly message = "Choose an adviser to play";

    cardProxies: Set<WorldCard>;
    playing: WorldCard;

    start() {
        this.cardProxies = new Set([...this.playerProxy.advisers].filter(e => e.facedown));
        const cardsChoice = new Map<string, WorldCard>();
        for (const cardProxy of this.cardProxies) cardsChoice.set(cardProxy.name, cardProxy);
        this.selects.cards = new SelectNOf("Adviser", cardsChoice, 1);
        return super.start();
    }

    execute(): void {
        this.playing = this.parameters.cards[0]!.original;
        super.execute();
    }

    modifiedExecution(): void {
        new SearchPlayOrDiscardAction(this.player, this.playing).doNext();
    }
}


export class MoveWarbandsAction extends ModifiableAction {
    readonly selects: { target: SelectNOf<Site | OathPlayer>, amount: SelectNumber, giving: SelectBoolean };
    readonly parameters: { target: (Site | OathPlayer)[], amount: number[], giving: boolean[] };
    readonly message = "Give or take warbands";

    targetProxy: Site | OathPlayer;
    amount: number;
    giving: boolean;

    start(): boolean {
        const choices = new Map<string, Site | OathPlayer>();
        const siteProxy = this.playerProxy.site;
        let max = this.playerProxy.getWarbandsAmount(this.playerProxy.leader.original.id);
        if (this.playerProxy.isImperial) {
            for (const playerProxy of Object.values(this.gameProxy.players)) {
                if (playerProxy !== this.playerProxy && playerProxy.isImperial && playerProxy.site === siteProxy) {
                    choices.set(playerProxy.name, playerProxy);
                    max = Math.max(max, playerProxy.getWarbandsAmount(playerProxy.leader.original.id));
                }
            }
        }
        if (siteProxy.getWarbandsAmount(this.playerProxy.leader.original.id) > 0) {
            choices.set(siteProxy.name, siteProxy);
            max = Math.max(max, siteProxy.getWarbandsAmount(this.playerProxy.leader.original.id) - 1);
        }
        this.selects.target = new SelectNOf("Target", choices, 1);

        this.selects.amount = new SelectNumber("Amount", inclusiveRange(max));

        this.selects.giving = new SelectBoolean("Direction", ["Giving", "Taking"]);

        return super.start();
    }

    execute(): void {
        this.targetProxy = this.parameters.target[0]!;
        this.amount = this.parameters.amount[0]!;
        this.giving = this.parameters.giving[0]!;
        super.execute();
    }

    modifiedExecution(): void {
        const from = this.giving ? this.player : this.targetProxy.original;
        const to = this.giving ? this.targetProxy.original : this.player;

        if (from instanceof Site && from.getWarbandsAmount(this.playerProxy.leader.original.id) - this.amount < 1)
            throw new InvalidActionResolution("Cannot take the last warband off a site.");

        const effect = new MoveOwnWarbandsEffect(this.playerProxy.leader.original, from, to, this.amount);
        if (this.targetProxy instanceof OathPlayer || this.targetProxy.ruler && this.targetProxy.ruler !== this.playerProxy) {
            const askTo = this.targetProxy instanceof OathPlayer ? this.targetProxy : this.targetProxy.ruler;
            if (askTo) new MakeDecisionAction(askTo.original, `Allow ${this.amount} warbands to move from ${from.name} to ${to.name}?`, () => effect.do()).doNext();
        } else {
            effect.do();
        }
    }
}


////////////////////////////////////////////
//              OTHER ACTIONS             //
////////////////////////////////////////////
export class ResolveEffectAction extends OathAction {
    readonly message = "";

    effect: OathEffect<any>;

    constructor(player: OathPlayer, effect: OathEffect<any>) {
        super(player);
        this.effect = effect;
    }

    execute(): void {
        this.effect.do();
    }
}

export class ResolveCallbackAction extends OathAction {
    readonly message = "";

    callback: () => void;

    constructor(player: OathPlayer, callback: () => void) {
        super(player);
        this.callback = callback;
    }

    execute(): void {
        this.callback();
    }
}

export class MakeDecisionAction extends OathAction {
    readonly selects: { allow: SelectBoolean };
    readonly parameters: { allow: boolean[] };
    readonly message;

    callback: () => void;
    negativeCallback?: () => void;
    options: [string, string];

    constructor(player: OathPlayer, message: string, callback: () => void, negativeCallback?: () => void, options: [string, string] = ["Yes", "No"]) {
        super(player);
        this.callback = callback;
        this.negativeCallback = negativeCallback;
        this.message = message;
        this.options = options;
    }

    start(): boolean {
        this.selects.allow = new SelectBoolean("Decision", this.options);
        return super.start();
    }

    execute(): void {
        if (this.parameters.allow[0])
            this.callback();
        else if (this.negativeCallback)
            this.negativeCallback();
    }
}

export class KillWarbandsOnTargetAction extends OathAction {
    selects: Record<string, SelectNumber> = {};
    parameters: Record<string, number[]> = {};
    readonly message;

    target: ResourcesAndWarbands;
    amount: number;

    constructor(player: OathPlayer, target: ResourcesAndWarbands, amount: number) {
        super(player);
        this.message = `Kill ${amount} warbands`;
        this.target = target;
        this.amount = amount;
    }

    start(): boolean {
        const owners: [string, number][] = this.game.players.map(e => [e.name, this.target.getWarbands(e.id).length]);
        for (const [key, warbands] of owners) {
            if (warbands === 0) continue;
            const min = Math.min(warbands, Math.max(0, this.amount - owners.filter(([k, _]) => k !== key).reduce((a, [_, v]) => a + Math.min(v, this.amount), 0)));
            const max = Math.min(warbands, this.amount);
            this.selects[key] = new SelectNumber(key.toString(), inclusiveRange(min, max));
        }
        return super.start();
    }

    execute(): void {
        const total = Object.values(this.parameters).reduce((a, e) => a + e[0]!, 0);
        if (total !== this.amount)
            throw new InvalidActionResolution("Invalid total amount of warbands");
        
        for (const owner of this.game.players)
            if (this.parameters[owner.name])
                new ParentToTargetEffect(this.game, this.player, this.target.getWarbands(owner.id, this.parameters[owner.name]![0]), owner.leader.bag).do();
    }
}


export class ChooseNumberAction extends OathAction {
    readonly selects: { value: SelectNumber };
    readonly parameters: { value: number[] };
    readonly message: string;

    values: Set<number>;
    callback: (value: number) => void;

    constructor(player: OathPlayer, message: string, values: Iterable<number>, callback: (value: number) => void) {
        super(player);
        this.message = message;
        this.callback = callback;
        this.values = new Set(values);
    }

    start() {
        this.selects.value = new SelectNumber("Number", this.values);
        return super.start();
    }

    execute(): void {
        this.callback(this.parameters.value[0] ?? 0)
    }
}

export class TakeReliquaryRelicAction extends ChooseNumberAction {
    constructor(player: OathPlayer) {
        super(
            player, "Take a Reliquary relic",
            player.game.chancellor.reliquary.children.filter(e => e.children[0]).map((_, i) => i),
            (index: number) => {
                new TakeReliquaryRelicEffect(player, index).do();
            }
        )
    }
}


export class ChooseResourceToTakeAction extends OathAction {
    readonly selects: { resource: SelectNOf<OathResource> };
    readonly parameters: { resource: OathResource[] };
    readonly message = "Take a resource";

    source: ResourcesAndWarbands;

    constructor(player: OathPlayer, source: ResourcesAndWarbands) {
        super(player);
        this.source = source;
    }

    start() {
        const choices = new Map<string, OathResource>();
        for (const resource of this.source.resources)
            choices.set(resource.constructor.name, resource);
        this.selects.resource = new SelectNOf("Resource", choices, 1);
        return super.start();
    }

    execute(): void {
        const resource = this.parameters.resource[0]!;
        if (resource === undefined) return;
        new ParentToTargetEffect(this.game, this.player, [resource]).do();   
    }
}


export class ChooseRegionAction extends OathAction {
    readonly selects: { region: SelectNOf<Region | undefined> };
    readonly parameters: { region: (Region | undefined)[] };
    readonly message: string;

    regions: Set<Region> | undefined;
    none: string | undefined;
    callback: (region: Region | undefined) => void;

    constructor(player: OathPlayer, message: string, callback: (region: Region | undefined) => void, regions?: Iterable<Region>, none?: string) {
        super(player);
        this.message = message;
        this.callback = callback;
        this.regions = regions && new Set(regions);
        this.none = none;
    }

    start() {
        if (!this.regions) this.regions = new Set(Object.values(this.game.board.children).filter(e => e !== this.player.site.region));

        const choices = new Map<string, Region | undefined>();
        if (this.none) choices.set(this.none, undefined);
        for (const region of this.regions) choices.set(region.name, region);
        this.selects.region = new SelectNOf("Region", choices, 1);

        return super.start();
    }

    execute(): void {
        this.callback(this.parameters.region[0]!);
    }
}


export abstract class ChooseTsAction<T> extends OathAction {
    readonly selects: Record<string, SelectNOf<T>>;
    readonly parameters: Record<string, T[]>;
    readonly message: string;

    choices: Set<T>[] | undefined;
    ranges: [number, number?][]
    callback: (...choices: T[][]) => void;

    constructor(player: OathPlayer, message: string, callback: (...choices: T[][]) => void, choices?: Iterable<T>[], ranges: [number, number?][] = []) {
        super(player);
        this.message = message;
        this.callback = callback;
        this.ranges = ranges;
        this.choices = choices && choices.map(e => new Set(e));
    }

    rangeMin(i: number) { return this.ranges[i] ? this.ranges[i][0] : 1; }
    rangeMax(i: number) { return this.ranges[i] ? this.ranges[i][1] === undefined ? this.rangeMin(i): this.ranges[i][1] : this.rangeMin(i); }

    execute(): void {
        this.callback(...Object.values(this.parameters));
    }
}


export class ChooseSuitsAction extends ChooseTsAction<OathSuit> {
    start() {
        if (!this.choices) this.choices = [new Set(ALL_OATH_SUITS)];

        for (const [i, group] of this.choices.entries()) {
            const choices = new Map<string, OathSuit>();
            for (const suit of group)
                choices.set(OathSuitName[suit], suit);
            this.selects["choices" + i] = new SelectNOf("Suit", choices, this.rangeMin(i), this.rangeMax(i));
        }

        return super.start();
    }
}

export class TakeFavorFromBankAction extends ChooseSuitsAction {
    constructor(player: OathPlayer, amount: number, suits?: Iterable<OathSuit>) {
        super(
            player, "Take " + amount + " from a favor bank", 
            (suits: OathSuit[]) => {
                if (!suits[0]) return;
                const resources = this.game.favorBank(suits[0])?.get(amount);
                if (resources) new ParentToTargetEffect(this.game, this.player, resources).do();
            },
            suits && [suits]
        );
    }
}

export class PeoplesFavorWakeAction extends ChooseSuitsAction {
    banner: PeoplesFavor;

    constructor(player: OathPlayer, banner: PeoplesFavor) {
        super(player, "Return favor (choose none to put favor)", (suits: OathSuit[]) => { this.putOrReturnFavor(suits[0]) }, [], [[0, 1]]);
        this.banner = banner;
    }

    start() {
        if (this.banner.amount > 1)
            this.choices = [new Set(minInGroup(this.game.byClass(FavorBank).entries(), ([_, v]) => v.amount).map(([k, _]) => k))];
        else
            this.choices = [new Set()];
        
        return super.start();
    }

    putOrReturnFavor(suit: OathSuit | undefined): void {
        const bank = suit !== undefined ? this.game.favorBank(suit) : undefined;
        new MoveResourcesToTargetEffect(this.game, this.player, Favor, 1, bank ?? this.player, this.banner).do();

        if (this.banner.amount >= 6)
            new SetPeoplesFavorMobState(this.game, this.player, true).do();
    }
}


export class ChoosePlayersAction extends ChooseTsAction<OathPlayer> {
    start() {
        if (!this.choices) this.choices = [new Set(this.game.players.filter(e => e !== this.player))];

        for (const [i, group] of this.choices.entries()) {
            const choices = new Map<string, OathPlayer>();
            for (const player of group)
                if (player !== this.player)
                    choices.set(player.name, player);
            this.selects["choices" + i] = new SelectNOf("Player", choices, this.rangeMin(i), this.rangeMax(i));
        }

        return super.start();
    }
}

export class TakeResourceFromPlayerAction extends ChoosePlayersAction {
    constructor(player: OathPlayer, resource: OathResourceType, amount?: number, players?: Iterable<OathPlayer>) {
        super(
            player, "",
            (targets: OathPlayer[]) => {
                if (!targets[0]) return;
                if (resource === Secret && targets[0].byClass(Secret).length <= 1) return;
                new MoveResourcesToTargetEffect(this.game, player, resource, amount === undefined ? 1 : amount, player, targets[0]).do();
            },
            players && [players]
        );
    }
}

export class StartBindingExchangeAction extends ChoosePlayersAction {
    constructor(player: OathPlayer, next: Constructor<MakeBindingExchangeOfferAction>, players?: Iterable<OathPlayer>) {
        super(
            player, "Start a binding exchange with another player",
            (targets: OathPlayer[]) => { if (targets.length) new next(this.player, targets[0], new next(targets[0], this.player)).doNext(); },
            players && [players]
        );
    }
}


export class ChooseSitesAction extends ChooseTsAction<Site> {
    start() {
        if (!this.choices) this.choices = [new Set([...this.game.board.sites()].filter(e => !e.facedown && e !== this.player.site))];

        for (const [i, group] of this.choices.entries()) {
            const choices = new Map<string, Site>();
            for (const site of group) choices.set(site.visualName(this.player), site);
            this.selects["choices" + i] = new SelectNOf("Site", choices, this.rangeMin(i), this.rangeMax(i));
        }

        return super.start();
    }
}

export class ActAsIfAtSiteAction extends ChooseSitesAction {
    constructor(player: OathPlayer, action: ModifiableAction, sites?: Iterable<Site>) {
        super(
            player, "Choose a site to act at",
            (sites: Site[]) => {
                if (!sites[0]) return;
                action.playerProxy.site = action.maskProxyManager.get(sites[0]);
                action.doNext();  // Allow the player to choose other new modifiers
            },
            sites && [sites]
        );
    }
}

export class MoveWarbandsBetweenBoardAndSitesAction extends ChooseSitesAction {
    constructor(playerProxy: OathPlayer) {
        super(
            playerProxy.original, "Exchange warbands with a site (choose none to finish)",
            (sites: Site[]) => {
                if (!sites[0]) return;
                const action = new MoveWarbandsAction(playerProxy.original);
                action.playerProxy.site = action.maskProxyManager.get(sites[0]);
                action.doNext();
                this.doNext();
            },
            [[...playerProxy.game.board.sites()].filter(e => e.ruler === playerProxy).map(e => e.original)],
            [[0, 1]]
        );
    }
}


export class ChooseCardsAction<T extends OathCard> extends ChooseTsAction<T> {
    choices: Set<T>[];

    constructor(player: OathPlayer, message: string, cards: Iterable<T>[], callback: (...choices: T[][]) => void, ranges: [number, number?][] = []) {
        super(player, message, callback, cards, ranges);
    }

    start() {
        for (const [i, group] of this.choices.entries()) {
            const choices = new Map<string, T>();
            for (const card of group) choices.set(card.visualName(this.player), card);
            this.selects["choices" + i] = new SelectNOf("Card", choices, this.rangeMin(i), this.rangeMax(i));
        }

        return super.start();
    }
}


export class ConspiracyStealAction extends OathAction {
    readonly selects: { taking: SelectNOf<Relic | Banner> };
    readonly parameters: { taking: (Relic | Banner)[] };
    readonly message = "Take a relic or banner";

    target: OathPlayer;

    constructor(player: OathPlayer, target: OathPlayer) {
        super(player);
        this.target = target;
    }

    start() {
        const choices = new Map<string, Relic | Banner>();
        for (const relic of this.player.relics) choices.set(relic.visualName(this.player), relic);
        for (const banner of this.player.banners) choices.set(banner.name, banner);
        this.selects.taking = new SelectNOf("Target", choices, 1);
        return super.start();
    }

    execute(): void {
        const taking = this.parameters.taking[0]!;
        taking.seize(this.player);
    }
}

export class MakeBindingExchangeOfferAction extends OathAction {
    readonly selects: { favors: SelectNumber, secrets: SelectNumber };
    readonly parameters: { favors: number[], secrets: number[] };
    readonly message = "Choose what you want in the exchange";

    other: OathPlayer;
    effect: BindingExchangeEffect;
    next?: MakeBindingExchangeOfferAction;

    constructor(player: OathPlayer, other: OathPlayer, next?: MakeBindingExchangeOfferAction) {
        super(player);
        this.other = other;
        this.effect = next?.effect || new BindingExchangeEffect(other, player);
        this.next = next;
    }

    start(): boolean {
        this.selects.favors = new SelectNumber("Favors", inclusiveRange(this.other.byClass(Favor).length));
        this.selects.secrets = new SelectNumber("Secrets", inclusiveRange(this.other.byClass(Secret).length));
        return super.start();
    }

    execute(): void {
        const favors = this.parameters.favors[0]!;
        const secrets = this.parameters.secrets[0]!;

        if (this.next) {
            this.effect.resourcesTaken.set(Favor, favors);
            this.effect.resourcesTaken.set(Secret, secrets);
            this.next.doNext();
        } else {
            this.effect.resourcesGiven.set(Favor, favors);
            this.effect.resourcesGiven.set(Secret, secrets);
            new MakeDecisionAction(this.other, "Complete the binding exchange?", () => this.effect.do()).doNext();
        }
    }
}

export class CitizenshipOfferAction extends MakeBindingExchangeOfferAction {
    readonly selects: { favors: SelectNumber, secrets: SelectNumber, reliquaryRelic: SelectNumber, things: SelectNOf<Relic | Banner> };
    readonly parameters: { favors: number[], secrets: number[], reliquaryRelic: number[], things: (Relic | Banner)[] };

    effect: CitizenshipOfferEffect;

    constructor(player: OathPlayer, other: OathPlayer, next?: CitizenshipOfferAction) {
        super(player, other, next);
        this.effect = next?.effect || new CitizenshipOfferEffect(other, player);
    }

    start(): boolean {
        if (!this.next) {
            const values = [];
            for (const [i, slot] of this.game.chancellor.reliquary.children.entries())
                if (slot.children[0])
                    values.push(i);
            
            this.selects.reliquaryRelic = new SelectNumber("Reliquary slot", values);
        }

        const choices = new Map<string, Relic | Banner>();
        for (const relic of this.other.relics) choices.set(relic.visualName(this.player), relic);
        for (const banner of this.other.banners) choices.set(banner.name, banner);
        this.selects.things = new SelectNOf("Relics and banners", choices);

        return super.start();
    }

    execute(): void {
        const things = new Set(this.parameters.things);
        if (this.next) {
            this.effect.thingsTaken = things;
        } else {
            this.effect.thingsGiven = things;
            this.effect.reliquaryIndex = this.parameters.reliquaryRelic[0]!;
        }

        super.execute();
    }
}


export class SkeletonKeyAction extends OathAction {
    readonly selects: { index: SelectNumber };
    readonly parameters: { index: number[] };
    readonly message = "Peek at a relic in the Reliquary";

    start(): boolean {
        const values = [];
        for (const [i, slot] of this.game.chancellor.reliquary.children.entries())
            if (slot.children[0])
                values.push(i);
        
        this.selects.index = new SelectNumber("Reliquary slot", values);
        return super.start();
    }

    execute(): void {
        const index = this.parameters.index[0]!;
        const relic = this.game.chancellor.reliquary.children[index]!.children[0];
        if (relic) new PeekAtCardEffect(this.player, relic).do();
        new MakeDecisionAction(this.player, "Take the relic?", () => new TakeReliquaryRelicEffect(this.player, index).do()).doNext();
    }
}


export class BrackenAction extends OathAction {
    readonly selects: { region: SelectNOf<Region>, onTop: SelectBoolean };
    readonly parameters: { region: Region[], onTop: boolean[] };
    readonly message = "Choose where you'll discard";

    action: SearchAction;

    constructor(action: SearchAction) {
        super(action.player);
        this.action = action;
    }

    start(): boolean {
        const regions = new Set(Object.values(this.game.board.children));
        const choices = new Map<string, Region>();
        for (const region of regions) choices.set(region.name, region);
        this.selects.region = new SelectNOf("Region", choices, 1);
        this.selects.onTop = new SelectBoolean("Position", ["Bottom", "Top"])
        return super.start();
    }

    execute(): void {
        const region = this.parameters.region[0]!;
        const onTop = this.parameters.onTop[0]!;
        this.action.discardOptions = new DiscardOptions(region.discard, !onTop);
    }
}


////////////////////////////////////////////
//             END OF THE GAME            //
////////////////////////////////////////////
export class VowOathAction extends OathAction {
    readonly selects: { oath: SelectNOf<OathType> };
    readonly parameters: { oath: OathType[] };
    readonly message = "Vow an Oath";

    start(): boolean {
        const choices = new Map<string, OathType>();
        if (this.player instanceof Exile && this.player.vision) {
            const oathType = this.player.vision.oath.id;
            choices.set(OathTypeName[oathType], oathType);
        } else {
            for (let i: OathType = 0; i < 4; i++)
                if (i !== this.game.oath.id)
                    choices.set(OathTypeName[i], i);
        }
        this.selects.oath = new SelectNOf("Oath", choices);
        return super.start();
    }

    execute(): void {
        // TODO: Put this in an effect
        const oathType = this.parameters.oath[0]!;
        this.game.oath = new OathTypeToOath[oathType]();
    }
}

export class ChooseNewCitizensAction extends OathAction {
    readonly selects: { players: SelectNOf<OathPlayer> };
    readonly parameters: { players: OathPlayer[] };
    readonly message = "Propose Citizenship to other Exiles";

    start() {
        const choices = new Map<string, OathPlayer>();
        const players = new Set(this.game.players.filter(e => !e.isImperial && e !== this.player));
        for (const player of players) choices.set(player.name, player);
        this.selects.players = new SelectNOf("Exile(s)", choices);
        return super.start();
    }

    execute(): void {
        const citizens = this.parameters.players;
        for (const player of this.game.players)
            if (player instanceof Exile && player.isCitizen)
                new BecomeExileEffect(player).do();
        
        for (const citizen of citizens)
            new MakeDecisionAction(citizen, "Become a Citizen?", () => new BecomeCitizenEffect(citizen).do()).doNext();
    }
}

export class BuildOrRepairEdificeAction extends OathAction {
    readonly selects: { card: SelectNOf<Denizen | undefined> };
    readonly parameters: { card: (Denizen | undefined)[] };
    readonly message = "Build or repair an edifice";

    start(): boolean {
        const choices = new Map<string, Denizen | undefined>();
        for (const site of this.game.board.sites())
            if (site.ruler?.isImperial)
                for (const denizen of site.denizens)
                    if (!(denizen instanceof Edifice && denizen.suit !== OathSuit.None))
                        choices.set(denizen.name, denizen);

        choices.set("None", undefined);
        this.selects.card = new SelectNOf("Card", choices, 1);
        return super.start();
    }

    execute(): void {
        const card = this.parameters.card[0];
        if (!card) return;
        
        if (card instanceof Edifice)
            new FlipEdificeEffect(card).do();
        else
            new BuildEdificeFromDenizenEffect(card).do();
    }
}
