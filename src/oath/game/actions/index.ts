import type { ParametersType } from "./base";
import { OathAction } from "./base";
import type { OathCard, Relic, WorldCard } from "../model/cards";
import { Denizen, Edifice, Site } from "../model/cards";
import type { SearchableDeck } from "../model/decks";
import { DiscardOptions } from "../model/decks";
import { AttackDieSymbol } from "../dice";
import { TransferResourcesEffect, PlayWorldCardEffect, PutPawnAtSiteEffect, DiscardCardEffect, MoveOwnWarbandsEffect, SetPeoplesFavorMobState, ChangePhaseEffect, NextTurnEffect, SetUsurperEffect, BecomeCitizenEffect, BecomeExileEffect, BuildEdificeFromDenizenEffect, WinGameEffect, FlipEdificeEffect, BindingExchangeEffect, CitizenshipOfferEffect, PeekAtCardEffect, TakeReliquaryRelicEffect, CheckCapacityEffect, CampaignJoinDefenderAlliesEffect, MoveWorldCardToAdvisersEffect, DiscardCardGroupEffect, ParentToTargetEffect, PaySupplyEffect, ThingsExchangeOfferEffect, SiteExchangeOfferEffect, SearchDrawEffect, RecoverTargetEffect, ReturnResourcesEffect, FlipSecretsEffect, GainSupplyEffect, SeizeTargetEffect, ReturnAllResourcesEffect, PutResourcesOnTargetEffect } from "./effects";
import { ALL_OATH_SUITS, ALL_PLAYER_COLORS, CardRestriction, OathPhase, OathSuit, OathType, PlayerColor } from "../enums";
import { ChancellorBoard, ExileBoard, OathPlayer, VisionSlot } from "../model/player";
import type { OathResource, OathResourceType, ResourcesAndWarbands} from "../model/resources";
import { Favor, Secret } from "../model/resources";
import type { CostContext} from "../costs";
import { ResourceCost, ResourceTransferContext, SupplyCost, SupplyCostContext } from "../costs";
import type { Banner, PeoplesFavor } from "../model/banks";
import { FavorBank } from "../model/banks";
import type { Constructor} from "../utils";
import { inclusiveRange, minInGroup, NumberMap } from "../utils";
import { SelectNOf, SelectBoolean, SelectNumber, SelectWithName, SelectCard } from "./selects";
import type { CampaignActionTarget, RecoverActionTarget, WithCostContexts } from "../model/interfaces";
import type { Region } from "../model/map";
import type { OathGameObject } from "../model/gameObject";
import type { ExileColor } from "../parser/interfaces";
import { Citizenship } from "../parser/interfaces";
import type { CampaignEndCallback } from "./utils";
import { CampaignResult, cannotPayError, InvalidActionResolution } from "./utils";
import type { OathActionManager } from "./manager";
import type { NodeGroup } from "../model/utils";



////////////////////////////////////////////
//                 SETUP                  //
////////////////////////////////////////////
export class SetupChoosePlayerBoardAction extends OathAction {
    declare readonly selects: { color: SelectNOf<PlayerColor> };
    readonly message = "Choose a board to start with";

    start(): boolean {
        const colors = new Set(ALL_PLAYER_COLORS);
        for (const player of this.game.players)
            if (player.board)
                colors.delete(player.board.key);
        const choices = [...colors].map<[string, PlayerColor]>((e) => [e + (e !== PlayerColor.Purple && this.game.oldCitizenship[e] === Citizenship.Citizen ? " (Citizen)" : ""), e]);
        this.selects.color = new SelectNOf("Color", choices, { min: 1 });

        return super.start();
    }

    execute(): void {
        const color = this.parameters.color[0]!;
        if (color === PlayerColor.Purple) {
            this.player.addChild(new ChancellorBoard());
        } else {
            const board = this.player.addChild(new ExileBoard(color));
            board.addChild(new VisionSlot(color));
            board.isCitizen = this.game.oldCitizenship[color as ExileColor] === Citizenship.Citizen;
        }
    }
}

export class SetupChooseAdviserAction extends OathAction {
    declare readonly selects: { card: SelectCard<WorldCard> };
    readonly message = "Choose a card to start with";

    cards: WorldCard[];

    constructor(actionManager: OathActionManager, player: OathPlayer, cards: Iterable<WorldCard>) {
        super(actionManager, player);
        this.cards = [...cards];
    }

    start(): boolean {
        this.selects.card = new SelectCard("Card", this.player, this.cards, { min: 1 });
        return super.start();
    }

    execute(): void {
        const card = this.parameters.card[0];
        if (!card) return;
        new MoveWorldCardToAdvisersEffect(this.actionManager, this.player, card).doNext();
        new DiscardCardGroupEffect(this.actionManager, this.player, this.cards.filter((e) => e !== card)).doNext();
    }
}



////////////////////////////////////////////
//              MAJOR ACTIONS             //
////////////////////////////////////////////
export abstract class MajorAction extends OathAction implements WithCostContexts {
    readonly autocompleteSelects: boolean = false;
    abstract supplyCost: SupplyCost;

    get costContexts(): CostContext<any>[] { return [new SupplyCostContext(this.player, this, this.supplyCost)]; }

    execute() {
        new PaySupplyEffect(this.actionManager, this.costContexts[0]!).doNext((success) => {
            if (!success) throw new InvalidActionResolution(`Cannot pay Supply cost (${this.supplyCost.amount}).`);
            this.majorAction();
        });
    }

    abstract majorAction(): void;
}

export abstract class PayDenizenAction extends MajorAction {
    declare readonly selects: { cardProxy: SelectCard<Denizen> };

    accessibleDenizenProxies: Denizen[] = [];
    cardProxy: Denizen;
    
    readonly abstract cost: ResourceCost;

    get costContexts() { return [...super.costContexts, this.resourceCost]; }
    get resourceCost() { return new ResourceTransferContext(this.player, this, this.cost, this.cardProxy.original); }

    validateCardProxies(cardProxies: Denizen[]) {
        // validCardProxies = validCardProxies.filter((e) => new ResourceTransferContext(this.player, this, this.cost, e.original).payableCostsWithModifiers(this.maskProxyManager).length);
        return cardProxies.filter((e) => e.suit !== OathSuit.None && e.empty);
    }
    
    start() {
        this.accessibleDenizenProxies.push(...this.playerProxy.site.denizens);
        const validCardProxies = this.validateCardProxies(this.accessibleDenizenProxies);
        this.selects.cardProxy = new SelectCard("Card", this.player, validCardProxies, { min: 1 });
        return super.start();
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        super.applyParameters(values);
        this.cardProxy = this.parameters.cardProxy[0]!;
    }

    majorAction(): void {
        new TransferResourcesEffect(this.actionManager, this.resourceCost).doNext((success) => {
            if (!success) throw cannotPayError(this.cost);
            this.getReward();
        });
    }

    abstract getReward(): void;
}

export class MusterAction extends PayDenizenAction {
    readonly message = "Put a favor on a card to muster";
    supplyCost = new SupplyCost(1);

    readonly cost = new ResourceCost([[Favor, 1]]);
    getting = 2;

    getReward() {
        new ParentToTargetEffect(this.actionManager, this.player, this.playerProxy.leader.original.bag.get(this.getting)).doNext();
    }
}

export abstract class TradeAction extends PayDenizenAction {
    declare readonly selects: PayDenizenAction["selects"] & { forFavor: SelectBoolean };
    readonly message = "Put resources on a card to trade";
    supplyCost = new SupplyCost(1);

    readonly abstract getting: NumberMap<OathResourceType>;

    getReward() {
        for (const [resource, amount] of this.getting) {
            this.getting.set(resource, amount + this.playerProxy.suitAdviserCount(this.cardProxy.suit));
        }
    }
}
export class TradeForFavorAction extends TradeAction {
    readonly cost = new ResourceCost([[Secret, 1]]);
    readonly getting = new NumberMap([[Favor, 1]]);

    getReward(): void {
        super.getReward();
        const bank = this.gameProxy.favorBank(this.cardProxy.suit)?.original;
        if (bank)
            new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.player, this, new ResourceCost(this.getting), this.player, bank)).doNext();
    }
}
export class TradeForSecretAction extends TradeAction {
    readonly cost = new ResourceCost([[Favor, 2]]);
    readonly getting = new NumberMap([[Secret, 0]]);

    getReward(): void {
        super.getReward();
        new PutResourcesOnTargetEffect(this.actionManager, this.player, Secret, this.getting.get(Secret)).doNext();
    }
}


export class TravelAction extends MajorAction {
    declare readonly selects: { siteProxy: SelectCard<Site> };
    readonly message: string = "Travel to a site";
    readonly autocompleteSelects: boolean;

    supplyCost: SupplyCost;
    travelling: OathPlayer;
    choosing: OathPlayer;
    siteProxy: Site;
    restriction: (s: Site) => boolean;

    constructor(actionManager: OathActionManager, travelling: OathPlayer, choosing: OathPlayer = travelling, restriction?: (site: Site) => boolean) {
        super(actionManager, travelling);
        this.autocompleteSelects = !!restriction;
        this.restriction = restriction ?? ((_: Site) => true);
        this.choosing = choosing;
        this.travelling = travelling;
    }

    start() {
        this.player = this.choosing;
        this.selects.siteProxy = new SelectCard("Site", this.player, [...this.gameProxy.map.sites()].filter((e) => e !== this.maskProxyManager.get(this.travelling.site) && this.restriction(e.original)), { min: 1 });
        return super.start();
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        super.applyParameters(values)
        this.siteProxy = this.parameters.siteProxy[0]!;
        this.player = this.travelling;

        const fromRegionKey = this.playerProxy.site.region?.key;
        const toRegionKey = this.siteProxy.region?.key;
        if (fromRegionKey !== undefined && toRegionKey !== undefined)
            this.supplyCost = new SupplyCost(this.gameProxy.map.travelCosts.get(fromRegionKey)?.get(toRegionKey) ?? 2);
        else
            this.supplyCost = new SupplyCost(2);
    }

    majorAction() {
        new PutPawnAtSiteEffect(this.actionManager, this.player, this.siteProxy.original).doNext();
    }
}


export class RecoverAction extends MajorAction {
    declare readonly selects: { targetProxy: SelectWithName<OathGameObject & RecoverActionTarget> };
    readonly message = "Choose a target to recover";
    supplyCost = new SupplyCost(1);

    targetProxy: RecoverActionTarget;

    start() {
        this.selects.targetProxy = new SelectWithName("Target", [...this.playerProxy.site.relics, ...this.gameProxy.banners.values()].filter((e) => e.canRecover(this)), { min: 1 });
        return super.start();
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        super.applyParameters(values);
        this.targetProxy = this.parameters.targetProxy[0]!;
    }

    majorAction() {
        new RecoverTargetEffect(this.actionManager, this.player, this.targetProxy.original).doNext();
    }
}

export class RecoverBannerPitchAction extends OathAction {
    declare readonly selects: { amount: SelectNumber };
    readonly message = "Put resources onto the banner";

    banner: Banner;
    amount: number;

    constructor(actionManager: OathActionManager, player: OathPlayer, banner: Banner) {
        super(actionManager, player);
        this.banner = banner;
    }

    start() {
        this.selects.amount = new SelectNumber("Amount", inclusiveRange(this.banner.amount + 1, this.player.byClass(this.banner.cls).length));
        return super.start();
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        super.applyParameters(values);
        this.amount = this.parameters.amount[0]!;
    }

    execute() {
        new ParentToTargetEffect(this.actionManager, this.player, this.player.byClass(this.banner.cls).max(this.amount), this.banner).doNext();
    }
}


export class SearchAction extends MajorAction {
    declare readonly selects: { deckProxy: SelectWithName<SearchableDeck> };
    readonly message = "Draw 3 cards from a deck";

    supplyCost: SupplyCost;
    deckProxy: SearchableDeck;
    amount = 3;
    fromBottom = false;
    cards: Set<WorldCard>;
    discardOptions = this.player.discardOptions;

    start() {
        const choices: SearchableDeck[] = [this.gameProxy.worldDeck];
        const region = this.playerProxy.site.region;
        if (region) choices.push(region.discard);
        this.selects.deckProxy = new SelectWithName("Deck", choices, { min: 1 });
        return super.start();
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        super.applyParameters(values);
        this.deckProxy = this.parameters.deckProxy[0]!;
        this.supplyCost = new SupplyCost(this.deckProxy.searchCost);
    }

    majorAction() {
        new SearchDrawEffect(this.actionManager, this.player, this.deckProxy.original, this.amount, this.fromBottom).doNext((cards) => {
            this.cards = new Set(cards);
            new SearchChooseAction(this.actionManager, this.player, this.cards, this.discardOptions).doNext();
        });
    }
}

export class SearchChooseAction extends OathAction {
    declare readonly selects: { cards: SelectCard<WorldCard> };
    readonly message = "Choose which card(s) to keep";

    cards: Set<WorldCard>;
    playing: WorldCard[];  // For this action, order is important
    playingAmount: number;
    discardOptions: DiscardOptions<OathCard>;

    playActions: SearchPlayOrDiscardAction[] = [];

    constructor(actionManager: OathActionManager, player: OathPlayer, cards: Iterable<WorldCard>, discardOptions?: DiscardOptions<OathCard>, amount: number = 1) {
        super(actionManager, player);
        this.discardOptions = discardOptions ?? this.player.discardOptions;
        this.cards = new Set(cards);
        this.playingAmount = Math.min(amount, this.cards.size);
    }

    start() {
        this.selects.cards = new SelectCard("Card(s)", this.player, this.cards, { min: 1, max: this.playingAmount });
        return super.start();
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        super.applyParameters(values);
        this.playing = this.parameters.cards;
    }

    execute(): void {
        const discarding = new Set(this.cards);
        for (const card of this.playing) discarding.delete(card);
        new SearchDiscardAction(this.actionManager, this.player, discarding, Infinity, this.discardOptions).doNext();
        
        for (const card of this.playing) {
            const playAction = new SearchPlayOrDiscardAction(this.actionManager, this.player, card.original, this.discardOptions);
            this.playActions.push(playAction);
            playAction.doNext();
        }
    }
}

export class SearchDiscardAction extends OathAction {
    declare readonly selects: { cards: SelectCard<WorldCard> };
    readonly autocompleteSelects = false;  // What's important is the order
    readonly message = "Choose and order the discards";

    cards: Set<WorldCard>;
    discarding: WorldCard[];  // For this action, order is important
    amount: number;
    discardOptions: DiscardOptions<OathCard>;

    constructor(actionManager: OathActionManager, player: OathPlayer, cards: Iterable<WorldCard>, amount?: number, discardOptions?: DiscardOptions<OathCard>) {
        super(actionManager, player);
        this.cards = new Set(cards);
        this.amount = Math.min(this.cards.size, amount ?? this.cards.size);
        this.discardOptions = discardOptions ?? this.player.discardOptions;
    }

    start() {
        this.selects.cards = new SelectCard("Card(s)", this.player, this.cards, { min: this.amount });
        return super.start();
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        super.applyParameters(values);
        this.discarding = this.parameters.cards;
    }

    execute(): void {
        for (const card of this.discarding)
            new DiscardCardEffect(this.actionManager, this.player, card, this.discardOptions).doNext();
    }
}

/** Number of available slots, Cards that don't count towards capacity, Is the card played ignoring capacity */
export type CapacityInformation = { capacity: number, takesSpaceInTargetProxies: NodeGroup<WorldCard>, ignoresCapacity: boolean };
export class SearchPlayOrDiscardAction extends OathAction {
    declare readonly selects: { choice: SelectNOf<Site | boolean | undefined>}
    readonly message: string;
    
    cardProxy: WorldCard;
    siteProxy: Site | undefined;
    facedown: boolean;
    discardOptions: DiscardOptions<OathCard>;
    canReplace: boolean;
    capacityInformation: CapacityInformation;

    constructor(actionManager: OathActionManager, player: OathPlayer, card: WorldCard, discardOptions?: DiscardOptions<OathCard>) {
        super(actionManager, player);
        this.cardProxy = this.maskProxyManager.get(card);
        this.message = "Play or discard " + this.cardProxy.name;
        this.discardOptions = discardOptions ?? this.player.discardOptions;
    }

    start() {
        const siteProxiesChoice = new Map<string, Site | boolean | undefined>();
        if (!(this.cardProxy instanceof Denizen && this.cardProxy.restriction === CardRestriction.Site))
            siteProxiesChoice.set("Faceup adviser", false);
        siteProxiesChoice.set("Facedown adviser", true);
        if (this.cardProxy instanceof Denizen && this.cardProxy.restriction !== CardRestriction.Adviser)
            siteProxiesChoice.set(this.playerProxy.site.name, this.playerProxy.site);
        siteProxiesChoice.set("Discard", undefined);
        this.selects.choice = new SelectNOf("Choice", siteProxiesChoice, { min: 1 });

        return super.start();
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        super.applyParameters(values);
        const choice = this.parameters.choice[0];
        this.siteProxy = typeof choice === "boolean" ? undefined : choice;
        this.facedown = typeof choice === "boolean" ? choice : false;
        this.canReplace ??= this.siteProxy === undefined;
    }

    get targetProxy() {
        return this.siteProxy?.denizens ?? this.playerProxy.advisers;
    }

    execute() {
        if (this.parameters.choice[0] === undefined) {
            new DiscardCardEffect(this.actionManager, this.player, this.cardProxy.original, this.discardOptions).doNext();
            return;
        }

        this.cardProxy.facedown = this.facedown;  // Editing the copy to reflect the new state; TODO: Is this necessary?
        const { capacity, takesSpaceInTargetProxies, ignoresCapacity } = this.capacityInformation;
        const excess = Math.max(0, takesSpaceInTargetProxies.length - capacity + 1);  // +1 because we are playing a card there
        const discardable = takesSpaceInTargetProxies.filter((e) => !(e instanceof Denizen && e.activelyLocked)).map((e) => e.original);

        if (!ignoresCapacity && excess)
            if (!this.canReplace || excess > discardable.length)
                throw new InvalidActionResolution("Target is full and cards there cannot be replaced");
            else
                new SearchDiscardAction(this.actionManager, this.player, discardable, excess, this.discardOptions).doNext();
        
        new PlayWorldCardEffect(this.actionManager, this.player, this.cardProxy.original, this.facedown, this.siteProxy?.original).doNext();
        new CheckCapacityEffect(this.actionManager, this.player, [this.siteProxy?.original ?? this.player], this.discardOptions).doNext();
    }
}

export class MayDiscardACardAction extends OathAction {
    declare readonly selects: { card: SelectCard<Denizen> };
    readonly message = "You may discard a card";

    cards: Set<Denizen>;
    discardOptions: DiscardOptions<OathCard>;

    constructor(actionManager: OathActionManager, player: OathPlayer, discardOptions?: DiscardOptions<OathCard>, cards?: Iterable<Denizen>) {
        super(actionManager, player);
        this.discardOptions = discardOptions ?? this.player.discardOptions;
        if (cards) {
            this.cards = new Set(cards);
        } else {
            this.cards = new Set();
            if (this.player.site.region)
                for (const site of this.player.site.region.sites)
                    for (const denizen of site.denizens)
                        if (!denizen.activelyLocked) this.cards.add(denizen);
        }
    }

    start() {
        this.selects.card = new SelectCard("Card", this.player, this.cards, { min: 0, max: 1 });
        return super.start();
    }

    execute(): void {
        const card = this.parameters.card[0]!;
        if (!card) return;
        new DiscardCardEffect(this.actionManager, this.player, card, this.discardOptions).doNext();
    }
}


export class CampaignAction extends MajorAction {
    declare readonly selects: { defenderProxy: SelectNOf<OathPlayer | undefined> };
    readonly message = "Choose a defender";
    supplyCost = new SupplyCost(2);

    defenderProxy: OathPlayer | undefined;

    start() {
        const choices = new Map<string, OathPlayer | undefined>();
        for (const playerProxy of this.gameProxy.players)
            if (playerProxy !== this.playerProxy && this.playerProxy.site === playerProxy.site)
                choices.set(playerProxy.name, playerProxy);
        
        const siteRulerProxy = this.playerProxy.site.ruler;
        choices.set(siteRulerProxy?.name ?? "Bandits", siteRulerProxy);
        this.selects.defenderProxy = new SelectNOf("Defender", choices, { min: 1 });
        return super.start();
    }

    execute() {
        this.defenderProxy = this.parameters.defenderProxy[0];
        super.execute();
    }

    majorAction() {
        const next = new CampaignAttackAction(this.actionManager, this.player, this.defenderProxy?.original);
        if (this.defenderProxy?.isImperial)
            new CampaignJoinDefenderAlliesEffect(this.actionManager, next.campaignResult, this.gameProxy.chancellor.original).doNext();
        next.doNext();
    }
}

export class CampaignAttackAction extends OathAction {
    declare readonly selects: { targetProxies: SelectNOf<CampaignActionTarget>, pool: SelectNumber };
    readonly next: CampaignDefenseAction;
    readonly message = "Choose targets and attack pool";

    constructor(actionManager: OathActionManager, player: OathPlayer, defender: OathPlayer | undefined) {
        super(actionManager, player);
        this.next = new CampaignDefenseAction(actionManager, defender ?? player, player);
        this.campaignResult.attacker = player;
        this.campaignResult.defender = defender;
        // Generally unadvised, but since those actions work so closely together, it's better to merge
        // their MaskProxyManager so modifiers can modify the proxy across the entire chain
        this.maskProxyManager = this.next.maskProxyManager;
        this.campaignResult.checkForImperialInfighting(this.maskProxyManager);
    }

    get campaignResult() { return this.next.campaignResult; }
    get campaignResultProxy() { return this.next.campaignResultProxy; }
    get defender() { return this.campaignResult.defender; }
    get defenderProxy() { return this.campaignResultProxy.defender; }

    start() {
        const choices = new Map<string, CampaignActionTarget>();
        for (const siteProxy of this.gameProxy.map.sites()) { 
            if (!siteProxy.facedown && siteProxy.ruler === this.defenderProxy?.leader) {
                if (this.playerProxy.site === siteProxy) {
                    this.campaignResult.targets.add(siteProxy.original);
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
        this.selects.targetProxies = new SelectNOf("Target(s)", choices, { min: 1 - this.campaignResult.targets.size, max: choices.size });

        this.selects.pool = new SelectNumber("Attack pool", inclusiveRange(this.playerProxy.warbands.length));
        
        return super.start();
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        super.applyParameters(values);
        for (const targetProxy of this.parameters.targetProxies) this.campaignResult.targets.add(targetProxy.original);
        this.campaignResult.atkPool = this.parameters.pool[0]!;
        this.campaignResult.defPool = 0;

        const allyProxiesCandidates = new Set<OathPlayer>();
        for (const target of this.campaignResult.targets) {
            const targetProxy = this.maskProxyManager.get(target);
            this.campaignResult.defPool += targetProxy.defense;
            
            for (const playerProxy of this.gameProxy.players) {
                const siteProxy = targetProxy instanceof Site ? targetProxy : this.playerProxy.site;
                if (playerProxy.site === siteProxy)
                    allyProxiesCandidates.add(playerProxy);
            }
        }

        for (const allyProxy of allyProxiesCandidates) {
            const ally = allyProxy.original;
            console.log("Trying allying with", ally.name);
            if (!this.campaignResult.defenderAllies.has(ally) && allyProxy.leader === this.defenderProxy?.leader)
                new MakeDecisionAction(
                    this.actionManager, ally, "Join as an Imperial Ally?",
                    () => new CampaignJoinDefenderAlliesEffect(this.actionManager, this.campaignResult, ally).doNext()
                ).doNext();
        }
    }

    execute() {
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

        this.next.doNext();
        // Bandits use all battle plans that are free
        // const modifiers: ActionModifier<WithPowers, CampaignDefenseAction>[] = [];
        // for (const modifier of this.game.gatherActionModifiers(this.next, this.player)) {
        //     if (modifier.mustUse || modifier.cost.free)
        //         modifiers.push(modifier);
        // }

        // If any powers cost something, then the attacker pays. Shouldn't happen though
        // if (this.next.applyModifiers(modifiers)) {
        //     this.next.doNextWithoutModifiers();
        // }
    }
}

export class CampaignDefenseAction extends OathAction {
    readonly next: CampaignEndAction;
    readonly message = "";

    constructor(actionManager: OathActionManager, player: OathPlayer, attacker: OathPlayer) {
        super(actionManager, player);
        this.next = new CampaignEndAction(actionManager, attacker);
        this.maskProxyManager = this.next.maskProxyManager;
        // Not needed to do it anymore since the MaskProxyManagers are merged
        // this.campaignResult.checkForImperialInfighting(this.maskProxyManager);
    }

    get campaignResult() { return this.next.campaignResult; }
    get campaignResultProxy() { return this.next.campaignResultProxy; }

    // doNext(): void {
        // let next = new ChooseModifiers(actionManager, this);
        // for (const ally of this.campaignResult.defenderAllies) 
        //     if (ally !== this.player)
        //         next = new ChooseModifiers(next, ally);
        // next.doNext();
    // }
    
    execute() {
        this.campaignResult.resolve(() => {
            this.campaignResult.successful = this.campaignResult.atk > this.campaignResult.def;
            
            if (!this.campaignResult.ignoreKilling)
                this.campaignResult.attackerKills(this.campaignResult.atkRoll.get(AttackDieSymbol.Skull));
        });
        this.next.doNext();
    }
}

export class CampaignEndAction extends OathAction {
    declare readonly selects: { doSacrifice: SelectBoolean, callbacks: SelectWithName<CampaignEndCallback> };
    readonly message = "Handle the end of the campaign";

    campaignResult = new CampaignResult(this.actionManager);
    campaignResultProxy = this.maskProxyManager.get(this.campaignResult);
    doSacrifice: boolean;

    constructor(actionManager: OathActionManager, player: OathPlayer) {
        super(actionManager, player);
        this.campaignResult.checkForImperialInfighting(this.maskProxyManager);
    }

    start() {
        if (this.campaignResultProxy.couldSacrifice) {
            this.selects.doSacrifice = new SelectBoolean("Sacrifice needed", [`Sacrifice ${this.campaignResultProxy.requiredSacrifice} warbands`, "Abandon"]);
        } else {
            // Unfortunately the magic trick I use to get typed parameters makes assignment tricky
            this.parameters.doSacrifice = [false as any];
        }

        const callbacksToOrder = this.campaignResult.endCallbacks.filter((e) => !e.orderAgnostic);
        this.selects.callbacks = new SelectWithName("Order effects", callbacksToOrder, { min: callbacksToOrder.length });

        return super.start();
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        super.applyParameters(values);
        this.doSacrifice = this.parameters.doSacrifice[0]!;
        this.campaignResult.endCallbacks = [...this.parameters.callbacks, ...this.campaignResult.endCallbacks.filter((e) => e.orderAgnostic)];
    }

    execute() {
        if (this.doSacrifice) {
            this.campaignResult.attackerKills(this.campaignResultProxy.requiredSacrifice);
            this.campaignResult.successful = true;
        }

        if (this.campaignResult.loser && !this.campaignResult.ignoreKilling && !this.campaignResult.loserKillsNoWarbands)
            this.campaignResult.loserKills(Math.floor(this.campaignResultProxy.loserTotalForce / (this.campaignResult.loserKillsEntireForce ? 1 : 2)));

        if (this.campaignResult.successful)
            for (const target of this.campaignResult.targets)
                new SeizeTargetEffect(this.actionManager, this.campaignResult.attacker, target).doNext();

        for (const callback of this.campaignResult.endCallbacks)
            callback.resolve();

        console.log(this.campaignResult);
    }
}

export class CampaignKillWarbandsInForceAction extends OathAction {
    readonly selects: Record<string, SelectNumber> = {};
    readonly message;

    result: CampaignResult;
    owner: OathPlayer | undefined;
    force: Set<ResourcesAndWarbands>;
    attacker: boolean;
    amount: number;

    constructor(actionManager: OathActionManager, result: CampaignResult, attacker: boolean, amount: number) {
        super(actionManager, attacker ? result.attacker.leader : result.defender?.leader ?? result.attacker.leader);
        this.message = `Kill ${amount} warbands`;
        this.result = result;
        this.owner = attacker ? result.attacker.leader : result.defender?.leader;
        this.force = attacker ? result.atkForce : result.defForce;
        this.attacker = attacker;
        this.amount = Math.min(attacker ? result.totalAtkForce : result.totalDefForce, amount);
    }

    start(): boolean {
        if (this.owner) {
            const sources: [string, number][] = [...this.force].map((e) => [e.name, e.getWarbandsAmount(this.owner?.board.key)]);
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
            const warbands = source.getWarbands(this.owner.leader.board.key, this.parameters[source.name]![0]);
            new ParentToTargetEffect(this.actionManager, this.player, warbands, this.owner.leader.bag).doNext();
            if (this.attacker)
                this.result.attackerLoss += warbands.length;
            else
                this.result.defenderLoss += warbands.length;
        }
    }
}

export class CampaignBanishPlayerAction extends TravelAction {
    readonly message: string;
    noSupplyCost = true;

    constructor(actionManager: OathActionManager, player: OathPlayer, banished: OathPlayer) {
        super(actionManager, banished, player);
        this.message = "Choose where to banish " + banished.name;
    }
}

export class CampaignSeizeSiteAction extends OathAction {
    declare readonly selects: { amount: SelectNumber };
    readonly message: string;
    readonly autocompleteSelects = false;
    
    site: Site;

    constructor(actionManager: OathActionManager, player: OathPlayer, site: Site) {
        super(actionManager, player);
        this.site = site;
        this.message = "Choose how many warbands to move to " + site.visualName(player);
    }

    start() {
        this.selects.amount = new SelectNumber("Amount", inclusiveRange(this.player.getWarbandsAmount(this.player.leader.board.key)));
        return super.start();
    }

    execute() {
        new MoveOwnWarbandsEffect(this.actionManager, this.player.leader, this.player, this.site, this.parameters.amount[0]!).doNext();
    }
}


export class WakeAction extends OathAction {
    readonly message = "";

    execute(): void {
        if (this.gameProxy.oathkeeper === this.playerProxy && !this.playerProxy.isImperial)
            if (this.gameProxy.isUsurper)
                return new WinGameEffect(this.actionManager, this.player).doNext();
            else
                new SetUsurperEffect(this.actionManager, true).doNext();
        
        if (this.playerProxy.board instanceof ExileBoard && this.playerProxy.board.vision && this.gameProxy.worldDeck.visionsDrawn >= 3) {
            const candidates = this.playerProxy.board.vision.oath.getOathkeeperCandidates();
            if (candidates.size === 1 && candidates.has(this.playerProxy))
                return new WinGameEffect(this.actionManager, this.player).doNext();
        }
        
        new ChangePhaseEffect(this.actionManager, OathPhase.Act).doNext();
    }
}


export class RestAction extends OathAction {
    readonly message = "";
    
    execute(): void {
        new ChangePhaseEffect(this.actionManager, OathPhase.Rest).doNext();
        new ReturnAllResourcesEffect(this.actionManager).doNext()
        new GainSupplyEffect(this.actionManager, this.player, this.player.board.restAmount).doNext();
        new NextTurnEffect(this.actionManager).doNext();
    }
}


////////////////////////////////////////////
//              MINOR ACTIONS             //
////////////////////////////////////////////
export class PlayFacedownAdviserAction extends OathAction {
    declare readonly selects: { cardProxies: SelectCard<WorldCard> }
    readonly message = "Choose an adviser to play";

    cardProxies: Set<WorldCard>;
    playing: WorldCard;

    start() {
        this.cardProxies = new Set([...this.playerProxy.advisers].filter((e) => e.facedown));
        this.selects.cardProxies = new SelectCard("Adviser", this.player, this.cardProxies, { min: 1 });
        return super.start();
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        super.applyParameters(values);
        this.playing = this.parameters.cardProxies[0]!.original;
    }

    execute(): void {
        this.playing.prune();  // Otherwise capacity calculations count the card twice
        new SearchPlayOrDiscardAction(this.actionManager, this.player, this.playing).doNext();
    }
}


export class MoveWarbandsAction extends OathAction {
    declare readonly selects: { targetProxy: SelectWithName<Site | OathPlayer>, amount: SelectNumber, giving: SelectBoolean };
    readonly message = "Give or take warbands";

    targetProxy: Site | OathPlayer;
    amount: number;
    giving: boolean;

    start(): boolean {
        const choices = new Set<Site | OathPlayer>();
        const siteProxy = this.playerProxy.site;
        let max = this.player.getWarbandsAmount(this.playerProxy.leader.board.original.key);
        if (this.playerProxy.isImperial) {
            for (const playerProxy of this.gameProxy.players) {
                if (playerProxy !== this.playerProxy && playerProxy.isImperial && playerProxy.site === siteProxy) {
                    choices.add(playerProxy);
                    max = Math.max(max, playerProxy.original.getWarbandsAmount(playerProxy.leader.board.original.key));
                }
            }
        }
        const siteAmount = siteProxy.original.getWarbandsAmount(this.playerProxy.leader.board.original.key);
        if (siteAmount > 0) {
            choices.add(siteProxy);
            max = Math.max(max, siteAmount - 1);
        }
        this.selects.targetProxy = new SelectWithName("Target", choices, { min: 1 });
        this.selects.amount = new SelectNumber("Amount", inclusiveRange(max));
        this.selects.giving = new SelectBoolean("Direction", ["Giving", "Taking"]);
        return super.start();
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        super.applyParameters(values);
        this.targetProxy = this.parameters.targetProxy[0]!;
        this.amount = this.parameters.amount[0]!;
        this.giving = this.parameters.giving[0]!;
    }

    execute(): void {
        const from = this.giving ? this.player : this.targetProxy.original;
        const to = this.giving ? this.targetProxy.original : this.player;

        if (from instanceof Site && from.getWarbandsAmount(this.playerProxy.leader.board.original.key) - this.amount < 1)
            throw new InvalidActionResolution("Cannot take the last warband off a site.");

        const effect = new MoveOwnWarbandsEffect(this.actionManager, this.playerProxy.leader.original, from, to, this.amount);
        if (this.targetProxy instanceof OathPlayer || this.targetProxy.ruler && this.targetProxy.ruler !== this.playerProxy) {
            const askTo = this.targetProxy instanceof OathPlayer ? this.targetProxy : this.targetProxy.ruler;
            if (askTo)
                new MakeDecisionAction(
                    this.actionManager, askTo.original,
                    `Allow ${this.amount} warbands to move from ${from.name} to ${to.name}?`,
                    () => effect.doNext()
                ).doNext();
        } else {
            effect.doNext();
        }
    }
}

export class ActPhaseAction extends OathAction {
    declare readonly selects: { action: SelectNOf<() => OathAction> };
    readonly autocompleteSelects: boolean = false;
    readonly message = "Start an action";
    
    static readonly startOptions = {
        "Muster": MusterAction,
        "TradeForFavor": TradeForFavorAction,
        "TradeForSecret": TradeForSecretAction,
        "Travel": TravelAction,
        "Recover": RecoverAction,
        "Search": SearchAction,
        "Campaign": CampaignAction,

        "Reveal": PlayFacedownAdviserAction,
        "MoveWarbands": MoveWarbandsAction,
        "Rest": RestAction
    };

    next: OathAction;

    start(): boolean {
        const choices = Object.entries(ActPhaseAction.startOptions).map(([k, v]) => [k, () => this.next = new v(this.actionManager, this.player)] as [string, () => OathAction]);
        this.selects.action = new SelectNOf("Action", choices, { min: 1 });
        return super.start();
    }

    execute(): void {
        this.parameters.action[0]!().doNext();
    }
}


////////////////////////////////////////////
//              OTHER ACTIONS             //
////////////////////////////////////////////
export class MakeDecisionAction extends OathAction {
    declare readonly selects: { allow: SelectBoolean };
    readonly message;

    callback: () => void;
    negativeCallback?: () => void;
    options: [string, string];

    constructor(actionManager: OathActionManager, player: OathPlayer, message: string, callback: () => void, negativeCallback?: () => void, options: [string, string] = ["Yes", "No"]) {
        super(actionManager, player);
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
    readonly selects: Record<string, SelectNumber> = {};
    readonly message;

    target: ResourcesAndWarbands;
    amount: number;

    constructor(actionManager: OathActionManager, player: OathPlayer, target: ResourcesAndWarbands, amount: number) {
        super(actionManager, player);
        this.message = `Kill ${amount} warbands`;
        this.target = target;
        this.amount = amount;
    }

    start(): boolean {
        const owners: [string, number][] = this.game.players.map((e) => [e.name, this.target.getWarbands(e.board.key).length]);
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
                new ParentToTargetEffect(this.actionManager, this.player, this.target.getWarbands(owner.board.key, this.parameters[owner.name]![0]), owner.leader.bag).doNext();
    }
}


export class ChooseNumberAction extends OathAction {
    declare readonly selects: { value: SelectNumber };
    readonly message: string;

    values: Set<number>;
    callback: (value: number) => void;

    constructor(actionManager: OathActionManager, player: OathPlayer, message: string, values: Iterable<number>, callback: (value: number) => void) {
        super(actionManager, player);
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
    constructor(actionManager: OathActionManager, player: OathPlayer) {
        super(
            actionManager, player, "Take a Reliquary relic",
            player.game.reliquary.children.filter((e) => e.children[0]).map((_, i) => i),
            (index: number) => new TakeReliquaryRelicEffect(actionManager, player, index).doNext()
        )
    }
}


export class ChooseResourceToTakeAction extends OathAction {
    declare readonly selects: { resource: SelectWithName<OathResource> };
    readonly message = "Take a resource";

    source: ResourcesAndWarbands;

    constructor(actionManager: OathActionManager, player: OathPlayer, source: ResourcesAndWarbands) {
        super(actionManager, player);
        this.source = source;
    }

    start() {
        this.selects.resource = new SelectWithName("Resource", this.source.resources, { min: 1 });
        return super.start();
    }

    execute(): void {
        const resource = this.parameters.resource[0];
        if (!resource || !this.player) return;
        new ParentToTargetEffect(this.actionManager, this.player, [resource]).doNext();   
    }
}


export class ChooseRegionAction extends OathAction {
    declare readonly selects: { region: SelectNOf<Region | undefined> };
    readonly message: string;

    regions: Set<Region> | undefined;
    none: string | undefined;
    callback: (region: Region | undefined) => void;

    constructor(actionManager: OathActionManager, player: OathPlayer, message: string, callback: (region: Region | undefined) => void, regions?: Iterable<Region>, none?: string) {
        super(actionManager, player);
        this.message = message;
        this.callback = callback;
        this.regions = regions && new Set(regions);
        this.none = none;
    }

    start() {
        if (!this.regions) this.regions = new Set(this.game.map.children);

        const choices = new Map<string, Region | undefined>();
        if (this.none) choices.set(this.none, undefined);
        for (const region of this.regions) choices.set(region.name, region);
        this.selects.region = new SelectNOf("Region", choices, { min: 1 });

        return super.start();
    }

    execute(): void {
        this.callback(this.parameters.region[0]!);
    }
}


export abstract class ChooseTsAction<T> extends OathAction {
    declare readonly selects: Record<string, SelectNOf<T>>;
    readonly message: string;

    choices: Set<T>[] | undefined;
    ranges: [number, number?][]
    callback: (...choices: T[][]) => void;

    constructor(actionManager: OathActionManager, player: OathPlayer, message: string, callback: (...choices: T[][]) => void, choices?: Iterable<T>[], ranges: [number, number?][] = []) {
        super(actionManager, player);
        this.message = message;
        this.callback = callback;
        this.ranges = ranges;
        this.choices = choices && choices.map((e) => new Set(e));
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
                choices.set(OathSuit[suit], suit);
            this.selects["choices" + i] = new SelectNOf("Suit", choices, { min: this.rangeMin(i), max: this.rangeMax(i) });
        }

        return super.start();
    }
}

export class TakeFavorFromBankAction extends ChooseSuitsAction {
    constructor(actionManager: OathActionManager, player: OathPlayer, amount: number, suits?: Iterable<OathSuit>) {
        super(
            actionManager, player, "Take " + amount + " from a favor bank", 
            (suits: OathSuit[]) => {
                if (suits[0] === undefined) return;
                const resources = this.game.favorBank(suits[0])?.get(amount);
                if (resources)
                    new ParentToTargetEffect(this.actionManager, this.player, resources).doNext();
            },
            suits && [suits]
        );
    }
}

export class PeoplesFavorWakeAction extends ChooseSuitsAction {
    banner: PeoplesFavor;

    constructor(actionManager: OathActionManager, player: OathPlayer, banner: PeoplesFavor) {
        super(actionManager, player, "Return favor (choose none to put favor)", (suits: OathSuit[]) => { this.putOrReturnFavor(suits[0]) }, [], [[0, 1]]);
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
        new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.player, this, new ResourceCost([[Favor, 1]]), bank ?? this.banner, bank ? this.banner : this.player)).doNext();

        if (this.banner.amount >= 6)
            new SetPeoplesFavorMobState(this.actionManager, this.player, true).doNext();
    }
}


export class ChooseRnWsAction extends ChooseTsAction<ResourcesAndWarbands> {
    start() {
        if (!this.choices) this.choices = [];

        for (const [i, group] of this.choices.entries()) {
            const choices = new Map<string, ResourcesAndWarbands>();
            for (const target of group) choices.set(target.name, target);
            this.selects["choices" + i] = new SelectNOf("Target", choices, { min: this.rangeMin(i), max: this.rangeMax(i) });
        }

        return super.start();
    }
}


export class ChoosePlayersAction extends ChooseTsAction<OathPlayer> {
    start() {
        if (!this.choices) this.choices = [new Set(this.game.players.filter((e) => e !== this.player))];

        for (const [i, group] of this.choices.entries()) {
            const choices = new Map<string, OathPlayer>();
            for (const player of group)
                if (player !== this.player)
                    choices.set(player.name, player);
            this.selects["choices" + i] = new SelectNOf("Player", choices, { min: this.rangeMin(i), max: this.rangeMax(i) });
        }

        return super.start();
    }
}

export class TakeResourceFromPlayerAction extends ChoosePlayersAction {
    constructor(actionManager: OathActionManager, player: OathPlayer, resource: OathResourceType, amount?: number, players?: Iterable<OathPlayer>) {
        super(
            actionManager, player, "",
            (targets: OathPlayer[]) => {
                if (!targets[0]) return;
                if (resource === Secret && targets[0].byClass(Secret).length <= 1) return;
                new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(player, this, new ResourceCost([[resource, amount === undefined ? 1 : amount]]), player, targets[0])).doNext();
            },
            players && [players]
        );
    }
}

export class StartBindingExchangeAction extends ChoosePlayersAction {
    constructor(actionManager: OathActionManager, player: OathPlayer, next: Constructor<MakeBindingExchangeOfferAction>, players?: Iterable<OathPlayer>) {
        super(
            actionManager, player, "You may start a binding exchange with another player",
            (targets: OathPlayer[]) => { if (targets[0]) new next(actionManager, this.player, targets[0], new next(actionManager, targets[0], this.player)).doNext(); },
            players && [players],
            [[0, 1]]
        );
    }
}


export class ChooseSitesAction extends ChooseTsAction<Site> {
    start() {
        if (!this.choices) this.choices = [new Set([...this.game.map.sites()].filter((e) => !e.facedown && e !== this.player.site))];
        for (const [i, group] of this.choices.entries())
            this.selects["choices" + i] = new SelectCard("Site", this.player, group, { min: this.rangeMin(i), max: this.rangeMax(i) });

        return super.start();
    }
}

export class ActAsIfAtSiteAction extends ChooseSitesAction {
    constructor(actionManager: OathActionManager, player: OathPlayer, action: OathAction, sites?: Iterable<Site>) {
        super(
            actionManager, player, "Choose a site to act at",
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
    constructor(actionManager: OathActionManager, playerProxy: OathPlayer) {
        super(
            actionManager, playerProxy.original, "Exchange warbands with a site (choose none to finish)",
            (sites: Site[]) => {
                if (!sites[0]) return;
                const action = new MoveWarbandsAction(actionManager, playerProxy.original);
                action.playerProxy.site = action.maskProxyManager.get(sites[0]);
                action.doNext();
                this.doNext();
            },
            [[...playerProxy.game.map.sites()].filter((e) => e.ruler === playerProxy).map((e) => e.original)],
            [[0, 1]]
        );
    }
}


export class ChooseCardsAction<T extends OathCard> extends ChooseTsAction<T> {
    declare choices: Set<T>[];

    constructor(actionManager: OathActionManager, player: OathPlayer, message: string, cards: Iterable<T>[], callback: (...choices: T[][]) => void, ranges: [number, number?][] = []) {
        super(actionManager, player, message, callback, cards, ranges);
    }

    start() {
        for (const [i, group] of this.choices.entries())
            this.selects["choices" + i] = new SelectCard("Card", this.player, group, { min: this.rangeMin(i), max: this.rangeMax(i) });
        return super.start();
    }
}


export class ConspiracyStealAction extends OathAction {
    declare readonly selects: { taking: SelectNOf<Relic | Banner> };
    readonly message = "Take a relic or banner";

    target: OathPlayer;

    constructor(actionManager: OathActionManager, player: OathPlayer, target: OathPlayer) {
        super(actionManager, player);
        this.target = target;
    }

    start() {
        const choices = new Map<string, Relic | Banner>();
        for (const relic of this.player.relics) choices.set(relic.visualName(this.player), relic);
        for (const banner of this.player.banners) choices.set(banner.name, banner);
        this.selects.taking = new SelectNOf("Target", choices, { min: 1 });
        return super.start();
    }

    execute(): void {
        const taking = this.parameters.taking[0]!;
        new SeizeTargetEffect(this.actionManager, this.player, taking).doNext();
    }
}


export class MakeBindingExchangeOfferAction extends OathAction {
    declare readonly selects: { favors: SelectNumber, secrets: SelectNumber };
    readonly message = "Choose what you want in the exchange";

    other: OathPlayer;
    otherProxy: OathPlayer;
    effect: BindingExchangeEffect;
    next?: MakeBindingExchangeOfferAction;

    constructor(actionManager: OathActionManager, player: OathPlayer, other: OathPlayer, next?: MakeBindingExchangeOfferAction) {
        super(actionManager, player);
        this.other = other;
        this.otherProxy = this.maskProxyManager.get(other);
        this.effect = next?.effect ?? new BindingExchangeEffect(actionManager, other, player);
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
            new MakeDecisionAction(this.actionManager, this.other, "Complete the binding exchange?", () =>
                new MakeDecisionAction(this.actionManager, this.player, "Complete the binding exchange?", () =>
                    this.effect.doNext()
                ).doNext()
            ).doNext();
        }
    }
}

export class DeedWriterOfferAction extends MakeBindingExchangeOfferAction {
    declare readonly selects: { favors: SelectNumber, secrets: SelectNumber, sites: SelectCard<Site> };

    effect: SiteExchangeOfferEffect;

    constructor(actionManager: OathActionManager, player: OathPlayer, other: OathPlayer, next?: DeedWriterOfferAction) {
        super(actionManager, player, other, next);
        this.effect = next?.effect ?? new SiteExchangeOfferEffect(actionManager, other, player);
    }

    start(): boolean {
        this.selects.sites = new SelectCard("Sites", this.player, [...this.gameProxy.map.sites()].filter((e) => e.ruler === this.otherProxy).map((e) => e.original));
        return super.start();
    }

    execute(): void {
        const sites = new Set(this.parameters.sites);
        if (this.next)
            this.effect.sitesTaken = sites;
        else
            this.effect.sitesGiven = sites;

        super.execute();
    }
}

export abstract class ThingsExchangeOfferAction<T extends OathGameObject> extends MakeBindingExchangeOfferAction {
    declare readonly selects: { favors: SelectNumber, secrets: SelectNumber, things: SelectWithName<T> };

    effect: ThingsExchangeOfferEffect<T>;

    constructor(actionManager: OathActionManager, player: OathPlayer, other: OathPlayer, next?: ThingsExchangeOfferAction<T>) {
        super(actionManager, player, other, next);
        this.effect = next?.effect ?? new ThingsExchangeOfferEffect<T>(actionManager, other, player);
    }

    execute(): void {
        const things = new Set(this.parameters.things);
        if (this.next)
            this.effect.thingsTaken = things;
        else
            this.effect.thingsGiven = things;

        super.execute();
    }
}

export class TinkersFairOfferAction extends ThingsExchangeOfferAction<Relic> {
    start(): boolean {
        this.selects.things = new SelectCard("Relics", this.player, this.other.relics);
        return super.start();
    }
}

export class FestivalDistrictOfferAction extends ThingsExchangeOfferAction<WorldCard> {
    start(): boolean {
        this.selects.things = new SelectCard("Advisers", this.player, this.other.advisers.filter((e) => !(e instanceof Denizen && e.activelyLocked)));
        return super.start();
    }

    execute(): void {
        super.execute();
        if (!this.next) new CheckCapacityEffect(this.actionManager, this.player, [this.player, this.other]).doNext();
    }
}

export class TheGatheringOfferAction extends ThingsExchangeOfferAction<Relic | WorldCard> {
    start(): boolean {
        this.selects.things = new SelectCard("Relics and advisers", this.player, [...this.other.relics, ...this.other.advisers.filter((e) => !(e instanceof Denizen && e.activelyLocked))]);
        return super.start();
    }

    execute(): void {
        super.execute();
        if (!this.next) new CheckCapacityEffect(this.actionManager, this.player, [this.player, this.other]).doNext();
    }
}

export class CitizenshipOfferAction extends ThingsExchangeOfferAction<Relic | Banner> {
    declare readonly selects: { favors: SelectNumber, secrets: SelectNumber, reliquaryRelic: SelectNumber, things: SelectNOf<Relic | Banner> };

    effect: CitizenshipOfferEffect;

    constructor(actionManager: OathActionManager, player: OathPlayer, other: OathPlayer, next?: CitizenshipOfferAction) {
        super(actionManager, player, other, next);
        this.effect = next?.effect ?? new CitizenshipOfferEffect(actionManager, other, player);
    }

    start(): boolean {
        if (!this.next) {
            const values = [];
            for (const [i, slot] of this.game.reliquary.children.entries())
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
        if (!this.next) this.effect.reliquaryIndex = this.parameters.reliquaryRelic[0]!;
        super.execute();
    }
}


export class SkeletonKeyAction extends OathAction {
    declare readonly selects: { index: SelectNumber };
    readonly message = "Peek at a relic in the Reliquary";

    start(): boolean {
        const values = [];
        for (const [i, slot] of this.game.reliquary.children.entries())
            if (slot.children[0])
                values.push(i);
        
        this.selects.index = new SelectNumber("Reliquary slot", values);
        return super.start();
    }

    execute(): void {
        const index = this.parameters.index[0]!;
        const relic = this.game.reliquary.children[index]!.children[0];
        if (relic) new PeekAtCardEffect(this.actionManager, this.player, relic).doNext();
        new MakeDecisionAction(
            this.actionManager, this.player, "Take the relic?",
            () => new TakeReliquaryRelicEffect(this.actionManager, this.player, index).doNext()
        ).doNext();
    }
}


export class BrackenAction extends OathAction {
    declare readonly selects: { region: SelectWithName<Region>, onTop: SelectBoolean };
    readonly message = "Choose where you'll discard";

    action: SearchAction;

    constructor(action: SearchAction) {
        super(action.actionManager, action.player);
        this.action = action;
    }

    start(): boolean {
        this.selects.region = new SelectWithName("Region", this.game.map.children, { min: 1 });
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
    declare readonly selects: { oath: SelectNOf<OathType> };
    readonly message = "Vow an Oath";

    start(): boolean {
        const choices = new Map<string, OathType>();
        if (this.player.board instanceof ExileBoard && this.player.board.vision) {
            const oathType = this.player.board.vision.oath.oathType;
            choices.set(OathType[oathType], oathType);
        } else {
            for (let i: OathType = 0; i < 4; i++)
                if (i !== this.game.oathkeeperTile.oath.oathType)
                    choices.set(OathType[i], i);
        }
        this.selects.oath = new SelectNOf("Oath", choices, { min: 1 });
        return super.start();
    }

    execute(): void {
        const oathType = this.parameters.oath[0]!;
        this.game.oathkeeperTile.setType(oathType);
    }
}

export class ChooseNewCitizensAction extends OathAction {
    declare readonly selects: { players: SelectWithName<OathPlayer> };
    readonly message = "Propose Citizenship to other Exiles";

    start() {
        this.selects.players = new SelectWithName("Exile(s)", this.game.players.filter((e) => !e.isImperial && e !== this.player));
        return super.start();
    }

    execute(): void {
        const citizens = this.parameters.players;
        for (const player of this.game.players)
            if (player.board instanceof ExileBoard && player.board.isCitizen)
                new BecomeExileEffect(this.actionManager, player).doNext();
        
        for (const citizen of citizens)
            new MakeDecisionAction(this.actionManager, citizen, "Become a Citizen?", () => new BecomeCitizenEffect(this.actionManager, citizen).doNext()).doNext();

        for (const site of this.game.map.sites())
            for (const player of this.game.players)
                if (!player.isImperial)
                    new ParentToTargetEffect(this.actionManager, player, site.getWarbands(player.leader.board.key), player.leader.bag).doNext()
    }
}

export class BuildOrRepairEdificeAction extends OathAction {
    declare readonly selects: { card: SelectCard<Denizen> };
    readonly message = "Build or repair an edifice";

    start(): boolean {
        const choices = new Set<Denizen>();
        const bannedSuits = new Set<OathSuit>();
        for (const site of this.game.map.sites()) {
            if (!site.ruler?.isImperial) continue;
            for (const denizen of site.denizens) {
                const isEdifice = denizen instanceof Edifice;
                if ((denizen.suit === OathSuit.None) !== isEdifice) continue;
                choices.add(denizen);
                if (isEdifice) bannedSuits.add(denizen.suit);
            }
        }
        
        this.selects.card = new SelectCard("Card", this.player, [...choices].filter((e) => !bannedSuits.has(e.suit)));
        return super.start();
    }

    execute(): void {
        const card = this.parameters.card[0];
        if (!card) return;
        
        if (card instanceof Edifice)
            new FlipEdificeEffect(this.actionManager, card).doNext();
        else
            new BuildEdificeFromDenizenEffect(this.actionManager, card).doNext();
    }
}
