import { Denizen, Relic, Site, WorldCard } from "./cards/cards";
import { SearchableDeck } from "./cards/decks";
import { AttackDie, DefenseDie, Die } from "./dice";
import { MoveBankResourcesEffect, MoveResourcesToTargetEffect, PayCostToTargetEffect, PlayWorldCardEffect, PutResourcesIntoBankEffect, PutWarbandsFromBagEffect, RollDiceEffect, DrawFromDeckEffect, TakeResourcesFromBankEffect, TakeWarbandsIntoBagEffect, TravelEffect, DiscardCardEffect, MoveOwnWarbandsEffect, AddActionToStackEffect, MoveAdviserEffect, MoveWorldCardToAdvisersEffect, SetNewOathkeeperEffect, SetPeoplesFavorMobState, DiscardCardGroupEffect, OathEffect, PopActionFromStackEffect, PaySupplyEffect, ChangePhaseEffect, NextTurnEffect, PutResourcesOnTargetEffect } from "./effects";
import { OathPhase, OathResource, OathResourceName, OathSuit, OathSuitName, PlayerColor } from "./enums";
import { OathGame } from "./game";
import { OathGameObject } from "./gameObject";
import { OathPlayer } from "./player";
import { ActionModifier, ActivePower, CapacityModifier } from "./powers";
import { Banner, PeoplesFavor, ResourceCost, ResourcesAndWarbands } from "./resources";
import { Constructor, getCopyWithOriginal, isExtended } from "./utils";



////////////////////////////////////////////
//                MANAGER                 //
////////////////////////////////////////////
export class OathActionManager extends OathGameObject {
    readonly actionStack: OathAction[] = [];
    readonly futureActionsList: OathAction[] = [];
    readonly currentEffectsStack: OathEffect<any>[] = [];
    readonly pastEffectsStack: OathEffect<any>[][] = [];
    readonly cancelledEffects: OathEffect<any>[] = [];
    noReturn: boolean = false;

    checkForNextAction(): object {
        for (const action of this.futureActionsList) new AddActionToStackEffect(action).do();
        this.futureActionsList.length = 0;

        if (!this.actionStack.length) this.game.checkForOathkeeper();
        let action = this.actionStack[this.actionStack.length - 1];
    
        let values = action?.start();
        if (values) {
            action?.applyParameters(values);
            return this.resolveTopAction();
        }
    
        if (this.noReturn) {
            this.currentEffectsStack.length = 0;
            this.pastEffectsStack.length = 0;
        }
        this.noReturn = false;
    
        const returnData = {
            activeAction: action && {
                message: action.message,
                player: action.player.color,
                modifiers: action instanceof ModifiableAction ? action.modifiers.map(e => e.constructor.name) : undefined,
                selects: Object.fromEntries(Object.entries(action.selects).map(([k, v]) => [k, v.serialize()])),
            },
            appliedEffects: this.currentEffectsStack.map(e => e.constructor.name),
            cancelledEffects: this.cancelledEffects.map(e => e.constructor.name),
            game: this.game.serialize()
        }
        this.cancelledEffects.length = 0;
        return returnData;
    }

    storeEffects() {
        if (this.currentEffectsStack.length) {
            this.pastEffectsStack.push([...this.currentEffectsStack]);
            this.currentEffectsStack.length = 0;
        }
    }

    startAction(action: Constructor<OathAction>): object {
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
        const action = this.actionStack[this.actionStack.length - 1];
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
    choices: Map<string, T>;
    min: number;
    max: number;

    constructor(choices: Iterable<[string, T]>, min: number = -1, max?: number, exact: boolean = true) {
        this.choices = new Map(choices);

        if (max === undefined) max = min == -1 ? this.choices.size : min;
        if (min > max) throw Error("Min is above max");
        if (this.choices.size < min && exact) throw new InvalidActionResolution(`Not enough choices: ${this.choices.size} is below ${min}`);

        this.min = min === -1 ? 0: min;
        this.max = max;
    }

    parse(input: Iterable<string>): T[] {
        const values = new Set<T>();
        for (const val of input) {
            if (!this.choices.has(val)) throw new InvalidActionResolution(`Invalid choice for select: ${val}`);
            const obj = this.choices.get(val);
            values.add(obj as T);  // We know the value exists, and if it's undefined, then we want that
        }
        if (values.size < this.min || values.size > this.max) throw new InvalidActionResolution(`Invalid number of values for select`);

        return [...values];
    }

    serialize(): Record <string, any> {
        return {
            choices: [...this.choices.keys()],
            min: this.min,
            max: this.max
        };
    }
}

export class SelectBoolean extends SelectNOf<boolean> {
    constructor(text: [string, string]) {
        super([[text[0], true], [text[1], false]], 1);
    }
}

export class SelectNumber extends SelectNOf<number> {
    constructor(values: number[], min: number = 1, max?: number) {
        const choices = new Map<string, number>();
        for (const i of values) choices.set(String(i), i);
        super(choices, min, max);
    }
}



//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export class InvalidActionResolution extends Error { }

export abstract class OathAction extends OathGameObject {
    readonly game: OathGame;
    readonly playerColor: PlayerColor;
    readonly selects: Record<string, SelectNOf<any>> = {};
    readonly parameters: Record<string, any> = {};
    readonly autocompleteSelects: boolean = true;
    abstract readonly message: string;

    constructor(player: OathPlayer, dontCopyGame: boolean = false) {
        super(dontCopyGame ? player.game : getCopyWithOriginal(player.game.original));
        this.playerColor = player.color;
    }

    get player() { return this.game.players[this.playerColor]; }

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

    start(): Record<string, string[]> | undefined {
        // NOTE: Setup the selects before
        const values: Record<string, string[]> = {};
        if (this.autocompleteSelects) {
            for (const [key, select] of Object.entries(this.selects)) {
                if (select.choices.size <= select.min) {
                    values[key] = [...select.choices.values()];
                } else if (select.choices.size === 0) {
                    values[key] = [];
                }
            }
        }

        // If all needed parameters were filled out, just execute immediately
        if (Object.keys(values).length === Object.keys(this.selects).length) return values;
    }

    abstract execute(): void;
}

export class ChooseModifiers extends OathAction {
    readonly selects: { modifiers: SelectNOf<ActionModifier<any>> };
    readonly parameters: { modifiers: ActionModifier<any>[] };
    readonly next: ModifiableAction;
    readonly executeImmediately: boolean;
    readonly message = "Choose modifiers";

    persistentModifiers: ActionModifier<any>[] = [];

    constructor(next: ModifiableAction, executeImmediately: boolean = false) {
        super(next.player, true);  // Not copying for performance reasons, since this copy should never be accessed
        this.next = next;
        this.executeImmediately = executeImmediately;
    }

    start() {
        this.persistentModifiers = [];
        const choices = new Map<string, ActionModifier<any>>();
        for (const modifier of ChooseModifiers.gatherModifiers(this.next)) {
            if (modifier.mustUse)
                this.persistentModifiers.push(modifier);
            else
                choices.set(modifier.name, modifier);
        }
        this.selects.modifiers = new SelectNOf(choices);

        for (const modifier of choices.values()) modifier.applyImmediately([...choices.values()]);

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
            if (!new PayCostToTargetEffect(this.game, this.player, modifier.cost, modifier.source).do())
                throw new InvalidActionResolution("Cannot pay the resource cost of all the modifiers.");

            if (!modifier.applyBefore()) interrupt = true;
        }
        if (interrupt) return false;

        return true;
    }

    start(): Record<string, string[]> | undefined {
        for (const modifier of this.modifiers) modifier.applyAtStart();
        return super.start();
    }

    execute() {
        for (const modifier of this.modifiers) modifier.applyDuring();
        this.modifiedExecution();
        for (const modifier of this.modifiers) modifier.applyAfter();
    }

    abstract modifiedExecution(): void;
}

export abstract class MajorAction extends ModifiableAction {
    readonly autocompleteSelects = false;
    supplyCost: number;         // You may set the Supply cost if the effect replaces it. Multiple instances will just be tie-broken with timestamps
    supplyCostModifier = 0;     // Use this for linear modifications to the Supply cost
    noSupplyCost: boolean;
    get actualSupplyCost() { return this.noSupplyCost ? 0 : this.supplyCost + this.supplyCostModifier; }

    start(): Record<string, string[]> | undefined {
        this.supplyCostModifier = 0;
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
        this.selects.card = new SelectNOf(choices, 1);
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
        for (const denizen of this.player.site.denizens) if (denizen.suit !== OathSuit.None && denizen.empty) choices.set(denizen.name, denizen);
        this.selects.card = new SelectNOf(choices, 1);
        this.selects.forFavor = new SelectBoolean(["For favors", "For secrets"]);
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
        
        this.selects.site = new SelectNOf(choices, 1);
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
};

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
        this.selects.target = new SelectNOf(choices, 1);
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
        this.selects.amount = new SelectNumber(values);
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
    discardOptions = new SearchDiscardOptions(this.player.discard, false);

    start() {
        const choices = new Map<string, SearchableDeck>();
        choices.set("World Deck", this.game.worldDeck);
        choices.set(this.player.site.region.name, this.player.site.region.discard);
        this.selects.deck = new SelectNOf(choices, 1);
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

export class SearchDiscardOptions {
    discard: SearchableDeck;
    onBottom: boolean;

    constructor(discard: SearchableDeck, onBottom: boolean) {
        this.discard = discard;
        this.onBottom = onBottom;
    }
}

export class SearchChooseAction extends ModifiableAction {
    readonly selects: { cards: SelectNOf<WorldCard> }
    readonly parameters: { cards: WorldCard[] }
    readonly message = "Choose which card(s) to keep";

    cards: Set<WorldCard>;
    playing: WorldCard[];  // For this action, order is important
    playingAmount: number;
    discardOptions: SearchDiscardOptions;

    constructor(player: OathPlayer, cards: Iterable<WorldCard>, discardOptions?: SearchDiscardOptions, amount: number = 1) {
        super(player);
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard, false);
        this.cards = new Set(cards);
        this.playingAmount = Math.min(amount, this.cards.size);
    }

    start() {
        const cardsChoice = new Map<string, WorldCard>();
        for (const card of this.cards) cardsChoice.set(card.name, card);
        this.selects.cards = new SelectNOf(cardsChoice, 0, this.playingAmount);
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
    discardOptions: SearchDiscardOptions;

    constructor(player: OathPlayer, cards: Iterable<WorldCard>, amount?: number, discardOptions?: SearchDiscardOptions) {
        super(player);
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard, false);
        this.cards = new Set(cards);
        this.amount = Math.min(this.cards.size, amount || this.cards.size);
    }

    start() {
        const choices = new Map<string, WorldCard>();
        for (const card of this.cards) choices.set(card.name, card);
        this.selects.cards = new SelectNOf(choices, this.amount);
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
    discardOptions: SearchDiscardOptions;
    canReplace: boolean;

    constructor(player: OathPlayer, card: WorldCard, discardOptions?: SearchDiscardOptions) {
        super(player);
        this.card = card;
        this.message = "Play " + this.card.name;
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard, false);
    }

    start() {
        const sitesChoice = new Map<string, Site | undefined>();
        sitesChoice.set("Advisers", undefined);
        sitesChoice.set(this.player.site.name, this.player.site);
        this.selects.site = new SelectNOf(sitesChoice, 1);

        this.selects.facedown = new SelectBoolean(["Facedown", "Faceup"]);
        return super.start();
    }

    execute() {
        this.site = this.parameters.site[0];
        this.facedown = this.parameters.facedown[0];
        this.canReplace = this.site === undefined;
        super.execute();
    }

    static getCapacityInformation(player: OathPlayer, site?: Site, playing?: WorldCard, facedown: boolean = !!playing && playing.facedown): [number, Set<WorldCard>, WorldCard[], boolean] {
        const capacityModifiers: CapacityModifier<any>[] = [];
        for (const [source, modifier] of player.game.getPowers(CapacityModifier)) {
            const instance = new modifier(source);
            if (instance.canUse(player, site)) capacityModifiers.push(instance);
        }

        if (playing) {
            for (const modifier of playing.powers) {
                if (isExtended(modifier, CapacityModifier)) {
                    const instance = new modifier(playing);
                    if (instance.canUse(player, site)) capacityModifiers.push(instance);
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
            if (playing) ignoresCapacity ||= capacityModifier.ignoreCapacity(playing, facedown);
        }

        return [capacity, takesNoSpace, [...target].filter(e => !takesNoSpace.has(e)), ignoresCapacity];
    }

    modifiedExecution() {
        const [capacity, takesNoSpace, takesSpaceInTarget, ignoresCapacity] = SearchPlayAction.getCapacityInformation(this.player, this.site, this.card, this.facedown);

        const excess = Math.max(0, takesSpaceInTarget.length - capacity + (takesNoSpace.has(this.card) ? 0 : 1));  // +1 because we are playing a card there, if it counts
        const discardable = takesSpaceInTarget.filter(e => !(e instanceof Denizen && e.activelyLocked));

        if (!ignoresCapacity && excess)
            if (!this.canReplace || excess > discardable.length)
                throw new InvalidActionResolution("Target is full and cards there cannot be replaced");
            else
                new SearchReplaceAction(this.player, this.card, this.facedown, this.site, discardable, excess, this.discardOptions).doNext();
        else
            new PlayWorldCardEffect(this.player, this.card, this.facedown, this.site).do();

        // TODO: Also check capacity AFTER playing the card
    }
}

export class SearchReplaceAction extends OathAction {
    readonly selects: { discarding: SelectNOf<WorldCard> }
    readonly parameters: { discarding: WorldCard[] };
    readonly message: string;

    playing: WorldCard;
    site?: Site;
    facedown: boolean;
    discardable: Set<WorldCard>;
    excess: number;
    discardOptions: SearchDiscardOptions;
    discarding: WorldCard[];  // For this action, order is important
    onBottom = false;

    constructor(player: OathPlayer, playing: WorldCard, facedown: boolean, site: Site | undefined, discardable: Iterable<WorldCard>, excess: number, discardOptions?: SearchDiscardOptions) {
        super(player);
        this.playing = playing;
        this.message = "Discard cards to play " + playing.name;
        this.facedown = facedown;
        this.site = site;
        this.discardable = new Set(discardable);
        this.excess = excess;
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard, false);
    }

    start() {
        const choices = new Map<string, WorldCard>();
        for (const card of this.discardable) choices.set(card.name, card);
        this.selects.discarding = new SelectNOf(choices, this.excess);
        return super.start();
    }

    execute(): void {
        this.discarding = this.parameters.discarding;
        new DiscardCardGroupEffect(this.player, this.discarding, this.discardOptions).do();
        new PlayWorldCardEffect(this.player, this.playing, this.facedown, this.site).do();
    }
}

export class PeoplesFavorDiscardAction extends OathAction {
    readonly selects: { card: SelectNOf<Denizen> };
    readonly parameters: { card: Denizen[] };
    readonly message = "You may discard a card";

    discardOptions: SearchDiscardOptions;

    constructor(player: OathPlayer, discardOptions?: SearchDiscardOptions) {
        super(player);
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard, false);
    }

    start() {
        const choices = new Map<string, Denizen>();
        for (const site of this.player.site.region.sites)
            for (const denizen of site.denizens)
                if (!denizen.activelyLocked) choices.set(denizen.name, denizen);
        this.selects.card = new SelectNOf(choices, 0, 1);
        return super.start();
    }

    execute(): void {
        if (this.parameters.card.length === 0) return;
        const card = this.parameters.card[0];
        new DiscardCardEffect(this.player, card, this.discardOptions);
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
        this.selects.defender = new SelectNOf(choices, 1);
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
    pawnMustBeAtSite: boolean;

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

        if (defender && defender.site === this.player.site) {
            choices.set("Banish " + defender.name, defender);
            for (const relic of defender.relics) choices.set(relic.name, relic)
            for (const banner of defender.banners) choices.set(banner.name, banner);
        }
        this.selects.targets = new SelectNOf(choices, 1 - this.campaignResult.targets.length, choices.size);

        const values: number[] = [];
        for (let i = 0; i <= this.player.totalWarbands; i++) values.push(i);
        this.selects.pool = new SelectNumber(values);
        
        return super.start();
    }

    get campaignResult() { return this.next.campaignResult; }

    execute() {
        this.campaignResult.targets.push(...this.parameters.targets);
        this.campaignResult.atkPool = this.parameters.pool[0];
        
        this.campaignResult.defPool = 0;
        for (const target of this.campaignResult.targets) this.campaignResult.defPool += target.defense;
        if (this.campaignResult.defender === this.game.oathkeeper) this.campaignResult.defPool += this.game.isUsurper ? 2 : 1;

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
        this.campaignResult.successful = this.campaignResult.atk > this.campaignResult.def;

        if (this.campaignResult.couldSacrifice) {
            this.next.doNext();
            return;
        };

        this.next.parameters.doSacrifice = [false];
        this.next.doNext(true);
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
    atkForce: number;   // TODO: Handle forces correctly, in particular for killing
    defForce: number;
    
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

    get atk() { 
        return AttackDie.getResult(this.atkRoll);
    };
    get def() {
        return DefenseDie.getResult(this.defRoll) + this.defForce;
    };

    get requiredSacrifice() { return this.def - this.atk + 1; }
    get couldSacrifice() { return this.requiredSacrifice > 0 && this.requiredSacrifice < this.atkForce - AttackDie.getSkulls(this.atkRoll); }

    get winner() { return this.successful ? this.attacker : this.defender; }
    get loser() { return this.successful ? this.defender : this.attacker; }
    get loserKillsNoWarbands() { return this.successful ? this.defenderKillsNoWarbands : this.attackerKillsNoWarbands; }
    get loserKillsEntireForce() { return this.successful ? this.defenderKillsEntireForce : this.attackerKillsEntireForce; }
    get loserLoss() { return this.successful ? this.defenderLoss : this.attackerLoss; }

    discardAtEnd(denizen: Denizen) {
        this.endEffects.push(new DiscardCardEffect(denizen.ruler || this.attacker, denizen));
    }

    resolveAtkForce() {
        this.atkForce = this.attacker.totalWarbands;
    }
    
    resolveDefForce() {
        let total = 0, pawnTargeted = false;
        for (const target of this.targets) {
            if (target.pawnMustBeAtSite) {
                if (!pawnTargeted) total += this.defender?.totalWarbands || 0;
                pawnTargeted = true;
                continue;
            }
            
            // TODO: Make that modular
            if (target instanceof Site) {
                total += this.defender ? target.getWarbands(this.defender) : target.bandits;
                continue;
            }
        }

        this.defForce = total;
    }

    rollAttack() {
        this.atkRoll = new RollDiceEffect(this.game, this.attacker, AttackDie, this.atkPool).do();
    }

    rollDefense() {
        this.defRoll = new RollDiceEffect(this.game, this.defender, DefenseDie, this.defPool).do();
    }
    
    attackerKills(amount: number) {
        this.attackerLoss += new TakeWarbandsIntoBagEffect(this.attacker, amount).do();
    }

    defenderKills(amount: number) {
        if (!this.defender) return;
        // TODO: Handle defender taking losses. Probably with actions.
        this.defenderLoss += new TakeWarbandsIntoBagEffect(this.defender, amount).do();
    }

    loserKills(amount: number) {
        if (this.successful) this.defenderKills(amount); else this.attackerKills(amount);
    }

    resolve() {
        this.rollAttack();
        this.rollDefense();
    }
}

export class CampaignEndAction extends ModifiableAction {
    readonly selects: { doSacrifice: SelectBoolean };
    readonly parameters: { doSacrifice: boolean[] };
    readonly message = "Sacrifice is needed to win";
    
    campaignResult = new CampaignResult(this.game);
    doSacrifice: boolean

    start() {
        this.selects.doSacrifice = new SelectBoolean([`Sacrifice ${this.campaignResult.requiredSacrifice} warbands`, "Abandon"]);
        return super.start();
    }

    execute() {
        this.doSacrifice = this.parameters.doSacrifice[0];
        super.execute();
    }

    modifiedExecution() {
        if (!this.campaignResult.ignoreKilling && !this.campaignResult.ignoreSkulls)
            this.campaignResult.attackerKills(AttackDie.getSkulls(this.campaignResult.atkRoll));

        if (this.doSacrifice) {
            this.campaignResult.attackerKills(this.campaignResult.requiredSacrifice);
            this.campaignResult.successful = true;
        }

        if (this.campaignResult.successful)
            for (const target of this.campaignResult.targets) target.seize(this.campaignResult.attacker);

        if (this.campaignResult.loser && !this.campaignResult.ignoreKilling && !this.campaignResult.loserKillsNoWarbands)
            this.campaignResult.loserKills(Math.floor(this.campaignResult.loser.original.totalWarbands / (this.campaignResult.loserKillsEntireForce ? 1 : 2)));

        for (const effect of this.campaignResult.endEffects)
            effect.do();

        console.log(this.campaignResult);
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
        for (let i = 0; i <= this.player.original.totalWarbands; i++) values.push(i);
        this.selects.amount = new SelectNumber(values);
        return super.start();
    }

    execute() {
        new MoveOwnWarbandsEffect(this.player, this.player, this.site, this.parameters.amount[0]).do();
    }
}

export class CampaignBanishPlayerAction extends OathAction {
    readonly selects: { site: SelectNOf<Site> };
    readonly parameters: { site: Site[] };
    readonly message: string;

    target: OathPlayer;

    constructor(player: OathPlayer, target: OathPlayer) {
        super(player);
        this.target = target;
        this.message = "Choose where to banish " + target.name;
    }

    start() {
        const choices = new Map<string, Site>();
        for (const site of this.game.board.sites())
            choices.set(site.name, site);
        
        this.selects.site = new SelectNOf(choices, 1);
        return super.start();
    }

    execute() {
        const site = this.parameters.site[0];
        new TravelEffect(this.target, site, this.player).do();
    }
}


export class WakeAction extends ModifiableAction {
    readonly message = "";

    modifiedExecution(): void {
        new ChangePhaseEffect(this.game, OathPhase.Act).doNext();
    }
}


export class RestAction extends ModifiableAction {
    readonly message = "";

    modifiedExecution(): void {
        new ChangePhaseEffect(this.game, OathPhase.Rest).do();
        this.player.original.rest();
        new NextTurnEffect(this.game).doNext();
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
        this.selects.power = new SelectNOf(choices, 1);
        return super.start();
    }

    execute(): void {
        this.power = this.parameters.power[0];
        super.execute();
    }

    modifiedExecution(): void {
        if (!new PayCostToTargetEffect(this.game, this.player, this.power.cost, this.power.source).do())
            throw new InvalidActionResolution("Cannot pay the resource cost.");

        this.power.usePower(this);
    }
}



////////////////////////////////////////////
//              OTHER ACTIONS             //
////////////////////////////////////////////
export class ResolveEffectAction extends OathAction {
    readonly message = "";

    effect: OathEffect<any>;

    constructor(player: OathPlayer, effect: OathEffect<any>) {
        super(player, false);  // Don't copy, not modifiable, and not an entry point
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

    constructor(player: OathPlayer, faces: number[], die: typeof Die) {
        super(player, false);  // Don't copy, not modifiable, and not an entry point
        this.faces = faces;
        this.message = "Do you wish to reroll " + faces.join(",") + "?"
    }

    start() {
        this.selects.doReroll = new SelectBoolean(["Reroll", "Don't reroll"]);
        return super.start();
    }

    execute(): void {
        if (this.parameters.doReroll[0])
            for (const [i, face] of this.die.roll(this.faces.length).entries()) this.faces[i] = face;
    }
}


export abstract class ChooseSuit extends OathAction {
    readonly selects: { suit: SelectNOf<OathSuit | undefined> };
    readonly parameters: { suit: (OathSuit | undefined)[] };

    suits: Set<OathSuit>;
    suit: OathSuit | undefined;

    constructor(player: OathPlayer, suits?: Iterable<OathSuit>) {
        super(player, false);  // Don't copy, they're not modifiable, are not entry points, and can be used to modify data in other actions
        this.suits = new Set(suits);
    }

    start(none?: string) {
        if (!this.suits.size) this.suits = new Set([OathSuit.Discord, OathSuit.Arcane, OathSuit.Order, OathSuit.Hearth, OathSuit.Beast, OathSuit.Nomad]);

        const choices = new Map<string, OathSuit | undefined>();
        for (const suit of this.suits) choices.set(OathSuitName[suit], suit);
        if (none) choices.set(none, undefined);
        this.selects.suit = new SelectNOf(choices, 1);

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
            if (bank && bank.amount) this.suits.delete(suit);
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
        this.selects.resource = new SelectNOf(choices, 1);
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
        super(player, false);  // Don't copy, they're not modifiable, are not entry points, and can be used to modify data in other actions
        this.players = new Set(players);
    }

    start(none?: string) {
        if (!this.players.size)
            this.players = new Set(Object.values(this.game.players).filter(e => e !== this.player));

        const choices = new Map<string, OathPlayer | undefined>();
        for (const player of this.players)
            if (!(player === this.player && !this.canChooseSelf)) choices.set(player.name, player);
        if (none) choices.set(none, undefined);
        this.selects.player = new SelectNOf(choices, 1);

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
        this.selects.taking = new SelectNOf(choices);
        return super.start();
    }

    execute(): void {
        const taking = this.parameters.taking[0];
        taking.seize(this.player);
    }
}


export abstract class ChooseSite extends OathAction {
    readonly selects: { site: SelectNOf<Site | undefined> };
    readonly parameters: { site: (Site | undefined)[] };
    readonly canChooseCurrentSite = false;

    sites: Set<Site>;
    target: Site | undefined;

    constructor(player: OathPlayer, sites?: Iterable<Site>) {
        super(player, false);  // Don't copy, they're not modifiable, are not entry points, and can be used to modify data in other actions
        this.sites = new Set(sites);
    }

    start(none?: string) {
        if (!this.sites.size) this.sites = new Set(this.game.board.sites());

        const choices = new Map<string, Site | undefined>();
        for (const site of this.sites)
            if (!(site === this.player.site && !this.canChooseCurrentSite)) choices.set(site.name, site);
        if (none) choices.set(none, undefined);
        this.selects.site = new SelectNOf(choices, 1);

        return super.start();
    }

    execute(): void {
        this.target = this.parameters.site[0];
    }
}

export class ActAsIfAtSiteAction extends ChooseSite {
    readonly message = "Choose a site to act at";

    execute(): void {
        super.execute();
        if (!this.target) return;
        this.player.site = this.target;
    }
}