import { Denizen, Edifice, Relic, Site, VisionBack, WorldCard } from "../cards/cards";
import { DiscardOptions, SearchableDeck } from "../cards/decks";
import { AttackDie, DefenseDie, Die } from "../dice";
import { MoveBankResourcesEffect, MoveResourcesToTargetEffect, PayCostToTargetEffect, PlayWorldCardEffect, PutResourcesIntoBankEffect, PutWarbandsFromBagEffect, RollDiceEffect, DrawFromDeckEffect, TakeResourcesFromBankEffect, TakeWarbandsIntoBagEffect, PutPawnAtSiteEffect, DiscardCardEffect, MoveOwnWarbandsEffect, MoveAdviserEffect, MoveWorldCardToAdvisersEffect, SetNewOathkeeperEffect, SetPeoplesFavorMobState, DiscardCardGroupEffect, OathEffect, PaySupplyEffect, ChangePhaseEffect, NextTurnEffect, PutResourcesOnTargetEffect, SetUsurperEffect, BecomeCitizenEffect, BecomeExileEffect, BuildEdificeFromDenizenEffect, WinGameEffect, FlipEdificeEffect, ModifiedExecutionEffect, CampaignResolveSuccessfulAndSkullsEffect, BindingExchangeEffect, CitizenshipOfferEffect, PeekAtCardEffect, TakeReliquaryRelicEffect, CheckCapacityEffect, ApplyModifiersEffect, CampaignJoinDefenderAlliesEffect } from "../effects";
import { BannerName, OathPhase, OathResource, OathResourceName, OathSuit, OathSuitName, OathType, OathTypeName } from "../enums";
import { OathGame } from "../game";
import { OathGameObject } from "../gameObject";
import { OathTypeToOath } from "../oaths";
import { Exile, OathPlayer } from "../player";
import { ActionModifier, ActionPower, ActivePower, CapacityModifier, OathPower } from "../powers/powers";
import { ResourceCost, ResourcesAndWarbands } from "../resources";
import { Banner, PeoplesFavor } from "../banks";
import { Constructor, isExtended, MaskProxyManager, shuffleArray, WithOriginal } from "../utils";
import { SelectNOf, SelectBoolean, SelectNumber } from "./selects";



//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export class InvalidActionResolution extends Error { }

export abstract class OathAction extends OathGameObject {
    readonly selects: Record<string, SelectNOf<any>> = {};
    readonly parameters: Record<string, any> = {};
    readonly autocompleteSelects: boolean = true;
    abstract readonly message: string;

    player: OathPlayer;             // This is the original player. Modifying it modifies the game state

    constructor(player: OathPlayer) {
        super(player.game);
        this.player = player;
    }

    doNext(): void {
        this.game.actionManager.futureActionsList.unshift(this);
    }

    parse(data: Record<string, string[]>): Record<string, any[]> {
        const values: Record<string, any[]> = {};
        for (const [k, select] of Object.entries(this.selects)) {
            if (!(k in data)) throw new InvalidActionResolution(`Missing choice for select ${k}`);
            values[k] = select.parse(data[k]);
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
        const values: Record<string, string[]> = {};
        if (this.autocompleteSelects) {
            for (const [key, select] of Object.entries(this.selects)) {
                if (select.choices.size <= select.min) {
                    this.parameters[key] = [...select.choices.values()];
                    delete this.selects[key];
                }
            }
        }

        // If all needed parameters were filled out (or there are no selects), just execute immediately
        return Object.keys(this.selects).length === 0;
    }

    abstract execute(): void;

    serialize(): Record<string, any> {
        return {
            message: this.message,
            player: this.player.color,
            selects: Object.fromEntries(Object.entries(this.selects).map(([k, v]) => [k, v.serialize()])),
        }
    }
}

export class ChooseModifiers extends OathAction {
    readonly selects: { modifiers: SelectNOf<ActionModifier<any>> };
    readonly parameters: { modifiers: ActionModifier<any>[] };
    readonly action: ModifiableAction;
    readonly next: ModifiableAction | ChooseModifiers;
    readonly message = "Choose modifiers";

    persistentModifiers: Set<ActionModifier<any>>;

    constructor(next: ModifiableAction | ChooseModifiers, chooser: OathPlayer = next.player) {
        super(chooser);
        this.next = next;
        this.action = next instanceof ChooseModifiers ? next.action : next;
    }

    start() {
        this.persistentModifiers = new Set();
        const choices = new Map<string, ActionModifier<any>>();
        for (const modifier of ChooseModifiers.gatherModifiers(this.action)) {
            if (modifier.mustUse)
                this.persistentModifiers.add(modifier);
            else
                choices.set(modifier.name, modifier);
        }
        this.selects.modifiers = new SelectNOf("Modifiers", choices);

        return super.start();
    }

    static gatherModifiers(action: ModifiableAction): Set<ActionModifier<any>> {
        const instances = new Set<ActionModifier<any>>();
        for (const [sourceProxy, modifier] of action.gameProxy.getPowers(ActionModifier<any>)) {
            const instance = new modifier(sourceProxy.original, action);
            if (action instanceof instance.modifiedAction && instance.canUse()) instances.add(instance);
        }

        return instances;
    }

    execute() {
        const modifiers = new Set([...this.persistentModifiers, ...this.parameters.modifiers]);
        
        // NOTE: For ignore loops, all powers in the loop are ignored.
        const ignore = new Set<ActionModifier<any>>();
        for (const modifier of modifiers) for (const toIgnore of modifier.applyImmediately(modifiers)) ignore.add(toIgnore);
        for (const modifier of ignore) modifiers.delete(modifier);

        if (!new ApplyModifiersEffect(this.action, this.player, modifiers).do()) return;
        
        if (this.next instanceof ModifiableAction)
            this.next.doNextWithoutModifiers();
        else
            this.next.doNext();
    }
}

export abstract class ModifiableAction extends OathAction {
    modifiers: ActionModifier<any>[] = [];
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
        new ModifiedExecutionEffect(this).doNext();  // This allows actions to be slotted before the actual resolution of the action
        for (const modifier of this.modifiers) modifier.applyAfter();
    }

    abstract modifiedExecution(): void;

    serialize(): Record<string, any> {
        const obj = super.serialize();
        obj.modifiers = this.modifiers.map(e => e.constructor.name);
        return obj;
    }
}

export abstract class MajorAction extends ModifiableAction {
    readonly autocompleteSelects: boolean = false;

    supplyCost: number;         // You may set the Supply cost if the effect replaces it. Multiple instances will just be tie-broken with timestamps
    supplyCostModifier = 0;     // Use this for linear modifications to the Supply cost
    noSupplyCost: boolean;
    get actualSupplyCost() { return this.noSupplyCost ? 0 : this.supplyCost + this.supplyCostModifier; }

    start(): boolean {
        this.supplyCostModifier = 0;
        this.noSupplyCost = false;
        return super.start();
    }

    modifiedExecution() {
        if (!new PaySupplyEffect(this.player, this.actualSupplyCost).do())
            throw new InvalidActionResolution(`Cannot pay Supply cost (${this.actualSupplyCost}).`);
    }
}



////////////////////////////////////////////
//              MAJOR ACTIONS             //
////////////////////////////////////////////
export class MusterAction extends MajorAction {
    readonly selects: { card: SelectNOf<Denizen> };
    readonly parameters: { card: Denizen[] };
    readonly message = "Put a favor on a card to muster";

    supplyCost = 1;
    cardProxy: Denizen;
    using = OathResource.Favor;
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
        this.cardProxy = this.parameters.card[0];
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        if (new MoveResourcesToTargetEffect(this.game, this.player, this.using, this.amount, this.cardProxy.original).do() < 1)
            throw new InvalidActionResolution("Cannot pay resource cost.");

        new PutWarbandsFromBagEffect(this.player, this.getting).do();
    }
}


export class TradeAction extends MajorAction {
    readonly selects: { card: SelectNOf<Denizen>, forFavor: SelectBoolean };
    readonly parameters: { card: Denizen[], forFavor: boolean[] };
    readonly message = "Put resources on a card to trade";

    supplyCost = 1;
    cardProxy: Denizen;
    forFavor: boolean;
    paying: Map<OathResource, number>;
    getting: Map<OathResource, number>;

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
        this.cardProxy = this.parameters.card[0];
        this.forFavor = this.parameters.forFavor[0];
        this.paying = new Map([[this.forFavor ? OathResource.Secret : OathResource.Favor, this.forFavor ? 1 : 2]]);
        this.getting = new Map([[this.forFavor ? OathResource.Favor : OathResource.Secret, (this.forFavor ? 1 : 0)]]);
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();

        // TODO: Make costs easily printable. Potentially get the error from the ResourceCost class?
        if (!new PayCostToTargetEffect(this.game, this.player, new ResourceCost(this.paying), this.cardProxy.original).do())
            throw new InvalidActionResolution("Cannot pay resource cost.");

        const resource = this.forFavor ? OathResource.Favor : OathResource.Secret;
        this.getting.set(resource, (this.getting.get(resource) || 0) + this.playerProxy.adviserSuitCount(this.cardProxy.suit));

        new TakeResourcesFromBankEffect(this.game, this.player, this.gameProxy.favorBanks.get(this.cardProxy.suit)?.original, this.getting.get(OathResource.Favor) || 0).do();
        new PutResourcesOnTargetEffect(this.game, this.player, OathResource.Secret, this.getting.get(OathResource.Secret) || 0).do();
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
                choices.set(siteProxy.facedown ? `Facedown ${siteProxy.region.name}` : siteProxy.name, siteProxy);
        this.selects.site = new SelectNOf("Site", choices, 1);
        return super.start();
    }

    execute() {
        this.player = this.travelling;
        this.siteProxy = this.parameters.site[0];
        this.supplyCost = this.gameProxy.board.travelCosts.get(this.player.site.region.regionName)?.get(this.siteProxy.region.regionName) || 2;
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        new PutPawnAtSiteEffect(this.player, this.siteProxy.original).do();
    }
}


export interface RecoverActionTarget extends WithOriginal {
    canRecover(action: RecoverAction): boolean;
    recover(player: OathPlayer): void;
}

export class RecoverAction extends MajorAction {
    readonly selects: { target: SelectNOf<RecoverActionTarget> };
    readonly parameters: { target: RecoverActionTarget[] };
    readonly message = "Choose a target to recover";
    
    supplyCost = 1;
    targetProxy: RecoverActionTarget;

    start() {
        const choices = new Map<string, RecoverActionTarget>();
        for (const relicProxy of this.playerProxy.site.relics) if (relicProxy.canRecover(this)) choices.set(relicProxy.name, relicProxy);
        for (const bannerProxy of this.gameProxy.banners.values()) if (bannerProxy.canRecover(this)) choices.set(bannerProxy.name, bannerProxy);
        this.selects.target = new SelectNOf("Target", choices, 1);
        return super.start();
    }

    execute() {
        this.targetProxy = this.parameters.target[0];
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        this.targetProxy.original.recover(this.player);
    }
}

export class RecoverBannerPitchAction extends OathAction {
    readonly selects: { amount: SelectNumber };
    readonly parameters: { amount: number[] };
    readonly message = "Put resources onto the banner";

    banner: Banner;

    constructor(player: OathPlayer, banner: Banner) {
        super(player);
        this.banner = banner;
    }

    start() {
        const values: number[] = [];
        for (let i = this.banner.amount + 1; i <= this.player.getResources(this.banner.type); i++)
            values.push(i);
        this.selects.amount = new SelectNumber("Amount", values);
        return super.start();
    }

    execute() {
        this.banner.original.finishRecovery(this.player, this.parameters.amount[0]);
    }
}


export class SearchAction extends MajorAction {
    readonly selects: { deck: SelectNOf<SearchableDeck> };
    readonly parameters: { deck: SearchableDeck[] };
    readonly message = "Draw 3 cards from a deck";

    deckProxy: SearchableDeck;
    amount = 3;
    fromBottom = false;
    discardOptions = new DiscardOptions(this.player.discard);

    start() {
        const choices = new Map<string, SearchableDeck>();
        choices.set("World Deck", this.gameProxy.worldDeck);
        choices.set(this.playerProxy.site.region.name, this.playerProxy.site.region.discard);
        this.selects.deck = new SelectNOf("Deck", choices, 1);
        return super.start();
    }

    execute() {
        this.deckProxy = this.parameters.deck[0];
        this.supplyCost = this.deckProxy.searchCost;
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        const cards = new DrawFromDeckEffect(this.player, this.deckProxy.original, this.amount, this.fromBottom).do();
        new SearchChooseAction(this.player, cards, this.discardOptions).doNext();
    }
}

export class SearchChooseAction extends ModifiableAction {
    readonly selects: { cards: SelectNOf<WorldCard> }
    readonly parameters: { cards: WorldCard[] }
    readonly message = "Choose which card(s) to keep";

    cards: Set<WorldCard>;
    playing: WorldCard[];  // For this action, order is important
    playingAmount: number;
    discardOptions: DiscardOptions<any>;

    constructor(player: OathPlayer, cards: Iterable<WorldCard>, discardOptions?: DiscardOptions<any>, amount: number = 1) {
        super(player);
        this.discardOptions = discardOptions || new DiscardOptions(player.discard);
        this.cards = new Set(cards);
        this.playingAmount = Math.min(amount, this.cards.size);
    }

    start() {
        const cardsChoice = new Map<string, WorldCard>();
        for (const card of this.cards) cardsChoice.set(card.name, card);
        this.selects.cards = new SelectNOf("Card(s)", cardsChoice, 0, this.playingAmount);
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
        for (const card of this.playing) new SearchPlayAction(this.player, card.original, this.discardOptions).doNext();
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
    discardOptions: DiscardOptions<any>;

    constructor(player: OathPlayer, cards: Iterable<WorldCard>, amount?: number, discardOptions?: DiscardOptions<any>) {
        super(player);
        this.discardOptions = discardOptions || new DiscardOptions(player.discard);
        this.cards = new Set(cards);
        this.amount = Math.min(this.cards.size, amount || this.cards.size);
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

export class SearchPlayAction extends ModifiableAction {
    readonly selects: { site: SelectNOf<Site | undefined>, facedown: SelectBoolean }
    readonly parameters: { site: (Site | undefined)[], facedown: boolean[] }
    readonly message: string;
    
    cardProxy: WorldCard;
    siteProxy: Site | undefined;
    facedown: boolean;
    discardOptions: DiscardOptions<any>;
    canReplace: boolean;

    constructor(player: OathPlayer, card: WorldCard, discardOptions?: DiscardOptions<any>) {
        super(player);
        this.cardProxy = this.maskProxyManager.get(card);
        this.message = "Play " + this.cardProxy.name;
        this.discardOptions = discardOptions || new DiscardOptions(player.discard);
    }

    start() {
        const sitesChoice = new Map<string, Site | undefined>();
        sitesChoice.set("Advisers", undefined);
        sitesChoice.set(this.playerProxy.site.name, this.playerProxy.site);
        this.selects.site = new SelectNOf("Place", sitesChoice, 1);

        this.selects.facedown = new SelectBoolean("Orientation", ["Facedown", "Faceup"]);

        return super.start();
    }

    execute() {
        this.siteProxy = this.parameters.site[0];
        this.facedown = this.parameters.facedown[0];
        this.canReplace = this.siteProxy === undefined;
        super.execute();
    }

    static getCapacityInformation(maskProxyManager: MaskProxyManager, playerProxy: OathPlayer, siteProxy?: Site, playingProxy?: WorldCard): [number, WorldCard[], boolean] {
        const capacityModifiers: CapacityModifier<any>[] = [];
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
        const [capacity, takesSpaceInTargetProxies, ignoresCapacity] = SearchPlayAction.getCapacityInformation(this.maskProxyManager, this.playerProxy, this.siteProxy, this.cardProxy);

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

export class PeoplesFavorDiscardAction extends OathAction {
    readonly selects: { card: SelectNOf<Denizen> };
    readonly parameters: { card: Denizen[] };
    readonly message = "You may discard a card";

    discardOptions: DiscardOptions<any>;

    constructor(player: OathPlayer, discardOptions?: DiscardOptions<any>) {
        super(player);
        this.discardOptions = discardOptions || new DiscardOptions(player.discard);
    }

    start() {
        const choices = new Map<string, Denizen>();
        for (const site of this.player.site.region.sites)
            for (const denizen of site.denizens)
                if (!denizen.activelyLocked) choices.set(denizen.name, denizen);
        this.selects.card = new SelectNOf("Card", choices, 0, 1);
        return super.start();
    }

    execute(): void {
        if (this.parameters.card.length === 0) return;
        const card = this.parameters.card[0];
        new DiscardCardEffect(this.player, card, this.discardOptions).do();
    }
}


export class CampaignAction extends MajorAction {
    readonly selects: { defender: SelectNOf<OathPlayer | undefined> };
    readonly parameters: { defender: (OathPlayer | undefined)[] };
    readonly message = "Choose a defender";
    
    supplyCost = 2;
    defenderProxy: OathPlayer | undefined;

    start() {
        const choices = new Map<string, OathPlayer | undefined>();
        for (const playerProxy of Object.values(this.gameProxy.players)) choices.set(playerProxy.name, playerProxy);
        if (this.playerProxy.site.ruler === undefined) choices.set("Bandits", undefined);
        this.selects.defender = new SelectNOf("Defender", choices, 1);
        return super.start();
    }

    execute() {
        this.defenderProxy = this.parameters.defender[0];
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        const next = new CampaignAtttackAction(this.player, this.defenderProxy?.original);
        if (this.defenderProxy?.isImperial) new CampaignJoinDefenderAlliesEffect(next.campaignResult, this.gameProxy.chancellor.original).do();
        next.doNext();
    }
}

export interface CampaignActionTarget extends WithOriginal {
    defense: number;
    force: ResourcesAndWarbands | undefined;
    seize(player: OathPlayer): void;
};

export class CampaignAtttackAction extends ModifiableAction {
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
        this.defenderProxy = defender && this.maskProxyManager.get(defender);
        this.campaignResult.checkForImperialInfighting(this.maskProxyManager);
    }

    start() {
        this.campaignResult.targets.clear();
        const choices = new Map<string, CampaignActionTarget>();
        for (const siteProxy of this.gameProxy.board.sites()) { 
            if (!siteProxy.facedown && siteProxy.ruler === this.defenderProxy) {
                if (this.playerProxy.site === siteProxy) {
                    this.campaignResult.targets.add(siteProxy.original);
                } else {
                    choices.set(siteProxy.name, siteProxy);
                }
            }
        }

        if (this.defenderProxy && this.defenderProxy.site === this.playerProxy.site) {
            choices.set("Banish " + this.defenderProxy.name, this.defenderProxy);
            for (const relicProxy of this.defenderProxy.relics) choices.set(relicProxy.name, relicProxy)
            for (const bannerProxy of this.defenderProxy.banners) choices.set(bannerProxy.name, bannerProxy);
        }
        this.selects.targets = new SelectNOf("Target(s)", choices, 1 - this.campaignResult.targets.size, choices.size);

        const values: number[] = [];
        for (let i = 0; i <= this.playerProxy.totalWarbands; i++) values.push(i);
        this.selects.pool = new SelectNumber("Attack pool", values);
        
        return super.start();
    }

    get campaignResult() { return this.next.campaignResult; }

    execute() {
        for (const targetProxy of this.parameters.targets) this.campaignResult.targets.add(targetProxy.original);
        this.campaignResult.atkPool = this.parameters.pool[0];
        this.campaignResult.defPool = 0;

        const allyProxiesCandidates = new Set<OathPlayer>();
        for (const target of this.campaignResult.targets) {
            const targetProxy = this.maskProxyManager.get(target);
            this.campaignResult.defPool += targetProxy.defense;
            
            for (const playerProxy of Object.values(this.gameProxy.players)) {
                const siteProxy = targetProxy instanceof Site ? targetProxy : this.playerProxy.site;
                if (playerProxy.site === siteProxy)
                    allyProxiesCandidates.add(playerProxy);
            }
        }
        
        if (this.campaignResult.defender && this.maskProxyManager.get(this.campaignResult.defender) === this.gameProxy.oathkeeper)
            this.campaignResult.defPool += this.gameProxy.isUsurper ? 2 : 1;

        for (const allyProxy of allyProxiesCandidates) {
            const ally = allyProxy.original;
            console.log("Trying allying with", ally.name);
            if (!this.campaignResult.defenderAllies.has(ally) && allyProxy.leader === this.defenderProxy?.leader)
                new AskForPermissionAction(ally, () => new CampaignJoinDefenderAlliesEffect(this.campaignResult, ally).do(), "Join as an Imperial Ally?").doNext();
        }

        super.execute();
    }

    modifiedExecution() {
        this.campaignResult.defForce = new Set();
        for (const target of this.campaignResult.targets) {
            const force = target.force;
            if (force) this.campaignResult.defForce.add(force);
        }

        for (const ally of this.campaignResult.defenderAllies) {
            if (ally.site === this.player.site) {
                this.campaignResult.defForce.add(ally);
                continue;
            }
            
            for (const target of this.campaignResult.targets) {
                if (target instanceof Site && ally.site === target) {
                    this.campaignResult.defForce.add(ally);
                    continue;
                }
            }
        }
        
        this.campaignResult.atkForce = new Set([this.player]);

        if (this.campaignResult.defender) {
            this.next.doNext();
            return;
        }

        // Bandits use all battle plans that are free
        const modifiers: ActionModifier<any>[] = [];
        for (const modifier of ChooseModifiers.gatherModifiers(this)) {
            if (modifier.mustUse || modifier.cost.free)
                modifiers.push(modifier);
        };

        // If any powers cost something, then the attacker pays. Shouldn't happen though
        if (new ApplyModifiersEffect(this.next, this.player, modifiers))
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

    doNext(): void {
        let next = new ChooseModifiers(this);
        for (const ally of this.campaignResult.defenderAllies) 
            if (ally !== this.player)
                next = new ChooseModifiers(next, ally);
        next.doNext();
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

export class CampaignResult extends OathGameObject {
    attacker: OathPlayer;
    defender: OathPlayer | undefined;
    defenderAllies = new Set<OathPlayer>();
    targets = new Set<CampaignActionTarget>();
    atkPool: number;
    defPool: number;
    atkForce: Set<ResourcesAndWarbands>;  // The force is all your warbands on the objects in this array
    defForce: Set<ResourcesAndWarbands>;
    
    atkRoll: number[] = [];
    defRoll: number[] = [];
    successful: boolean;
    
    ignoreSkulls: boolean = false;
    ignoreKilling: boolean = false;
    attackerKillsNoWarbands: boolean = false;
    defenderKillsNoWarbands: boolean = false;
    attackerKillsEntireForce: boolean = false;
    defenderKillsEntireForce: boolean = false;

    attackerLoss: number = 0;
    defenderLoss: number = 0;
    endCallbacks: (() => void)[] = [];

    get totalAtkForce() { return [...this.atkForce].reduce((a, e) => a + e.getWarbands(this.attacker.leader.original), 0); }
    get totalDefForce() { return [...this.defForce].reduce((a, e) => a + e.getWarbands(this.defender?.leader.original), 0); }

    get atk() { return AttackDie.getResult(this.atkRoll); }
    get def() { return DefenseDie.getResult(this.defRoll) + this.totalDefForce; }

    get requiredSacrifice() { return this.def - this.atk + 1; }
    get couldSacrifice() { return this.requiredSacrifice > 0 && this.requiredSacrifice <= this.totalAtkForce; }

    get winner() { return this.successful ? this.attacker : this.defender; }
    get loser() { return this.successful ? this.defender : this.attacker; }
    get loserTotalForce() { return this.successful ? this.totalDefForce : this.totalAtkForce; }
    get loserKillsNoWarbands() { return this.successful ? this.defenderKillsNoWarbands : this.attackerKillsNoWarbands; }
    get loserKillsEntireForce() { return this.successful ? this.defenderKillsEntireForce : this.attackerKillsEntireForce; }
    get loserLoss() { return this.successful ? this.defenderLoss : this.attackerLoss; }

    discardAtEnd(denizen: Denizen) {
        this.endCallbacks.push(() => new DiscardCardEffect(denizen.ruler || this.attacker, denizen).do());
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
        this.atkRoll = new RollDiceEffect(this.game, this.attacker, AttackDie, this.atkPool).do();
    }

    rollDefense() {
        this.defRoll = new RollDiceEffect(this.game, this.defender, DefenseDie, this.defPool + (this.atkPool < 0 ? -this.atkPool : 0)).do();
    }
    
    attackerKills(amount: number) {
        if (amount) new CampaignKillWarbandsInForceAction(this, true, amount).doNext();
    }

    defenderKills(amount: number) {
        if (!this.defender) return;
        if (amount) new CampaignKillWarbandsInForceAction(this, false, amount).doNext();
    }

    loserKills(amount: number) {
        if (this.successful) this.defenderKills(amount); else this.attackerKills(amount);
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
    doSacrifice: boolean;

    constructor(player: OathPlayer) {
        super(player);
        this.campaignResult.checkForImperialInfighting(this.maskProxyManager);
    }

    start() {
        if (this.campaignResult.couldSacrifice) {
            this.selects.doSacrifice = new SelectBoolean("Decision", [`Sacrifice ${this.campaignResult.requiredSacrifice} warbands`, "Abandon"]);
        } else {
            this.parameters.doSacrifice = [false];
        }
        
        return super.start();
    }

    execute() {
        this.doSacrifice = this.parameters.doSacrifice[0];
        super.execute();
    }

    modifiedExecution() {
        if (this.doSacrifice) {
            this.campaignResult.attackerKills(this.campaignResult.requiredSacrifice);
            this.campaignResult.successful = true;
        }

        if (this.campaignResult.loser && !this.campaignResult.ignoreKilling && !this.campaignResult.loserKillsNoWarbands)
            this.campaignResult.loserKills(Math.floor(this.campaignResult.loserTotalForce / (this.campaignResult.loserKillsEntireForce ? 1 : 2)));

        if (this.campaignResult.successful)
            for (const target of this.campaignResult.targets) target.seize(this.campaignResult.attacker);

        for (const func of this.campaignResult.endCallbacks)
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
        this.force = attacker ? result.atkForce : result.defForce;
        this.attacker = attacker;
        this.amount = amount;
    }

    start(): boolean {
        if (this.owner) {
            const sources: [string, number][] = [...this.force].map(e => [e.name, e.getWarbands(this.owner)]);
            for (const [key, warbands] of sources) {
                const values = [];
                const min = Math.min(warbands, Math.max(0, this.amount - sources.filter(([k, _]) => k !== key).reduce((a, [_, v]) => a + Math.min(v, this.amount), 0)));
                const max = Math.min(warbands, this.amount);
                for (let i = min; i <= max; i++) values.push(i);
                this.selects[key] = new SelectNumber(key, values);
            }
        }
        return super.start();
    }

    execute(): void {
        if (!this.owner) return;

        const total = Object.values(this.parameters).reduce((a, e) => a + e[0], 0);
        if (total !== this.amount)
            throw new InvalidActionResolution("Invalid total amount of warbands");
        
        for (const source of this.force) {
            const killed = new TakeWarbandsIntoBagEffect(this.owner, this.parameters[source.name][0], source).do();
            if (this.attacker)
                this.result.attackerLoss += killed;
            else
                this.result.defenderLoss += killed;
        }
    }
}

export class CampaignBanishPlayerAction extends TravelAction {
    readonly message: string;

    constructor(player: OathPlayer, banished: OathPlayer) {
        super(banished, player);
        this.message = "Choose where to banish " + banished.name;
    }

    execute(): void {
        this.noSupplyCost = true;
        super.execute();
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
        this.message = "Choose how many warbands to move to " + site.name;
    }

    start() {
        const values: number[] = [];
        for (let i = 0; i <= this.player.getWarbands(this.player.leader.original); i++) values.push(i);
        this.selects.amount = new SelectNumber("Amount", values);
        return super.start();
    }

    execute() {
        new MoveOwnWarbandsEffect(this.player, this.player, this.site, this.parameters.amount[0]).do();
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
    readonly selects: { power: SelectNOf<ActivePower<any>> }
    readonly parameters: { power: ActivePower<any>[] };
    readonly autocompleteSelects = false;
    readonly message = "Choose a power to use";

    power: ActivePower<any>;

    start() {
        const choices = new Map<string, ActivePower<any>>();
        for (const [sourceProxy, power] of this.gameProxy.getPowers(ActivePower<any>)) {
            const instance = new power(sourceProxy.original, this);
            if (instance.canUse()) choices.set(instance.name, instance);
        }
        this.selects.power = new SelectNOf("Power", choices, 1);
        return super.start();
    }

    execute(): void {
        this.power = this.parameters.power[0];
        super.execute();
    }

    modifiedExecution(): void {
        if (!this.power.payCost(this.player))
            throw new InvalidActionResolution("Cannot pay the resource cost.");

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
        this.playing = this.parameters.cards[0].original;
        super.execute();
    }

    modifiedExecution(): void {
        new SearchPlayAction(this.player, new MoveAdviserEffect(this.player, this.playing).do()).doNext();
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
        let max = this.playerProxy.getWarbands(this.playerProxy.leader.original);
        if (this.playerProxy.isImperial) {
            for (const playerProxy of Object.values(this.gameProxy.players)) {
                if (playerProxy !== this.playerProxy && playerProxy.isImperial && playerProxy.site === siteProxy) {
                    choices.set(playerProxy.name, playerProxy);
                    max = Math.max(max, playerProxy.getWarbands(playerProxy.leader.original));
                }
            }
        }
        if (siteProxy.getWarbands(this.playerProxy.leader.original) > 0) {
            choices.set(siteProxy.name, siteProxy);
            max = Math.max(max, siteProxy.getWarbands(this.playerProxy.leader.original) - 1);
        }
        this.selects.target = new SelectNOf("Target", choices, 1);
        
        const values = [];
        for (let i = 1; i <= max; i++) values.push(i);
        this.selects.amount = new SelectNumber("Amount", values);

        this.selects.giving = new SelectBoolean("Direction", ["Giving", "Taking"]);

        return super.start();
    }

    execute(): void {
        this.targetProxy = this.parameters.target[0];
        this.amount = this.parameters.amount[0];
        this.giving = this.parameters.giving[0];
        super.execute();
    }

    modifiedExecution(): void {
        const from = this.giving ? this.player : this.targetProxy.original;
        const to = this.giving ? this.targetProxy.original : this.player;

        if (from instanceof Site && from.getWarbands(this.player.leader.original) - this.amount < 1)
            throw new InvalidActionResolution("Cannot take the last warband off a site.");

        const effect = new MoveOwnWarbandsEffect(this.player, from, to, this.amount);
        if (this.targetProxy instanceof OathPlayer || this.targetProxy.ruler && this.targetProxy.ruler !== this.playerProxy) {
            const askTo = this.targetProxy instanceof OathPlayer ? this.targetProxy : this.targetProxy.ruler;
            if (askTo) new AskForPermissionAction(askTo.original, () => effect.do(), `Allow ${this.amount} warbands to move from ${from.name} to ${to.name}?`).doNext();
        } else {
            effect.do();
        }
    }
}

export class AskForPermissionAction extends OathAction {
    readonly selects: { allow: SelectBoolean };
    readonly parameters: { allow: boolean[] };
    readonly message;

    callback: () => void;

    constructor(player: OathPlayer, callback: () => void, message: string) {
        super(player);
        this.callback = callback;
        this.message = message;
    }

    start(): boolean {
        this.selects.allow = new SelectBoolean("Decision", ["Allow", "Deny"]);
        return super.start();
    }

    execute(): void {
        if (this.parameters.allow[0]) this.callback();
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


export class AskForRerollAction extends OathAction {
    readonly selects: { doReroll: SelectBoolean };
    readonly parameters: { doReroll: boolean[] };
    readonly message;

    faces: number[];
    die: typeof Die;
    power?: OathPower<any>;

    constructor(player: OathPlayer, faces: number[], die: typeof Die, power?: OathPower<any>) {
        super(player);
        this.faces = faces;
        this.message = "Do you wish to reroll " + faces.join(",") + "?";
        this.die = die;
        this.power = power;
    }

    start() {
        this.selects.doReroll = new SelectBoolean("Decision", ["Reroll", "Don't reroll"]);
        return super.start();
    }

    execute(): void {
        if (this.parameters.doReroll[0]) {
            if (!this.power || this.power.payCost(this.player)) return;
            for (const [i, face] of this.die.roll(this.faces.length).entries()) this.faces[i] = face;
        }
    }
}


export abstract class ChooseSuit extends OathAction {
    readonly selects: { suit: SelectNOf<OathSuit | undefined> };
    readonly parameters: { suit: (OathSuit | undefined)[] };

    suits: Set<OathSuit>;
    suit: OathSuit | undefined;

    constructor(player: OathPlayer, suits?: Iterable<OathSuit>) {
        super(player);
        this.suits = new Set(suits || [OathSuit.Discord, OathSuit.Arcane, OathSuit.Order, OathSuit.Hearth, OathSuit.Beast, OathSuit.Nomad]);
    }

    start(none?: string) {
        const choices = new Map<string, OathSuit | undefined>();
        for (const suit of this.suits) choices.set(OathSuitName[suit], suit);
        if (none) choices.set(none, undefined);
        this.selects.suit = new SelectNOf("Suit", choices, 1);

        return super.start();
    }

    execute(): void {
        this.suit = this.parameters.suit[0];
    }
}

export class PeoplesFavorReturnAction extends ChooseSuit {
    readonly message: string;

    banner: PeoplesFavor;
    amount: number;

    constructor(player: OathPlayer, banner: PeoplesFavor) {
        super(player);
        this.banner = banner;
        this.amount = banner.amount;
        this.message = "Choose where to start returning the favor (" + this.amount + ")";
    }

    execute() {
        super.execute();
        if (this.suit === undefined) return;

        let amount = this.amount;
        while (amount > 0) {
            const bank = this.game.favorBanks.get(this.suit);
            if (bank) {
                new MoveBankResourcesEffect(this.game, this.player, this.banner, bank.original, 1).do();
                amount--;
            }
            if (++this.suit > OathSuit.Nomad) this.suit = OathSuit.Discord;
        }
    }
}

export class TakeFavorFromBankAction extends ChooseSuit {
    readonly message: string;

    amount: number;

    constructor(player: OathPlayer, amount: number, suits?: Iterable<OathSuit>) {
        super(player, suits);
        this.amount = amount;
        this.message = "Take " + amount + " from a favor bank";
    }

    start(none?: string) {
        for (const suit of this.suits) {
            const bank = this.game.favorBanks.get(suit);
            if (bank && !bank.amount) this.suits.delete(suit);
        }
        return super.start(none);
    }

    execute() {
        super.execute();
        if (this.suit === undefined) return;
        new TakeResourcesFromBankEffect(this.game, this.player, this.game.favorBanks.get(this.suit), this.amount).do();
    }
}

export class PeoplesFavorWakeAction extends ChooseSuit {
    readonly message = "Put or return favor";
    readonly banner: PeoplesFavor;

    constructor(player: OathPlayer, banner: PeoplesFavor) {
        super(player);
        this.banner = banner;
    }

    start() {
        if (this.banner.amount > 1) {
            let min = Infinity;
            for (const bank of this.game.favorBanks.values()) if (bank.amount < min) min = bank.amount;
            for (const [suit, bank] of this.game.favorBanks) if (bank.amount === min) this.suits.add(suit);
        }
        
        return super.start("Put favor");
    }

    execute(): void {
        super.execute();
        const bank = this.suit !== undefined && this.game.favorBanks.get(this.suit);

        if (bank)
            new MoveBankResourcesEffect(this.game, this.player, this.banner, bank, 1).do();
        else
            new PutResourcesIntoBankEffect(this.game, this.player, this.banner, 1).do();

        if (this.banner.amount >= 6)
            new SetPeoplesFavorMobState(this.game, this.player, this.banner, true).do();
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
        for (const [resource, value] of this.source.resources)
            if (value > 0) choices.set(OathResourceName[resource], resource);
        this.selects.resource = new SelectNOf("Resource", choices, 1);
        return super.start();
    }

    execute(): void {
        const resource = this.parameters.resource[0];
        if (resource === undefined) return;
        new MoveResourcesToTargetEffect(this.game, this.player, resource, 1, this.player, this.source).do();   
    }
}


export abstract class ChoosePlayer extends OathAction {
    readonly selects: { player: SelectNOf<OathPlayer | undefined> };
    readonly parameters: { player: (OathPlayer | undefined)[] };
    readonly canChooseSelf = false;

    players: Set<OathPlayer>;
    target: OathPlayer | undefined;

    constructor(player: OathPlayer, players?: Iterable<OathPlayer>) {
        super(player);
        this.players = players ? new Set(players) : new Set(Object.values(this.game.players));
    }

    start(none?: string) {
        const choices = new Map<string, OathPlayer | undefined>();
        for (const player of this.players)
            if (player !== this.player || this.canChooseSelf)
                choices.set(player.name, player);
        if (none) choices.set(none, undefined);
        this.selects.player = new SelectNOf("Player", choices, 1);

        return super.start();
    }

    execute(): void {
        this.target = this.parameters.player[0];
    }
}

export class TakeResourceFromPlayerAction extends ChoosePlayer {
    readonly message: string;

    resource: OathResource;
    amount: number;

    constructor(player: OathPlayer, resource: OathResource, amount: number, players?: Iterable<OathPlayer>) {
        super(player, players);
        this.resource = resource;
        this.amount = amount || 1;
        this.message = `Take ${amount} ${OathResourceName[resource]}(s) from a player`
    }
    
    execute() {
        super.execute();
        if (!this.target) return;

        // TODO: Where should this check be?
        if (this.resource === OathResource.Secret && this.target.getResources(OathResource.Secret) <= 1) return;
        new MoveResourcesToTargetEffect(this.game, this.player, this.resource, this.amount, this.player, this.target).do();
    }
}

export class PiedPiperAction extends TakeResourceFromPlayerAction {
    card: Denizen;

    constructor(player: OathPlayer, card: Denizen, players?: Iterable<OathPlayer>) {
        super(player, OathResource.Favor, 2, players);
        this.card = card;
    }
    
    execute() {
        super.execute();
        if (!this.target) return;
        const adviser = new MoveAdviserEffect(this.player, this.card).do();
        new MoveWorldCardToAdvisersEffect(this.game, this.player, adviser, this.target).do();
    }
}

export class ChooseNewOathkeeper extends ChoosePlayer {
    readonly message = "Choose the new Oathkeeper";

    execute(): void {
        super.execute();
        if (!this.target) return;
        new SetUsurperEffect(this.game, false).do();
        new SetNewOathkeeperEffect(this.target).do();
    }
}

export class ConspiracyAction extends ChoosePlayer {
    readonly message = "Choose a target for the Cosnpiracy";

    start() {
        return super.start("No one");
    }

    execute(): void {
        super.execute();
        if (!this.target) return;
        new ConspiracyStealAction(this.player, this.target).doNext();
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
        for (const relic of this.player.relics) choices.set(relic.name, relic);
        for (const banner of this.player.banners) choices.set(banner.name, banner);
        this.selects.taking = new SelectNOf("Target", choices, 1);
        return super.start();
    }

    execute(): void {
        const taking = this.parameters.taking[0];
        taking.seize(this.player);
    }
}

export class StartBindingExchangeAction extends ChoosePlayer {
    readonly message = "Start a binding exchange with another player";

    next: Constructor<MakeBindingExchangeOfferAction>;

    constructor(player: OathPlayer, next: Constructor<MakeBindingExchangeOfferAction>, players?: Iterable<OathPlayer>) {
        super(player, players);
        this.next = next;
    }

    execute(): void {
        super.execute();
        if (!this.target) return;
        new this.next(this.player, this.target, new this.next(this.target, this.player)).doNext();
    }
}

export class ExileCitizenAction extends ChoosePlayer {
    readonly message = "Exile a Citizen";

    constructor(player: OathPlayer) {
        const players = [];
        for (const citizen of Object.values(player.game.players))
            if (citizen instanceof Exile && citizen.isCitizen)
                players.push(citizen);
        
        super(player, players);
    }

    execute(): void {
        super.execute();
        if (!this.target) return;

        let amount = 5;
        const peoplesFavor = this.game.banners.get(BannerName.PeoplesFavor);
        if (this.player === this.game.oathkeeper) amount--;
        if (this.player === peoplesFavor?.owner) amount--;
        if (this.target === this.game.oathkeeper) amount++;
        if (this.target === peoplesFavor?.owner) amount++;

        if (!new PayCostToTargetEffect(this.game, this.player, new ResourceCost([[OathResource.Favor, amount]]), this.target).do())
            throw new InvalidActionResolution("Cannot pay resource cost");

        new BecomeExileEffect(this.target).do();
    }
}


export abstract class ChooseSite extends OathAction {
    readonly selects: { site: SelectNOf<Site | undefined> };
    readonly parameters: { site: (Site | undefined)[] };
    readonly canChooseCurrentSite: boolean = false;

    sites: Set<Site>;
    target: Site | undefined;

    constructor(player: OathPlayer, sites?: Iterable<Site>) {
        super(player);
        this.sites = new Set(sites);
    }

    start(none?: string) {
        if (!this.sites.size) this.sites = new Set([...this.game.board.sites()].filter(e => !e.facedown));

        const choices = new Map<string, Site | undefined>();
        if (none) choices.set(none, undefined);
        for (const site of this.sites)
            if (!(site === this.player.site && !this.canChooseCurrentSite))
                choices.set(site.name, site);
        this.selects.site = new SelectNOf("Site", choices, 1);

        return super.start();
    }

    execute(): void {
        this.target = this.parameters.site[0];
    }
}

export class ActAsIfAtSiteAction extends ChooseSite {
    readonly message = "Choose a site to act at";
    readonly autocompleteSelects = false;

    action: ModifiableAction;

    constructor(player: OathPlayer, action: ModifiableAction, sites?: Iterable<Site>) {
        super(player, sites);
        this.action = action;
    }

    execute(): void {
        super.execute();
        if (!this.target) return;
        this.action.playerProxy.site = this.action.maskProxyManager.get(this.target);

        // Allow the player to choose other new modifiers
        this.action.doNext();
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
        const values = [];
        for (let i = 0; i <= this.other.getResources(OathResource.Favor); i++) values.push(i);
        this.selects.favors = new SelectNumber("Favors", values);
        
        values.length = 0;
        for (let i = 0; i <= this.other.getResources(OathResource.Secret); i++) values.push(i);
        this.selects.secrets = new SelectNumber("Secrets", values);

        return super.start();
    }

    execute(): void {
        const favors = this.parameters.favors[0];
        const secrets = this.parameters.secrets[0];

        if (this.next) {
            this.effect.resourcesTaken.set(OathResource.Favor, favors);
            this.effect.resourcesTaken.set(OathResource.Secret, secrets);
            this.next.doNext();
        } else {
            this.effect.resourcesGiven.set(OathResource.Favor, favors);
            this.effect.resourcesGiven.set(OathResource.Secret, secrets);
            new AskForPermissionAction(this.other, () => this.effect.do(), "Complete the binding exchange?").doNext();
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
            for (const [i, relic] of this.game.chancellor.reliquary.relics.entries()) if (relic) values.push(i);
            this.selects.reliquaryRelic = new SelectNumber("Reliquary slot", values);
        }

        const choices = new Map<string, Relic | Banner>();
        for (const relic of this.other.relics) choices.set(relic.name, relic);
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
            this.effect.reliquaryIndex = this.parameters.reliquaryRelic[0];
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
        for (const [i, relic] of this.game.chancellor.reliquary.relics.entries()) if (relic) values.push(i);
        this.selects.index = new SelectNumber("Reliquary slot", values);
        return super.start();
    }

    execute(): void {
        const index = this.parameters.index[0];
        const relic = this.game.chancellor.reliquary.relics[index];
        if (relic) new PeekAtCardEffect(this.player, relic).do();
        new AskForPermissionAction(this.player, () => new TakeReliquaryRelicEffect(this.player, index).do(), "Take the relic?").doNext();
    }
}



////////////////////////////////////////////
//             END OF THE GAME            //
////////////////////////////////////////////
export class ChooseSuccessor extends OathAction {
    readonly selects: { successor: SelectNOf<OathPlayer> };
    readonly parameters: { successor: OathPlayer[] };
    readonly message = "Choose a Successor";

    candidates: Set<OathPlayer>;

    constructor(player: OathPlayer, candidates: Set<OathPlayer>) {
        super(player);
        this.candidates = candidates;
    }

    start(): boolean {
        const choices = new Map<string, OathPlayer>();
        for (const player of Object.values(this.candidates))
            if (player instanceof Exile && player.isCitizen)
                choices.set(player.name, player);
        this.selects.successor = new SelectNOf("Successor", choices);
        return super.start();
    }

    execute(): void {
        const successor = this.parameters.successor[0];
        new WinGameEffect(successor).do();
    }
}

export class VowOathAction extends OathAction {
    readonly selects: { oath: SelectNOf<OathType> };
    readonly parameters: { oath: OathType[] };
    readonly message = "Vow an Oath";

    start(): boolean {
        const choices = new Map<string, OathType>();
        if (this.player instanceof Exile && this.player.vision) {
            const oathType = this.player.vision.oath.type;
            choices.set(OathTypeName[oathType], oathType);
        } else {
            for (let i: OathType = 0; i < 4; i++)
                if (i !== this.game.oath.type)
                    choices.set(OathTypeName[i], i);
        }
        this.selects.oath = new SelectNOf("Oath", choices);
        return super.start();
    }

    execute(): void {
        // TODO: Put this in an effect
        const oathType = this.parameters.oath[0];
        this.game.oath = new OathTypeToOath[oathType](this.game);
    }
}

export class ChooseNewCitizensAction extends OathAction {
    readonly selects: { players: SelectNOf<OathPlayer> };
    readonly parameters: { players: OathPlayer[] };
    readonly message = "Propose Citizenship to other Exiles";

    start() {
        const choices = new Map<string, OathPlayer>();
        const players = new Set(Object.values(this.game.players).filter(e => !e.isImperial && e !== this.player));
        for (const player of players) choices.set(player.name, player);
        this.selects.players = new SelectNOf("Exile(s)", choices);
        return super.start();
    }

    execute(): void {
        const citizens = this.parameters.players;
        for (const player of Object.values(this.game.players))
            if (player instanceof Exile && player.isCitizen)
                new BecomeExileEffect(player).do();
        
        for (const citizen of citizens)
            new AskForPermissionAction(citizen, () => new BecomeCitizenEffect(citizen).do(), "Become a Citizen?").doNext();
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

export class AddCardsToWorldDeckAction extends ChooseSuit {
    readonly message = "Choose a suit to add to the World Deck";
    
    start(none?: string): boolean {
        let max = 0;
        for (let i: OathSuit = 0; i < 6; i++) {
            const count = this.player.adviserSuitCount(i);
            if (count >= max) {
                max = count;
                this.suits.clear();
                this.suits.add(i);
            } else if (count === max) {
                this.suits.add(i);
            }
        }

        return super.start(none);
    }

    getRandomCardDataInArchive(suit: OathSuit): string[] {
        const cardData: string[] = [];
        for (const [key, data] of Object.entries(this.game.archive))
            if (data[0] === suit) cardData.push(key);

        shuffleArray(cardData);
        return cardData;
    }

    execute(): void {
        super.execute();
        if (!this.suit) return;
        
        // Add cards from the archive
        const worldDeck = this.game.worldDeck;
        const worldDeckDiscardOptions = new DiscardOptions(worldDeck, false, true);
        for (let i = 3; i >= 1; i--) {
            const cardData = this.getRandomCardDataInArchive(this.suit);
            for (let j = 0; j < i; j++) {
                const key = cardData.pop();
                if (!key) break;
                const data = this.game.archive[key];
                if (!data) break;
                delete this.game.archive[key];

                new DiscardCardEffect(this.player, new Denizen(this.game, ...data), worldDeckDiscardOptions).do();
            }

            this.suit++;
            if (this.suit > OathSuit.Nomad) this.suit = OathSuit.Discord;
        }

        // Remove cards to the Dispossessed
        const firstDiscard = Object.values(this.game.board.regions)[0].discard;
        const firstDiscardOptions = new DiscardOptions(firstDiscard, false, true);
        for (const player of Object.values(this.game.players)) {
            let discardOptions = firstDiscardOptions;
            if (player === this.player) discardOptions = worldDeckDiscardOptions;
            new DiscardCardGroupEffect(this.player, player.advisers, discardOptions).do();
        }
        for (const region of Object.values(this.game.board.regions)) {
            const cards = new DrawFromDeckEffect(this.player, region.discard, region.discard.cards.length).do();
            new DiscardCardGroupEffect(this.player, cards, firstDiscardOptions).do();
        }

        firstDiscard.shuffle(); // TODO: Put this in effect
        for (let i = 0; i < 6; i++) {
            const cards = new DrawFromDeckEffect(this.player, firstDiscard, 1).do();
            if (!cards.length) break;
            const card = cards[0];

            if (!(card instanceof Denizen)) {
                new DiscardCardEffect(this.player, card, worldDeckDiscardOptions).do();
                continue;
            }
            this.game.dispossessed.push(card.data);
        }
        const cards = new DrawFromDeckEffect(this.player, firstDiscard, firstDiscard.cards.length).do();
        new DiscardCardGroupEffect(this.player, cards, worldDeckDiscardOptions).do();
        worldDeck.shuffle();

        // Rebuild the World Deck
        const visions: VisionBack[] = [];
        for (let i = worldDeck.cards.length - 1; i >= 0; i--) {
            const card = worldDeck.cards[i];
            if (card instanceof VisionBack) visions.push(worldDeck.cards.splice(i, 1)[0]);
        }

        const topPile = worldDeck.cards.splice(0, 10);
        topPile.push(...visions.splice(0, 2));
        do { shuffleArray(topPile); } while (topPile[0] instanceof VisionBack);
        const middlePile = worldDeck.cards.splice(0, 15);
        middlePile.push(...visions.splice(0, 3));
        shuffleArray(middlePile);

        for (const card of middlePile.reverse()) worldDeck.putCard(card);
        for (const card of topPile.reverse()) worldDeck.putCard(card);
    }
}