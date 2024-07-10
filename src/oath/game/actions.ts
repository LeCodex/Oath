import { Denizen, Site, WorldCard } from "./cards/cards";
import { SearchableDeck } from "./cards/decks";
import { MoveBankResourcesEffect, MoveResourcesToTargetEffect, PayCostToTargetEffect, PlayWorldCardEffect, PutResourcesIntoBankEffect, PutWarbandsFromBagEffect, RollDiceEffect, DrawFromDeckEffect, TakeResourcesFromBankEffect, TakeWarbandsIntoBagEffect, TravelEffect, DiscardCardEffect, MoveOwnWarbandsEffect, AddActionToStackEffect } from "./effects";
import { OathResource, OathSuit, OathSuitName } from "./enums";
import { OathGame, OathGameObject } from "./game";
import { OathPlayer } from "./player";
import { ActionModifier, ActivePower, SearchPlayActionModifier } from "./power";
import { Banner, PeoplesFavor, ResourceCost } from "./resources";



////////////////////////////////////////////
//              SELECTORS                 //
////////////////////////////////////////////
export class SelectNOf<T> {
    choices: Map<string, T>;
    min: number;
    max: number;

    constructor(choices: Iterable<[string, T]>, min: number = -1, max?: number, exact: boolean = true) {
        this.choices = new Map(choices);

        if (max === undefined) max = min == -1 ? Infinity : min;
        if (min > max) throw Error("Min is above max");
        if (this.choices.size < min && exact) throw Error("Not enough choices");

        this.min = min;
        this.max = max;
    }

    parse(input: Iterable<string>): T[] | undefined {
        const values: T[] = [];
        for (const val of input) {
            const obj = this.choices.get(val);
            if (obj) values.push(obj);
        }
        if (values.length < this.min || values.length > this.max) return undefined;

        return values;
    }
}

export class SelectBoolean extends SelectNOf<boolean> {
    constructor(text: [string, string]) {
        super([[text[0], true], [text[1], false]], 1);
    }
}

export class SelectNumber extends SelectNOf<number> {
    constructor(values: number[], min?: number, max?: number) {
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
    readonly player: OathPlayer;
    readonly selects: StringObject<SelectNOf<any>>;
    readonly parameters: StringObject<any>;
    readonly autocompleteSelects: boolean = true;

    constructor(player: OathPlayer) {
        super(player.game);
        this.player = player;
    }

    parse(data: StringObject<string[]>): StringObject<any[]> | undefined {
        const values: StringObject<any[]> = {};
        for (const [k, select] of Object.entries(this.selects)) {
            if (!(k in data)) return undefined;
            const value = select.parse(data[k]);
            if (!value) return undefined;
            values[k] = value;
        }

        return values;
    }

    applyParameters(values: StringObject<any[]>) {
        for (const [key, value] of Object.entries(values)) {
            this.parameters[key] = value;
        }
    }

    start() {
        // Setup the selects here

        const values: StringObject<string[]> = {};
        if (this.autocompleteSelects) {
            for (const [key, select] of Object.entries(this.selects)) {
                if (select.choices.size === 1) {
                    for (const [k, v] of select.choices.entries()) values[k] = [v];
                } else if (select.choices.size === 0) {
                    values[key] = [];
                }
            }
        }

        // If all needed parameters were filled out, just execute immediately
        if (Object.keys(values).length === Object.keys(this.selects).length)
            this.game.continueAction(values);
    }

    abstract execute(): void;
}

export class ChooseModifiers extends OathAction {
    readonly selects: { modifiers: SelectNOf<ActionModifier<any>> };
    readonly parameters: { modifiers: ActionModifier<any>[] };
    readonly next: ModifiableAction;
    readonly executeImmediately: boolean;

    constructor(next: ModifiableAction, executeImmediately: boolean = false) {
        super(next.player);
        this.next = next;
        this.executeImmediately = executeImmediately;
    }

    start() {
        const choices = new Map<string, ActionModifier<any>>();
        for (const modifier of ChooseModifiers.gatherModifiers(this.game, this.next)) {
            if (modifier.mustUse)
                this.parameters.modifiers.push(modifier);
            else
                choices.set(modifier.name, modifier);
        }
        this.selects.modifiers = new SelectNOf(choices);

        for (const modifier of choices.values())
            modifier.applyImmediately([...choices.values()])

        super.start();
    }

    static gatherModifiers(game: OathGame, action: ModifiableAction): ActionModifier<any>[] {
        const instances: ActionModifier<any>[] = [];

        for (const [source, modifier] of game.getPowers(ActionModifier<any>)) {
            if (!(action instanceof modifier.prototype.modifiedAction)) continue;

            const instance = new modifier(source, action);
            if (instance.canUse()) instances.push(instance);
        };

        return instances;
    }

    execute() {
        const modifiers = this.parameters.modifiers;
        if (!this.next.applyModifiers(modifiers)) return;

        if (this.executeImmediately) {
            this.next.execute();
        } else {
            new AddActionToStackEffect(this.next).do();
        }
    }
}

export abstract class ModifiableAction extends OathAction {
    readonly parameters: { modifiers: ActionModifier<any>[], [key: string]: any };

    applyModifiers(modifiers: ActionModifier<any>[]): boolean {
        this.parameters.modifiers = modifiers;

        let interrupt = false;
        for (const modifier of modifiers) {
            if (!new PayCostToTargetEffect(this.game, this.player, modifier.cost, modifier.source).do())
                throw new InvalidActionResolution("Cannot pay the resource cost of all the modifiers.");

            if (!modifier.applyBefore()) interrupt = true;
        }
        if (interrupt) return false;

        return true;
    }

    execute() {
        for (const modifier of this.parameters.modifiers) modifier.applyDuring();
        this.modifiedExecution();
        for (const modifier of this.parameters.modifiers) modifier.applyAfter();
    }

    abstract modifiedExecution(): void;
}

export abstract class MajorAction extends ModifiableAction {
    readonly autocompleteSelects = false;
    supplyCost: number;         // You may set the Supply cost if the effect replaces it. Multiple instances will just be tie-broken with timestamps
    supplyCostModifier = 0;     // Use this for linear modifications to the Supply cost
    noSupplyCost: boolean;
    get actualSupplyCost() { return this.noSupplyCost ? 0 : this.supplyCost + this.supplyCostModifier; }

    modifiedExecution() {
        if (!this.player.paySupply(this.actualSupplyCost)) throw new InvalidActionResolution(`Cannot pay Supply cost (${this.actualSupplyCost}).`);
    }
}



////////////////////////////////////////////
//              MAJOR ACTIONS             //
////////////////////////////////////////////
export class MusterAction extends MajorAction {
    readonly selects: { card: SelectNOf<Denizen> };
    readonly parameters: { modifiers: ActionModifier<any>[], cards: Denizen[] };

    supplyCost = 1;
    card: Denizen;
    using = OathResource.Favor;
    amount = 1;

    start() {
        const choices = new Map<string, Denizen>();
        for (const denizen of this.player.site.denizens) if (denizen.suit !== OathSuit.None) choices.set(denizen.name, denizen);
        this.selects.card = new SelectNOf(choices, 1);
        super.start();
    }

    execute() {
        this.card = this.parameters.cards[0];
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        if (new MoveResourcesToTargetEffect(this.game, this.player, OathResource.Favor, 1, this.card).do() < 1)
            throw new InvalidActionResolution("Cannot pay resource cost.");

        new PutWarbandsFromBagEffect(this.player, this.amount).do();
    }
}


export class TradeAction extends MajorAction {
    readonly selects: { card: SelectNOf<Denizen>, forFavor: SelectBoolean };
    readonly parameters: { modifiers: ActionModifier<any>[], cards: Denizen[], forFavor: boolean };

    supplyCost = 1;
    card: Denizen;
    forFavor: boolean;
    paying: Map<OathResource, number>;
    getting: Map<OathResource, number>;

    start() {
        const choices = new Map<string, Denizen>();
        for (const denizen of this.player.site.denizens) if (denizen.suit !== OathSuit.None) choices.set(denizen.name, denizen);
        this.selects.card = new SelectNOf(choices, 1);
        this.selects.forFavor = new SelectBoolean(["For favors", "For secrets"]);
        super.start();
    }

    execute() {
        this.card = this.parameters.cards[0];
        this.forFavor = this.parameters.forFavor;
        this.paying = new Map([[this.forFavor ? OathResource.Secret : OathResource.Favor, this.forFavor ? 1 : 2]]);
        this.getting = new Map([[this.forFavor ? OathResource.Favor : OathResource.Secret, (this.forFavor ? 1 : 0) + this.player.adviserSuitCount(this.card.suit)]]);;
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();        
        // TODO: Make costs easily printable. Potentially get the error from the ResourceCost class?
        if (!new PayCostToTargetEffect(this.game, this.player, new ResourceCost(this.paying), this.card).do())
            throw new InvalidActionResolution("Cannot pay resource cost.");

        new TakeResourcesFromBankEffect(this.game, this.player, this.game.favorBanks.get(this.card.suit), this.getting.get(OathResource.Favor) || 0).do();
        this.player.putResources(OathResource.Secret, this.getting.get(OathResource.Secret) || 0);
    }
}


export class TravelAction extends MajorAction {
    readonly selects: { site: SelectNOf<Site> };
    readonly parameters: { modifiers: ActionModifier<any>[], sites: Site[] };

    site: Site;

    start() {
        const choices = new Map<string, Site>();
        for (const region of this.game.board.regions.values()) {
            for (const site of region.sites) {
                choices.set(site.name, site);
            }
        }
        this.selects.site = new SelectNOf(choices, 1);
        super.start();
    }

    execute() {
        this.site = this.parameters.sites[0];
        this.supplyCost = this.player.site.region.travelCosts.get(this.site.region) || 2;
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
    readonly parameters: { modifiers: ActionModifier<any>[], targets: RecoverActionTarget[] };
    
    supplyCost = 1;
    target: RecoverActionTarget;

    start() {
        const choices = new Map<string, RecoverActionTarget>();
        for (const relic of this.player.site.relics) if (relic.canRecover(this)) choices.set(relic.name, relic);
        for (const banner of this.game.banners.values()) if (banner.canRecover(this)) choices.set(banner.name, banner);
        this.selects.target = new SelectNOf(choices, 1);
        super.start();
    }

    execute() {
        this.target = this.parameters.targets[0];
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        this.target.recover(this.player);
    }
}

export class RecoverBannerPitchAction extends OathAction {
    readonly selects: { amount: SelectNumber };
    readonly parameters: { amount: number };

    banner: Banner;

    constructor(player: OathPlayer, banner: Banner) {
        super(player);
        this.banner = banner;
    }

    start() {
        const values: number[] = [];
        for (let i = this.banner.amount + 1; i <= this.player.getResources(this.banner.type); i++) values.push(i);
        this.selects.amount = new SelectNumber(values);
        super.start();
    }

    execute() {
        new PutResourcesIntoBankEffect(this.game, this.player, this.banner, this.parameters.amount).do();
    }
}


export class SearchAction extends MajorAction {
    readonly selects: { deck: SelectNOf<SearchableDeck> };
    readonly parameters: { modifiers: ActionModifier<any>[], decks: SearchableDeck[] };

    deck: SearchableDeck;
    amount = 3;
    fromBottom = false;
    discardOptions = new SearchDiscardOptions(this.player.discard, false);

    start() {
        const choices = new Map<string, SearchableDeck>();
        choices.set("World Deck", this.game.worldDeck);
        choices.set(this.player.site.region.name, this.player.site.region.discard);
        this.selects.deck = new SelectNOf(choices, 1);
        super.start();
    }

    execute() {
        this.deck = this.parameters.decks[0];
        this.supplyCost = this.deck.searchCost;
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        const cards = new DrawFromDeckEffect(this.player, this.deck, this.amount, this.fromBottom).do();
        new AddActionToStackEffect(new ChooseModifiers(new SearchChooseAction(this.player, cards, this.discardOptions))).do();
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
    readonly parameters: { modifiers: ActionModifier<any>[], cards: WorldCard[] }

    cards: Set<WorldCard>;
    playing: WorldCard[];  // For this action, order is important
    playingAmount: number;
    discardOptions: SearchDiscardOptions;

    constructor(player: OathPlayer, cards: Iterable<WorldCard>, discardOptions?: SearchDiscardOptions, amount: number = 1) {
        super(player);
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard, false);
        this.cards = new Set(cards);
        this.playingAmount = Math.max(amount, this.cards.size);
    }

    start() {
        const cardsChoice = new Map<string, WorldCard>();
        for (const card of this.cards) cardsChoice.set(card.name, card);
        this.selects.cards = new SelectNOf(cardsChoice, 0, this.playingAmount);
        super.start();
    }

    execute(): void {
        this.playing = this.parameters.cards;
        super.execute();
    }

    modifiedExecution(): void {
        for (const card of this.playing.reverse()) {  // Reversing so the stack order follows the expected order
            new AddActionToStackEffect(new SearchPlayAction(this.player, card, this.discardOptions)).do();
            this.cards.delete(card);
        }

        // The action stack is FIFO, so the discards will be done first
        new AddActionToStackEffect(new SearchDiscardAction(this.player, this.cards, Infinity, this.discardOptions)).do();
    }
}

export class SearchPlayAction extends ModifiableAction {
    readonly selects: { site: SelectNOf<Site | undefined>, facedown: SelectBoolean }
    readonly parameters: { modifiers: SearchPlayActionModifier<any>[], sites: (Site | undefined)[], facedown: boolean }
    
    card: WorldCard;
    site: Site | undefined;
    facedown: boolean;
    discardOptions: SearchDiscardOptions;
    canReplace: boolean;
    capacity: number;
    excess: number;

    constructor(player: OathPlayer, card: WorldCard, discardOptions?: SearchDiscardOptions) {
        super(player);
        this.card = card;
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard, false);
    }

    start() {
        const sitesChoice = new Map<string, Site | undefined>();
        sitesChoice.set("Advisers", undefined);
        sitesChoice.set(this.player.site.name, this.player.site);
        this.selects.site = new SelectNOf(sitesChoice, 1);

        this.selects.facedown = new SelectBoolean(["Facedown", "Faceup"]);
        super.start();
    }

    execute() {
        this.site = this.parameters.sites[0];
        this.facedown = this.parameters.facedown;
        this.canReplace = this.site === undefined;
        this.capacity = this.site ? this.site.capacity : 3;
        super.execute();
    }

    modifiedExecution() {
        for (const power of this.card.powers)
            if (isExtended(power, SearchPlayActionModifier)) new power(this.card, this).applyOnPlay();

        this.excess = (this.site ? this.site.denizens.size : this.player.advisers.size) - this.capacity + 1;
        if (this.excess)
            if (this.canReplace)
                new AddActionToStackEffect(new SearchReplaceAction(this.player, this.card, this.facedown, this.site, this.excess, this.discardOptions)).do();
            else
                throw new InvalidActionResolution("Target is full, cannot play a card to it.");
        else
            new PlayWorldCardEffect(this.player, this.card, this.facedown, this.site).do();
    }
}

export class SearchDiscardAction extends ModifiableAction {
    readonly selects: { cards: SelectNOf<WorldCard> }
    readonly parameters: { modifiers: ActionModifier<any>[], cards: WorldCard[] };

    cards: WorldCard[];  // For this action, order is important
    amount: number;
    discardOptions: SearchDiscardOptions;

    constructor(player: OathPlayer, cards: Iterable<WorldCard>, amount?: number, discardOptions?: SearchDiscardOptions) {
        super(player);
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard, false);
        this.cards = [...cards];
        this.amount = Math.max(this.cards.length, amount || this.cards.length);
    }

    start() {
        const choices = new Map<string, WorldCard>();
        for (const card of this.cards) {
            this.cards.push(card);
            choices.set(card.name, card);
        }

        this.selects.cards = new SelectNOf(choices, this.amount);
        super.start();
    }

    execute(): void {
        this.cards = this.parameters.cards;
        super.execute();
    }

    modifiedExecution(): void {
        for (const card of this.cards) new DiscardCardEffect(this.player, card, this.discardOptions.discard, this.discardOptions.onBottom).do();
    }
}

export class SearchReplaceAction extends ModifiableAction {
    readonly selects: { cards: SelectNOf<WorldCard> }
    readonly parameters: { modifiers: ActionModifier<any>[], cards: WorldCard[] };

    playing: WorldCard;
    discarding: WorldCard[];  // For this action, order is important
    site?: Site;
    facedown: boolean;
    excess: number;
    discardOptions: SearchDiscardOptions;
    onBottom = false;

    constructor(player: OathPlayer, playing: WorldCard, facedown: boolean, site: Site | undefined, excess: number, discardOptions?: SearchDiscardOptions) {
        super(player);
        this.playing = playing;
        this.facedown = facedown;
        this.site = site;
        this.excess = excess;
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard, false);
    }

    start() {
        const choices = new Map<string, WorldCard>();
        const source = this.site?.denizens || this.player.advisers;
        for (const card of source) if (!(card instanceof Denizen && card.activelyLocked)) choices.set(card.name, card);
        this.selects.cards = new SelectNOf(choices, this.excess);
        super.start();
    }

    execute(): void {
        this.discarding = this.parameters.cards;
        super.execute();
    }

    modifiedExecution(): void {
        for (const card of this.discarding) new DiscardCardEffect(this.player, card, this.discardOptions.discard, this.discardOptions.onBottom).do();
        new PlayWorldCardEffect(this.player, this.playing, this.facedown, this.site).do();
    }
}

export class PeoplesFavorDiscardAction extends OathAction {
    readonly selects: { card: SelectNOf<Denizen> };
    readonly parameters: { card: Denizen[] };

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
        super.start();
    }

    execute(): void {
        if (this.parameters.card.length === 0) return;
        const card = this.parameters.card[0];
        new DiscardCardEffect(this.player, card, this.discardOptions.discard, this.discardOptions.onBottom);
    }
}


export class CampaignAction extends MajorAction {
    readonly selects: { defender: SelectNOf<OathPlayer | undefined> };
    readonly parameters: { modifiers: ActionModifier<any>[], defenders: (OathPlayer | undefined)[] };
    
    supplyCost = 2;
    defender: OathPlayer | undefined;

    start() {
        const choices = new Map<string, OathPlayer | undefined>();
        for (const player of this.game.players) choices.set(player.name, player);
        if (this.player.site.ruler === undefined) choices.set("Bandits", undefined);
        this.selects.defender = new SelectNOf(choices, 1);
        super.start();
    }

    execute() {
        this.defender = this.parameters.defenders[0];
        super.execute();
    }

    modifiedExecution() {
        super.modifiedExecution();
        const next = new CampaignAtttackAction(this.player, this.defender);
        new AddActionToStackEffect(new ChooseModifiers(next)).do();
    }
}

export interface CampaignActionTarget {
    defense: number;
    takenFromPlayer: boolean;

    seize(player: OathPlayer): void;
};

export class CampaignAtttackAction extends ModifiableAction {
    readonly selects: { targets: SelectNOf<CampaignActionTarget>, pool: SelectNumber };
    readonly parameters: { modifiers: ActionModifier<any>[], targets: CampaignActionTarget[], pool: number };
    readonly next: CampaignDefenseAction;

    constructor(player: OathPlayer, defender: OathPlayer | undefined) {
        super(player);
        this.campaignResult.defender = defender;
        this.next = new CampaignDefenseAction(defender || this.player);
    }

    start() {
        const defender = this.campaignResult.defender;

        let targetingOwnSite = false
        const choices = new Map<string, CampaignActionTarget>();
        for (const region of this.game.board.regions.values()) {
            for (const site of region.sites) {
                if (site.ruler === defender) {
                    if (this.player.site === site) {
                        this.parameters.targets.push(site);
                        targetingOwnSite = true;
                    } else {
                        choices.set(site.name, site);
                    }
                }
            }
        }

        if (defender && defender.site === this.player.site) {
            choices.set("Banish " + defender.name, defender);
            for (const relic of defender.relics) choices.set(relic.name, relic)
            for (const banner of defender.banners) choices.set(banner.name, banner);
        }
        this.selects.targets = new SelectNOf(choices, targetingOwnSite ? 0 : 1);

        const values: number[] = [];
        for (let i = 0; i <= this.player.ownWarbands; i++) values.push(i);
        this.selects.pool = new SelectNumber(values);
        
        super.start();
    }

    get campaignResult() { return this.next.campaignResult; }

    execute() {
        this.campaignResult.targets = this.parameters.targets;
        this.campaignResult.atkPool = this.parameters.pool;
        this.campaignResult.defPool = 0;
        for (const target of this.parameters.targets) this.campaignResult.defPool += target.defense;

        this.campaignResult.resolveDefForce();
        this.campaignResult.resolveAtkForce();
        super.execute();
    }

    modifiedExecution() {
        if (this.campaignResult.defender) {
            new AddActionToStackEffect(new ChooseModifiers(this.next, true)).do();
            return;
        }

        // Bandits use all battle plans that are free
        const modifiers: ActionModifier<any>[] = [];
        for (const modifier of ChooseModifiers.gatherModifiers(this.game, this)) {
            if (modifier.mustUse || modifier.cost.free)
                modifiers.push(modifier);
        };

        if (this.next.applyModifiers(modifiers)) {
            this.next.execute();
        }
    }
}

export class CampaignDefenseAction extends ModifiableAction {
    readonly next = new CampaignEndAction(this.player);

    get campaignResult() { return this.next.campaignResult; }

    execute() {
        super.execute();
        this.campaignResult.successful = this.campaignResult.atk > this.campaignResult.def;

        const modifiersChoice = new ChooseModifiers(this.next, true);
        if (this.campaignResult.couldSacrifice) {
            new AddActionToStackEffect(modifiersChoice).do();
            return;
        };

        this.next.parameters.doSacrifice = false;
        modifiersChoice.execute();
    }

    modifiedExecution() {
        this.campaignResult.resolve();
    }
}

class CampaignResult extends OathGameObject {
    attacker: OathPlayer;
    defender: OathPlayer | undefined;
    targets: CampaignActionTarget[];
    atkPool: number;
    defPool: number;
    atkForce: number;  // TODO: Handle forces correctly, in particular for killing
    defForce: number;
    
    atkRoll: number[];
    defRoll: number[];
    successful: boolean;
    
    ignoreSkulls: boolean;
    ignoreKilling: boolean;
    attackerKillsNoWarbands: boolean;
    defenderKillsNoWarbands: boolean;
    attackerKillsEntireForce: boolean;
    defenderKillsEntireForce: boolean;

    attackerLoss: number;
    defenderLoss: number;
    discardAtEnd = new Set<Denizen>();

    get atk() { 
        let total = 0;
        for (const roll of this.atkRoll) total += roll;
        return Math.floor(total);
    };
    get def() {
        let total = 0, mult = 1;
        for (const roll of this.defRoll) {
            if (roll == -1)
                mult *= 2;
            else
                total += roll
        }
        return total * mult + this.defForce;
    };

    get requiredSacrifice() { return this.def - this.atk + 1; }
    get couldSacrifice() { return this.requiredSacrifice > 0 && this.requiredSacrifice < this.atkForce; }

    get winner() { return this.successful ? this.attacker : this.defender }
    get loser() { return this.successful ? this.defender : this.attacker }
    get loserKillsNoWarbands() { return this.successful ? this.defenderKillsNoWarbands : this.attackerKillsNoWarbands }
    get loserKillsEntireForce() { return this.successful ? this.defenderKillsEntireForce : this.attackerKillsEntireForce }

    resolveAtkForce() {
        this.atkForce = this.attacker.ownWarbands;
    }
    
    resolveDefForce() {
        let total = 0, pawnTargeted = false;
        for (const target of this.targets) {
            if (target.takenFromPlayer) {
                if (!pawnTargeted) total += this.defender?.ownWarbands || 0;
                pawnTargeted = true;
                continue;
            }
            
            // TODO: Make that modular
            if (target instanceof Site) {
                total += this.defender ? target.warbands.get(this.defender) || 0 : target.bandits;
                continue;
            }
        }

        this.defForce = total;
    }

    rollAttack() {
        this.atkRoll = new RollDiceEffect(this.game, this.attacker, [0.5, 0.5, 0.5, 1, 1, 2], this.atkPool).do();
    }

    rollDefense() {
        this.defRoll = new RollDiceEffect(this.game, this.defender, [0, 0, 1, 1, 2, -1], this.defPool).do();
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
        if (!this.ignoreKilling && !this.ignoreSkulls)
            this.attackerKills(this.atkRoll.filter(e => e === 2).length);
    }
}

export class CampaignEndAction extends ModifiableAction {
    readonly selects: { doSacrifice: SelectBoolean };
    readonly parameters: { modifiers: ActionModifier<any>[], doSacrifice: boolean };
    
    campaignResult = new CampaignResult(this.game);
    doSacrifice: boolean

    start() {
        this.selects.doSacrifice = new SelectBoolean([`Sacrifice ${this.campaignResult.requiredSacrifice} warbands`, "Lose"]);
        super.start();
    }

    execute() {
        this.doSacrifice = this.parameters.doSacrifice;
        super.execute();
    }

    modifiedExecution() {
        if (this.doSacrifice) {
            this.campaignResult.attackerKills(this.campaignResult.requiredSacrifice);
            this.campaignResult.successful = true;
        }

        if (this.campaignResult.successful)
            for (const target of this.campaignResult.targets) target.seize(this.campaignResult.attacker);

        if (this.campaignResult.loser && !this.campaignResult.ignoreKilling && !this.campaignResult.loserKillsNoWarbands)
            this.campaignResult.loserKills(Math.floor(this.campaignResult.loser.ownWarbands / (this.campaignResult.loserKillsEntireForce ? 1 : 2)));

        for (const denizen of this.campaignResult.discardAtEnd)
            new DiscardCardEffect(denizen.ruler || this.campaignResult.attacker, denizen).do();
    }
}

export class CampaignSeizeSiteAction extends OathAction {
    readonly selects: { amount: SelectNumber };
    readonly parameters: { amount: number };
    
    site: Site;

    constructor(player: OathPlayer, site: Site) {
        super(player)
        this.site = site;
    }

    start() {
        const values: number[] = [];
        for (let i = 0; i <= this.player.ownWarbands; i++) values.push(i);
        this.selects.amount = new SelectNumber(values);
        super.start();
    }

    execute() {
        new MoveOwnWarbandsEffect(this.player, this.player, this.site, this.parameters.amount).do();
    }
}

export class CampaignBanishPlayerAction extends OathAction {
    readonly selects: { site: SelectNOf<Site> };
    readonly parameters: { site: Site[] };

    target: OathPlayer;

    constructor(player: OathPlayer, target: OathPlayer) {
        super(player);
        this.target = target;
    }

    start() {
        const choices = new Map<string, Site>();
        for (const region of this.game.board.regions.values())
            for (const site of region.sites)
                choices.set(site.name, site);
        
        this.selects.site = new SelectNOf(choices, 1);
        super.start();
    }

    execute() {
        const site = this.parameters.site[0];
        new TravelEffect(this.target, site, this.player).do();
    }
}


export class WakeAction extends ModifiableAction {
    modifiedExecution(): void { }
}


export class RestAction extends ModifiableAction {
    modifiedExecution(): void {
        this.player.rest();
    }
}



////////////////////////////////////////////
//              OTHER ACTIONS             //
////////////////////////////////////////////
export abstract class ChooseSuit extends OathAction {
    readonly selects: { suit: SelectNOf<OathSuit | undefined> };
    readonly parameters: { suit: (OathSuit | undefined)[] };

    suit: OathSuit | undefined;

    start(values?: Iterable<OathSuit>, none?: string) {
        if (!values) values = [OathSuit.Discord, OathSuit.Arcane, OathSuit.Order, OathSuit.Hearth, OathSuit.Beast, OathSuit.Nomad];

        const choices = new Map<string, OathSuit | undefined>();
        for (const suit of values) choices.set(OathSuitName[suit], suit);
        if (none) choices.set(none, undefined);
        this.selects.suit = new SelectNOf(choices, 1);

        super.start();
    }

    execute(): void {
        this.suit = this.parameters.suit[0];
    }
}

export class PeoplesFavorReturnAction extends ChooseSuit {   
    amount: number;

    constructor(player: OathPlayer, amount: number) {
        super(player);
        this.amount = amount;
    }

    execute() {
        super.execute();
        if (!this.suit) return;

        let amount = this.amount;
        while (amount) {
            new PutResourcesIntoBankEffect(this.game, this.player, this.game.favorBanks.get(this.suit), 1, undefined).do();
            amount--;
            if (this.suit++ == OathSuit.None) this.suit = OathSuit.Discord;
        }
    }
}

export class SilverTongueAction extends ChooseSuit {
    execute() {
        super.execute();
        if (!this.suit) return;
        new TakeResourcesFromBankEffect(this.game, this.player, this.game.favorBanks.get(this.suit), 1).do();
    }
}

export class PeoplesFavorWakeAction extends ChooseSuit {
    readonly banner: PeoplesFavor;

    constructor(player: OathPlayer, banner: PeoplesFavor) {
        super(player);
        this.banner = banner;
    }

    start() {
        const suits = new Set<OathSuit>();
        let min = Infinity;
        for (const bank of this.game.favorBanks.values()) if (bank.amount < min) min = bank.amount;
        for (const [suit, bank] of this.game.favorBanks) if (bank.amount === min) suits.add(suit);
        super.start(suits, "Put favor");
    }

    execute(): void {
        super.execute()
        const bank = this.suit && this.game.favorBanks.get(this.suit);

        if (bank)
            new MoveBankResourcesEffect(this.game, this.player, this.banner, bank, 1).do();
        else
            new PutResourcesIntoBankEffect(this.game, this.player, this.banner, 1).do();
    }
}


export class UsePowerAction extends ModifiableAction {
    readonly selects: { power: SelectNOf<ActivePower<any>> }
    readonly parameters: { modifiers: ActionModifier<any>[], power: ActivePower<any>[] };

    power: ActivePower<any>

    start() {
        const choices = new Map<string, ActivePower<any>>();
        for (const [source, power] of this.game.getPowers(ActivePower<any>)) {
            const instance = new power(source, this);
            if (instance.canUse()) choices.set(instance.name, instance);
        }
        super.start();
    }

    modifiedExecution(): void {
        if (!new PayCostToTargetEffect(this.game, this.player, this.power.cost, this.power.source).do())
            throw new InvalidActionResolution("Cannot pay the resource cost.");

        this.power.usePower(this.player);
    }
}