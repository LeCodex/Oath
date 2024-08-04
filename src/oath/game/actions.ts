import { Denizen, Edifice, Relic, Site, VisionBack, WorldCard } from "./cards/cards";
import { DiscardOptions, SearchableDeck } from "./cards/decks";
import { AttackDie, DefenseDie, Die } from "./dice";
import { MoveBankResourcesEffect, MoveResourcesToTargetEffect, PayCostToTargetEffect, PlayWorldCardEffect, PutResourcesIntoBankEffect, PutWarbandsFromBagEffect, RollDiceEffect, DrawFromDeckEffect, TakeResourcesFromBankEffect, TakeWarbandsIntoBagEffect, TravelEffect, DiscardCardEffect, MoveOwnWarbandsEffect, AddActionToStackEffect, MoveAdviserEffect, MoveWorldCardToAdvisersEffect, SetNewOathkeeperEffect, SetPeoplesFavorMobState, DiscardCardGroupEffect, OathEffect, PopActionFromStackEffect, PaySupplyEffect, ChangePhaseEffect, NextTurnEffect, PutResourcesOnTargetEffect, SetUsurperEffect, BecomeCitizenEffect, BecomeExileEffect, BuildEdificeFromDenizenEffect, WinGameEffect, ChangeEdificeEffect, ModifiedExecutionEffect, CampaignResolveSuccessfulAndSkullsEffect, BindingExchangeEffect, CitizenshipOfferEffect, PeekAtCardEffect, TakeReliquaryRelicEffect } from "./effects";
import { BannerName, OathPhase, OathResource, OathResourceName, OathSuit, OathSuitName, OathType, OathTypeName } from "./enums";
import { OathGame } from "./game";
import { OathGameObject } from "./gameObject";
import { OathTypeToOath } from "./oaths";
import { Exile, OathPlayer } from "./player";
import { ActionModifier, ActivePower, CapacityModifier, OathPower } from "./powers/powers";
import { ResourceCost, ResourcesAndWarbands } from "./resources";
import { Banner, PeoplesFavor } from "./banks";
import { Constructor, getCopyWithOriginal, isExtended, shuffleArray } from "./utils";



////////////////////////////////////////////
//                MANAGER                 //
////////////////////////////////////////////
export class OathActionManager extends OathGameObject {
    readonly actionsStack: OathAction[] = [];
    readonly futureActionsList: OathAction[] = [];
    readonly currentEffectsStack: OathEffect<any>[] = [];
    readonly pastEffectsStack: OathEffect<any>[][] = [];
    readonly cancelledEffects: OathEffect<any>[] = [];
    startOptions: Record<string, Constructor<OathAction>> = {};
    noReturn: boolean = false;

    checkForNextAction(): Record<string, any> {
        for (const action of this.futureActionsList) new AddActionToStackEffect(action).do();
        this.futureActionsList.length = 0;

        if (!this.actionsStack.length) this.game.checkForOathkeeper();
        let action = this.actionsStack[this.actionsStack.length - 1];
    
        let contineNow = action?.start();
        if (contineNow) return this.resolveTopAction();
    
        if (this.noReturn) {
            this.currentEffectsStack.length = 0;
            this.pastEffectsStack.length = 0;
        }
        this.noReturn = false;
        
        if (!action) this.startOptions = this.getStartOptions();

        const returnData = {
            activeAction: action?.serialize(),
            startOptions: !action ? Object.keys(this.startOptions) : undefined,
            appliedEffects: this.currentEffectsStack.map(e => e.constructor.name),
            cancelledEffects: this.cancelledEffects.map(e => e.constructor.name),
            game: this.game.serialize()
        };
        this.cancelledEffects.length = 0;
        return returnData;
    }

    storeEffects() {
        if (this.currentEffectsStack.length) {
            this.pastEffectsStack.push([...this.currentEffectsStack]);
            this.currentEffectsStack.length = 0;
        }
    }

    getStartOptions(): Record<string, Constructor<OathAction>> {
        return {
            "Muster": MusterAction,
            "Trade": TradeAction,
            "Travel": TravelAction,
            "Recover": RecoverAction,
            "Search": SearchAction,
            "Campaign": CampaignAction,

            "Use": UsePowerAction,
            "Reveal": PlayFacedownAdviserAction,
            "Move warbands": MoveWarbandsAction,
            "Rest": RestAction
        };
    }

    startAction(actionName: string): object {
        const action = this.startOptions[actionName];
        if (!action)
            throw new InvalidActionResolution("Invalid starting action name");

        this.storeEffects();
        new action(this.game.currentPlayer).doNext();

        try {
            return this.checkForNextAction();
        } catch (e) {
            this.revert();
            throw e;
        }
    }
    
    continueAction(by: number, values: Record<string, string[]>): object {
        const action = this.actionsStack[this.actionsStack.length - 1];
        if (!action) throw new InvalidActionResolution("No action to continue");
        
        const player = this.game.players[by];
        if (action.player.original !== player) throw new InvalidActionResolution(`Action must be resolved by ${action.player.name}, not ${player.name}`)
        
        this.storeEffects();
        const parsed = action.parse(values);
        action.applyParameters(parsed);

        try {
            return this.resolveTopAction();
        } catch (e) {
            this.revert();
            throw e;
        }
    }
    
    resolveTopAction(): object {
        const action = new PopActionFromStackEffect(this.game).do();
        if (!action) return this.checkForNextAction();
    
        action.execute();
        return this.checkForNextAction();
    }
    
    cancelAction(): object {
        if (this.currentEffectsStack.length == 0 && this.pastEffectsStack.length == 0) throw new InvalidActionResolution("Cannot roll back");
        
        this.startOptions = {};
        const reverted = this.revert();
        this.cancelledEffects.splice(0, 0, ...reverted);
        return this.checkForNextAction();
    }
    
    revert(): OathEffect<any>[] {
        this.futureActionsList.length = 0;

        const reverted: OathEffect<any>[] = [];
        while (this.currentEffectsStack.length) {
            const effect = this.currentEffectsStack.pop();
            if (!effect) break;
            effect.revert();
            reverted.push(effect);
        }
    
        const group = this.pastEffectsStack.pop();
        this.currentEffectsStack.length = 0;
        if (group) this.currentEffectsStack.push(...group);
    
        return reverted;
    }
}


////////////////////////////////////////////
//               SELECTORS                //
////////////////////////////////////////////
export class SelectNOf<T> {
    name: string;
    choices: Map<string, T>;
    min: number;
    max: number;

    constructor(name: string, choices: Iterable<[string, T]>, min: number = -1, max?: number, exact: boolean = true) {
        this.name = name;
        this.choices = new Map(choices);

        if (max === undefined) max = min == -1 ? this.choices.size : min;
        if (min > max) throw new InvalidActionResolution(`Min is above max for select ${this.name}`);
        if (this.choices.size < min && exact) throw new InvalidActionResolution(`Not enough choices for select ${this.name}`);

        this.min = min === -1 ? 0: min;
        this.max = max;
    }

    parse(input: Iterable<string>): T[] {
        const values = new Set<T>();
        for (const val of input) {
            if (!this.choices.has(val)) throw new InvalidActionResolution(`Invalid choice for select ${this.name}: ${val}`);
            const obj = this.choices.get(val);
            values.add(obj as T);  // We know the value exists, and if it's undefined, then we want that
        }
        if (values.size < this.min || values.size > this.max) throw new InvalidActionResolution(`Invalid number of values for select ${this.name}`);

        return [...values];
    }

    serialize(): Record <string, any> {
        return {
            name: this.name,
            choices: [...this.choices.keys()],
            min: this.min,
            max: this.max
        };
    }
}

export class SelectBoolean extends SelectNOf<boolean> {
    constructor(name: string, text: [string, string]) {
        super(name, [[text[0], true], [text[1], false]], 1);
    }
}

export class SelectNumber extends SelectNOf<number> {
    constructor(name: string, values: number[], min: number = 1, max?: number) {
        const choices = new Map<string, number>();
        for (const i of values) choices.set(String(i), i);
        super(name, choices, min, max);
    }
}



//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export class InvalidActionResolution extends Error { }

export abstract class OathAction extends OathGameObject {
    readonly game: OathGame;
    readonly player: OathPlayer;
    readonly selects: Record<string, SelectNOf<any>> = {};
    readonly parameters: Record<string, any> = {};
    readonly autocompleteSelects: boolean = true;
    abstract readonly message: string;

    constructor(player: OathPlayer, dontCopyGame: boolean = true) {
        super(dontCopyGame ? player.game : getCopyWithOriginal(player.game.original));
        this.player = dontCopyGame ? player : this.game.players[player.color];
    }

    doNext(): void {
        this.game.original.actionManager.futureActionsList.unshift(this);
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
    readonly next: ModifiableAction;
    readonly executeImmediately: boolean;
    readonly message = "Choose modifiers";

    persistentModifiers: Set<ActionModifier<any>>;

    constructor(next: ModifiableAction, executeImmediately: boolean = false) {
        super(next.player, true);  // Not copying for performance reasons, since this copy should never be accessed
        this.next = next;
        this.executeImmediately = executeImmediately;
    }

    start() {
        this.persistentModifiers = new Set();
        const choices = new Map<string, ActionModifier<any>>();
        for (const modifier of ChooseModifiers.gatherModifiers(this.next)) {
            if (modifier.mustUse)
                this.persistentModifiers.add(modifier);
            else
                choices.set(modifier.name, modifier);
        }
        this.selects.modifiers = new SelectNOf("Modifiers", choices);

        // NOTE: For ignore loops, all powers in the loop are ignored.
        const ignore = new Set<ActionModifier<any>>();
        for (const modifier of choices.values())
            for (const toIgnore of modifier.applyImmediately([...choices.values()]))
                ignore.add(toIgnore);

        for (const modifier of ignore) {
            choices.delete(modifier.name);
            this.persistentModifiers.delete(modifier);
        }

        return super.start();
    }

    static gatherModifiers(action: ModifiableAction): ActionModifier<any>[] {
        const instances: ActionModifier<any>[] = [];

        for (const [source, modifier] of action.game.getPowers(ActionModifier<any>)) {
            const instance = new modifier(source, action);
            if (action instanceof instance.modifiedAction && instance.canUse()) instances.push(instance);
        };

        return instances;
    }

    execute() {
        const modifiers = [...this.persistentModifiers, ...this.parameters.modifiers];
        if (!this.next.applyModifiers(modifiers)) return;

        if (this.executeImmediately)
            this.next.execute();
        else
            this.next.doNextWithoutModifiers();
    }
}

export abstract class ModifiableAction extends OathAction {
    modifiers: ActionModifier<any>[];

    constructor(player: OathPlayer, dontCopyGame: boolean = false) {
        super(player, dontCopyGame);
    }

    doNext(executeImmediately: boolean = false): void {
        new ChooseModifiers(this, executeImmediately).doNext();
    }

    doNextWithoutModifiers(): void {
        super.doNext();
    }

    applyModifiers(modifiers: ActionModifier<any>[]): boolean {
        this.modifiers = modifiers;

        let interrupt = false;
        for (const modifier of modifiers) {
            if (!modifier.payCost(this.player))
                throw new InvalidActionResolution("Cannot pay the resource cost of all the modifiers.");

            if (!modifier.applyWhenApplied()) interrupt = true;
        }
        if (interrupt) return false;

        return true;
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
    readonly autocompleteSelects = false;
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
    card: Denizen;
    using = OathResource.Favor;
    amount = 1;
    getting = 2;

    start() {
        const choices = new Map<string, Denizen>();
        for (const denizen of this.player.site.denizens) if (denizen.suit !== OathSuit.None && denizen.empty) choices.set(denizen.name, denizen);
        this.selects.card = new SelectNOf("Card", choices, 1);
        return super.start();
    }

    execute() {
        this.card = this.parameters.card[0];
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        if (new MoveResourcesToTargetEffect(this.game, this.player, this.using, this.amount, this.card).do() < 1)
            throw new InvalidActionResolution("Cannot pay resource cost.");

        new PutWarbandsFromBagEffect(this.player, this.getting).do();
    }
}


export class TradeAction extends MajorAction {
    readonly selects: { card: SelectNOf<Denizen>, forFavor: SelectBoolean };
    readonly parameters: { card: Denizen[], forFavor: boolean[] };
    readonly message = "Put resources on a card to trade";

    supplyCost = 1;
    card: Denizen;
    forFavor: boolean;
    paying: Map<OathResource, number>;
    getting: Map<OathResource, number>;

    start() {
        const choices = new Map<string, Denizen>();
        for (const denizen of this.player.site.denizens)
            if (denizen.suit !== OathSuit.None && denizen.empty) choices.set(denizen.name, denizen);
        this.selects.card = new SelectNOf("Card", choices, 1);
        this.selects.forFavor = new SelectBoolean("Type", ["For favors", "For secrets"]);
        return super.start();
    }

    execute() {
        this.card = this.parameters.card[0];
        this.forFavor = this.parameters.forFavor[0];
        this.paying = new Map([[this.forFavor ? OathResource.Secret : OathResource.Favor, this.forFavor ? 1 : 2]]);
        this.getting = new Map([[this.forFavor ? OathResource.Favor : OathResource.Secret, (this.forFavor ? 1 : 0)]]);
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        // TODO: Make costs easily printable. Potentially get the error from the ResourceCost class?
        if (!new PayCostToTargetEffect(this.game, this.player, new ResourceCost(this.paying), this.card).do())
            throw new InvalidActionResolution("Cannot pay resource cost.");

        const resource = this.forFavor ? OathResource.Favor : OathResource.Secret;
        this.getting.set(resource, (this.getting.get(resource) || 0) + this.player.adviserSuitCount(this.card.suit));

        new TakeResourcesFromBankEffect(this.game, this.player, this.game.favorBanks.get(this.card.suit), this.getting.get(OathResource.Favor) || 0).do();
        new PutResourcesOnTargetEffect(this.game, this.player, OathResource.Secret, this.getting.get(OathResource.Secret) || 0).do();
    }
}


export class TravelAction extends MajorAction {
    readonly selects: { site: SelectNOf<Site> };
    readonly parameters: { site: Site[] };
    readonly message = "Choose a site to travel to";

    site: Site;

    start() {
        const choices = new Map<string, Site>();
        for (const site of this.game.board.sites())
            if (site !== this.player.site) choices.set(site.facedown ? `Facedown ${site.region.name}` : site.name, site);
        
        this.selects.site = new SelectNOf("Site", choices, 1);
        return super.start();
    }

    execute() {
        this.site = this.parameters.site[0];
        this.supplyCost = this.game.board.travelCosts.get(this.player.site.region.regionName)?.get(this.site.region.regionName) || 2;
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        new TravelEffect(this.player, this.site).do();
    }
}


export interface RecoverActionTarget {
    canRecover(action: RecoverAction): boolean;
    recover(player: OathPlayer): void;
}

export class RecoverAction extends MajorAction {
    readonly selects: { target: SelectNOf<RecoverActionTarget> };
    readonly parameters: { target: RecoverActionTarget[] };
    readonly message = "Choose a target to recover";
    
    supplyCost = 1;
    target: RecoverActionTarget;

    start() {
        const choices = new Map<string, RecoverActionTarget>();
        for (const relic of this.player.site.relics) if (relic.canRecover(this)) choices.set(relic.name, relic);
        for (const banner of this.game.banners.values()) if (banner.canRecover(this)) choices.set(banner.name, banner);
        this.selects.target = new SelectNOf("Target", choices, 1);
        return super.start();
    }

    execute() {
        this.target = this.parameters.target[0];
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        this.target.recover(this.player);
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
        for (let i = this.banner.amount + 1; i <= this.player.getResources(this.banner.type); i++) values.push(i);
        this.selects.amount = new SelectNumber("Amount", values);
        return super.start();
    }

    execute() {
        this.banner.finishRecovery(this.player, this.parameters.amount[0]);
    }
}


export class SearchAction extends MajorAction {
    readonly selects: { deck: SelectNOf<SearchableDeck> };
    readonly parameters: { deck: SearchableDeck[] };
    readonly message = "Draw 3 cards from a deck";

    deck: SearchableDeck;
    amount = 3;
    fromBottom = false;
    discardOptions = new DiscardOptions(this.player.discard);

    start() {
        const choices = new Map<string, SearchableDeck>();
        choices.set("World Deck", this.game.worldDeck);
        choices.set(this.player.site.region.name, this.player.site.region.discard);
        this.selects.deck = new SelectNOf("Deck", choices, 1);
        return super.start();
    }

    execute() {
        this.deck = this.parameters.deck[0];
        this.supplyCost = this.deck.searchCost;
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        const cards = new DrawFromDeckEffect(this.player, this.deck, this.amount, this.fromBottom).do();
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
        for (const card of this.playing) new SearchPlayAction(this.player, card, this.discardOptions).doNext();
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
    
    card: WorldCard;
    site: Site | undefined;
    facedown: boolean;
    discardOptions: DiscardOptions<any>;
    canReplace: boolean;

    constructor(player: OathPlayer, card: WorldCard, discardOptions?: DiscardOptions<any>) {
        super(player);
        this.card = card;
        this.message = "Play " + this.card.name;
        this.discardOptions = discardOptions || new DiscardOptions(player.discard);
    }

    start() {
        const sitesChoice = new Map<string, Site | undefined>();
        sitesChoice.set("Advisers", undefined);
        sitesChoice.set(this.player.site.name, this.player.site);
        this.selects.site = new SelectNOf("Place", sitesChoice, 1);
        this.selects.facedown = new SelectBoolean("Orientation", ["Facedown", "Faceup"]);
        return super.start();
    }

    execute() {
        this.site = this.parameters.site[0];
        this.facedown = this.parameters.facedown[0];
        this.canReplace = this.site === undefined;
        super.execute();
    }

    static getCapacityInformation(player: OathPlayer, site?: Site, playing?: WorldCard): [number, WorldCard[], boolean] {
        const capacityModifiers: CapacityModifier<any>[] = [];
        for (const [source, modifier] of player.game.getPowers(CapacityModifier)) {
            const instance = new modifier(source);
            if (instance.canUse(player, site)) capacityModifiers.push(instance);
        }

        if (playing && !playing.facedown) {
            for (const modifier of playing.powers) {
                if (isExtended(modifier, CapacityModifier)) {
                    const instance = new modifier(playing);
                    capacityModifiers.push(instance);  // Always assume the card influences the capacity
                }
            }
        }

        let capacity = site ? site.capacity : 3;
        let ignoresCapacity = false;
        let takesNoSpace = new Set<WorldCard>();
        const target = site ? site.denizens : player.advisers;

        for (const capacityModifier of capacityModifiers) {
            const [cap, noSpace] = capacityModifier.updateCapacityInformation(target);
            capacity = Math.min(capacity, cap);
            for (const card of noSpace) takesNoSpace.add(card);
            if (playing) ignoresCapacity ||= capacityModifier.ignoreCapacity(playing);
        }

        return [capacity, [...target].filter(e => !takesNoSpace.has(e)), ignoresCapacity];
    }

    modifiedExecution() {
        this.card.facedown = this.facedown;  // Editing the copy to reflect the new state
        const [capacity, takesSpaceInTarget, ignoresCapacity] = SearchPlayAction.getCapacityInformation(this.player, this.site?.original, this.card);

        const excess = Math.max(0, takesSpaceInTarget.length - capacity + 1);  // +1 because we are playing a card there
        const discardable = takesSpaceInTarget.filter(e => !(e instanceof Denizen && e.activelyLocked));

        if (!ignoresCapacity && excess)
            if (!this.canReplace || excess > discardable.length)
                throw new InvalidActionResolution("Target is full and cards there cannot be replaced");
            else
                new SearchDiscardAction(this.player, discardable, excess, this.discardOptions).doNext();
        
        new PlayWorldCardEffect(this.player, this.card, this.facedown, this.site).doNext();

        // TODO: Also check capacity AFTER playing the card
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
    defender: OathPlayer | undefined;

    start() {
        const choices = new Map<string, OathPlayer | undefined>();
        for (const player of Object.values(this.game.players)) choices.set(player.name, player);
        if (this.player.site.ruler === undefined) choices.set("Bandits", undefined);
        this.selects.defender = new SelectNOf("Defender", choices, 1);
        return super.start();
    }

    execute() {
        this.defender = this.parameters.defender[0];
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        new CampaignAtttackAction(this.player, this.defender).doNext();
    }
}

export interface CampaignActionTarget {
    defense: number;
    force: ResourcesAndWarbands | undefined;
    
    seize(player: OathPlayer): void;
};

export class CampaignAtttackAction extends ModifiableAction {
    readonly selects: { targets: SelectNOf<CampaignActionTarget>, pool: SelectNumber };
    readonly parameters: { targets: CampaignActionTarget[], pool: number[] };
    readonly next: CampaignDefenseAction;
    readonly message = "Choose targets and attack pool";

    constructor(player: OathPlayer, defender: OathPlayer | undefined) {
        super(player);
        this.next = new CampaignDefenseAction(defender || this.player, this.player);
        this.campaignResult.attacker = player;
        this.campaignResult.defender = defender;
    }

    start() {
        const defender = this.campaignResult.defender;

        this.campaignResult.targets = [];
        const choices = new Map<string, CampaignActionTarget>();
        for (const site of this.game.board.sites()) { 
            if (!site.facedown && site.ruler?.original === defender?.original) {
                if (this.player.site === site) {
                    this.campaignResult.targets.push(site);
                } else {
                    choices.set(site.name, site);
                }
            }
        }

        if (defender && defender.site.original === this.player.site.original) {
            choices.set("Banish " + defender.name, defender);
            for (const relic of defender.relics) choices.set(relic.name, relic)
            for (const banner of defender.banners) choices.set(banner.name, banner);
        }
        this.selects.targets = new SelectNOf("Target(s)", choices, 1 - this.campaignResult.targets.length, choices.size);

        const values: number[] = [];
        for (let i = 0; i <= this.player.totalWarbands; i++) values.push(i);
        this.selects.pool = new SelectNumber("Attack pool", values);
        
        return super.start();
    }

    get campaignResult() { return this.next.campaignResult; }

    execute() {
        this.campaignResult.targets.push(...this.parameters.targets);
        this.campaignResult.atkPool = this.parameters.pool[0];

        this.campaignResult.defPool = 0;
        for (const target of this.campaignResult.targets) this.campaignResult.defPool += target.defense;
        if (this.campaignResult.defender?.original === this.game.oathkeeper.original) this.campaignResult.defPool += this.game.isUsurper ? 2 : 1;

        this.campaignResult.resolveDefForce();
        this.campaignResult.resolveAtkForce();
        super.execute();
    }

    modifiedExecution() {
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

        if (this.next.applyModifiers(modifiers))
            this.next.doNextWithoutModifiers();
    }
}

export class CampaignDefenseAction extends ModifiableAction {
    readonly next: CampaignEndAction;
    readonly message = "";

    constructor(player: OathPlayer, attacker: OathPlayer) {
        super(player, true);  // Don't copy because this is a big chain
        this.next = new CampaignEndAction(attacker, true);  // Same deal
    }

    get campaignResult() { return this.next.campaignResult; }

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
    targets: CampaignActionTarget[] = [];
    atkPool: number;
    defPool: number;
    atkForce: Set<ResourcesAndWarbands>;  // Force is all your warbands on the objects in this array
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
    endEffects: OathEffect<any>[] = [];

    get totalAtkForce() { return [...this.atkForce].reduce((a, e) => a + e.getWarbands(this.attacker.leader), 0); }
    get totalDefForce() { return [...this.defForce].reduce((a, e) => a + e.getWarbands(this.defender?.leader), 0); }

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
        this.endEffects.push(new DiscardCardEffect(denizen.ruler || this.attacker, denizen));
    }

    resolveAtkForce() {
        this.atkForce = new Set([this.attacker]);
    }
    
    resolveDefForce() {
        this.defForce = new Set();
        for (const target of this.targets) {
            const force = target.force;
            if (force) this.defForce.add(force);
        }
    }

    rollAttack() {
        this.atkRoll = new RollDiceEffect(this.game, this.attacker, AttackDie, this.atkPool).do();
    }

    rollDefense() {
        this.defRoll = new RollDiceEffect(this.game, this.defender, DefenseDie, this.defPool).do();
    }
    
    attackerKills(amount: number) {
        if (amount)
            new CampaignKillWarbandsInForceAction(this, true, amount).doNext();
    }

    defenderKills(amount: number) {
        if (!this.defender) return;

        if (amount)
            new CampaignKillWarbandsInForceAction(this, false, amount).doNext();
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

        for (const effect of this.campaignResult.endEffects)
            effect.doNext();

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
        super(attacker ? result.attacker.leader : result.defender?.leader || result.attacker.leader, true);
        this.message = `Kill ${amount} warbands`;
        this.result = result;
        this.owner = attacker ? result.attacker.leader : result.defender?.leader;
        this.force = attacker ? result.atkForce : result.defForce;
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
        for (let i = 0; i <= this.player.original.getWarbands(this.player.original.leader); i++) values.push(i);
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
        if (this.game.oathkeeper === this.player && !this.player.isImperial)
            if (this.game.isUsurper)
                return new WinGameEffect(this.player).do();
            else
                new SetUsurperEffect(this.game, true).do();
        
        if (this.player instanceof Exile && this.player.vision && this.game.worldDeck.visionsDrawn >= 3) {
            const candidates = this.player.vision.oath.getOathkeeperCandidates();
            if (candidates.size === 1 && candidates.has(this.player))
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
        this.player.original.rest();
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
        for (const [source, power] of this.game.getPowers(ActivePower<any>)) {
            const instance = new power(source, this);
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

        this.power.usePower(this);
    }
}


export class PlayFacedownAdviserAction extends ModifiableAction {
    readonly selects: { cards: SelectNOf<WorldCard> }
    readonly parameters: { cards: WorldCard[] }
    readonly message = "Choose an adviser to play";

    cards: Set<WorldCard>;
    playing: WorldCard;

    constructor(player: OathPlayer) {
        super(player);
        this.cards = new Set([...player.advisers].filter(e => e.facedown));
    }

    start() {
        const cardsChoice = new Map<string, WorldCard>();
        for (const card of this.cards) cardsChoice.set(card.name, card);
        this.selects.cards = new SelectNOf("Adviser", cardsChoice, 1);
        return super.start();
    }

    execute(): void {
        this.playing = this.parameters.cards[0];
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

    target: Site | OathPlayer;
    amount: number;
    giving: boolean;

    start(): boolean {
        const choices = new Map<string, Site | OathPlayer>();
        const site = this.player.site;
        let max = this.player.getWarbands(this.player.leader);
        if (this.player.isImperial) {
            for (const player of Object.values(this.game.players)) {
                if (player !== this.player && player.isImperial && player.site.original === site.original) {
                    choices.set(player.name, player);
                    max = Math.max(max, player.getWarbands(player.leader));
                }
            }
        }
        if (site.getWarbands(this.player.leader) > 0) {
            choices.set(site.name, site);
            max = Math.max(max, site.getWarbands(this.player.leader) - 1);
        }
        this.selects.target = new SelectNOf("Target", choices, 1);
        
        const values = [];
        for (let i = 1; i <= max; i++) values.push(i);
        this.selects.amount = new SelectNumber("Amount", values);

        this.selects.giving = new SelectBoolean("Direction", ["Giving", "Taking"]);

        return super.start();
    }

    execute(): void {
        this.target = this.parameters.target[0];
        this.amount = this.parameters.amount[0];
        this.giving = this.parameters.giving[0];
        super.execute();
    }

    modifiedExecution(): void {
        const from = this.giving ? this.player : this.target;
        const to = this.giving ? this.target : this.player;

        if (from instanceof Site && from.getWarbands(this.player.leader) - this.amount < 1)
            throw new InvalidActionResolution("Cannot take the last warband off a site.");

        const effect = new MoveOwnWarbandsEffect(this.player, from, to, this.amount);
        if (this.target instanceof OathPlayer || this.target.ruler && this.target.ruler.original !== this.player.original) {
            const askTo = this.target instanceof OathPlayer ? this.target : this.target.ruler;
            if (askTo) new AskForPermissionAction(askTo, effect).doNext();
        } else {
            effect.do();
        }
    }
}

export class AskForPermissionAction extends OathAction {
    readonly selects: { allow: SelectBoolean };
    readonly parameters: { allow: boolean[] };
    readonly message = "Do you allow this action?";

    effect: OathEffect<any>;

    constructor(player: OathPlayer, effect: OathEffect<any>) {
        super(player);
        this.effect = effect;
    }

    start(): boolean {
        this.selects.allow = new SelectBoolean("Decision", ["Allow", "Deny"]);
        return super.start();
    }

    execute(): void {
        if (this.parameters.allow[0]) this.effect.do();
    }
}


////////////////////////////////////////////
//              OTHER ACTIONS             //
////////////////////////////////////////////
export class ResolveEffectAction extends OathAction {
    readonly message = "";

    effect: OathEffect<any>;

    constructor(player: OathPlayer, effect: OathEffect<any>) {
        super(player, true);  // Don't copy, not modifiable, and not an entry point
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
        super(player, true);  // Don't copy, not modifiable, and not an entry point
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
            if (!this.power?.payCost(this.player)) return;
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
        super(player, true);  // Don't copy, they're not modifiable, are not entry points, and can be used to modify data in other actions
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
                new MoveBankResourcesEffect(this.game, this.player, this.banner, bank, 1).do();
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
        super(player, true);  // Don't copy, they're not modifiable, are not entry points, and can be used to modify data in other actions
        this.players = players ? new Set(players) : new Set(Object.values(this.game.players));
    }

    start(none?: string) {
        const choices = new Map<string, OathPlayer | undefined>();
        for (const player of this.players)
            if (player.original !== this.player.original || this.canChooseSelf)
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
        new MoveWorldCardToAdvisersEffect(this.game, this.player, adviser, this.target).do()
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
        if (this.player.original === this.game.oathkeeper.original) amount--;
        if (this.player.original === peoplesFavor?.owner?.original) amount--;
        if (this.target.original === this.game.oathkeeper.original) amount++;
        if (this.target.original === peoplesFavor?.owner?.original) amount++;

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
        super(player, true);  // Don't copy, they're not modifiable, are not entry points, and can be used to modify data in other actions
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

export class CampaignBanishPlayerAction extends ChooseSite {
    readonly message: string;

    banished: OathPlayer;

    constructor(player: OathPlayer, banished: OathPlayer) {
        super(player);
        this.banished = banished;
        this.message = "Choose where to banish " + banished.name;
    }

    execute() {
        super.execute();
        if (!this.target) return;
        new TravelEffect(this.banished, this.target, this.player).do();
    }
}

export class ActAsIfAtSiteAction extends ChooseSite {
    readonly message = "Choose a site to act at";
    readonly autocompleteSelects = false;
    readonly canChooseCurrentSite = true;

    execute(): void {
        super.execute();
        if (!this.target) return;
        this.player.site = this.target;
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
        this.next = next;
        this.effect = next?.effect || new BindingExchangeEffect(other, player);
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
            new AskForPermissionAction(this.other, this.effect).doNext();
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
        new AskForPermissionAction(this.player, new TakeReliquaryRelicEffect(this.player, index)).doNext();
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
                if (i !== this.game.original.oath.type)
                    choices.set(OathTypeName[i], i);
        }
        this.selects.oath = new SelectNOf("Oath", choices);
        return super.start();
    }

    execute(): void {
        const oathType = this.parameters.oath[0];
        this.game.oath = new OathTypeToOath[oathType](this.game.original);
    }
}

export class ChooseNewCitizensAction extends OathAction {
    readonly selects: { players: SelectNOf<OathPlayer> };
    readonly parameters: { players: OathPlayer[] };
    readonly message = "Propose Citizenship to other Exiles";

    start() {
        const choices = new Map<string, OathPlayer>();
        const players = new Set(Object.values(this.game.players).filter(e => !e.isImperial && e.original !== this.player.original));
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
            new AskForPermissionAction(citizen, new BecomeCitizenEffect(citizen)).doNext();
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
            new ChangeEdificeEffect(card, false).do();
        else
            new BuildEdificeFromDenizenEffect(card).do();
    }
}

export class AddCardsToWorldDeckAction extends ChooseSuit {
    readonly message = "Choose a suit to add to the World Deck";

    constructor(player: OathPlayer) {
        let max = 0;
        const suits: OathSuit[] = [];
        for (let i: OathSuit = 0; i < 6; i++) {
            const count = player.adviserSuitCount(i);
            if (count >= max) {
                max = count;
                suits.splice(0, suits.length, i);
            } else if (count === max) {
                suits.push(i);
            }
        }
        super(player, suits);
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
        const worldDeck = this.game.original.worldDeck;
        const worldDeckDiscardOptions = new DiscardOptions(worldDeck, false, true);
        for (let i = 3; i >= 1; i--) {
            const cardData = this.getRandomCardDataInArchive(this.suit);
            for (let j = 0; j < i; j++) {
                const key = cardData.pop();
                if (!key) break;
                const data = this.game.archive[key];
                if (!data) break;
                delete this.game.archive[key];

                new DiscardCardEffect(this.player, new Denizen(this.game.original, ...data), worldDeckDiscardOptions).do();
            }

            this.suit++;
            if (this.suit > OathSuit.Nomad) this.suit = OathSuit.Discord;
        }

        // Remove cards to the Dispossessed
        const firstDiscard = Object.values(this.game.original.board.regions)[0].discard;
        const firstDiscardOptions = new DiscardOptions(firstDiscard, false, true);
        for (const player of Object.values(this.game.original.players)) {
            let discardOptions = firstDiscardOptions;
            if (player === this.player) discardOptions = worldDeckDiscardOptions;
            new DiscardCardGroupEffect(this.player, player.advisers, discardOptions).do();
        }
        for (const region of Object.values(this.game.original.board.regions)) {
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
            this.game.original.dispossessed.push(card.data);
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
