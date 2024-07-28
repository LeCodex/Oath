import { WorldCard } from "../cards/base";
import { Site } from "../cards/sites";
import { Denizen } from "../cards/denizens";
import { SearchableDeck } from "../cards/decks";
import { AttackDie, DefenseDie } from "../dice";
import { MoveResourcesToTargetEffect, PutWarbandsFromBagEffect, PayCostToTargetEffect, TakeResourcesFromBankEffect, PutResourcesOnTargetEffect, TravelEffect, DrawFromDeckEffect, DiscardCardEffect, PlayWorldCardEffect, DiscardCardGroupEffect, RollDiceEffect, TakeWarbandsIntoBagEffect, MoveOwnWarbandsEffect, SetUsurperEffect, PaySupplyEffect } from "../effects/basic";
import { WinGameEffect, ChangePhaseEffect, NextTurnEffect } from "../effects/phases";
import { OathResource, OathSuit, OathPhase } from "../enums";
import { OathGameObject } from "../gameObject";
import { OathPlayer, Exile } from "../player";
import { CapacityModifier } from "../powers/base";
import { ActionModifier } from "./modifiers";
import { ResourceCost, Banner } from "../resources";
import { isExtended, InvalidActionResolution } from "../utils";
import { SelectNOf, SelectBoolean, OathAction, SelectNumber } from "./base";
import { OathEffect } from "../effects/base";
import { ModifiableAction, ChooseModifiers } from "./modifiers";
import { CampaignActionTarget, RecoverActionTarget, SearchDiscardOptions } from "./types";


export abstract class MajorAction extends ModifiableAction {
    readonly autocompleteSelects = false;
    supplyCost: number; // You may set the Supply cost if the effect replaces it. Multiple instances will just be tie-broken with timestamps
    supplyCostModifier = 0; // Use this for linear modifications to the Supply cost
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


export class MusterAction extends MajorAction {
    readonly selects: { card: SelectNOf<Denizen>; };
    readonly parameters: { card: Denizen[]; };
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
    readonly selects: { card: SelectNOf<Denizen>; forFavor: SelectBoolean; };
    readonly parameters: { card: Denizen[]; forFavor: boolean[]; };
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
    readonly selects: { site: SelectNOf<Site>; };
    readonly parameters: { site: Site[]; };
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


export class RecoverAction extends MajorAction {
    readonly selects: { target: SelectNOf<RecoverActionTarget>; };
    readonly parameters: { target: RecoverActionTarget[]; };
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
    readonly selects: { amount: SelectNumber; };
    readonly parameters: { amount: number[]; };
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
    readonly selects: { deck: SelectNOf<SearchableDeck>; };
    readonly parameters: { deck: SearchableDeck[]; };
    readonly message = "Draw 3 cards from a deck";

    deck: SearchableDeck;
    amount = 3;
    fromBottom = false;
    discardOptions = new SearchDiscardOptions(this.player.discard);

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

export class SearchChooseAction extends ModifiableAction {
    readonly selects: { cards: SelectNOf<WorldCard>; };
    readonly parameters: { cards: WorldCard[]; };
    readonly message = "Choose which card(s) to keep";

    cards: Set<WorldCard>;
    playing: WorldCard[]; // For this action, order is important
    playingAmount: number;
    discardOptions: SearchDiscardOptions;

    constructor(player: OathPlayer, cards: Iterable<WorldCard>, discardOptions?: SearchDiscardOptions, amount: number = 1) {
        super(player);
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard);
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
    readonly selects: { cards: SelectNOf<WorldCard>; };
    readonly parameters: { cards: WorldCard[]; };
    readonly autocompleteSelects = false;
    readonly message = "Choose the order of the discards";

    cards: Set<WorldCard>;
    discarding: WorldCard[]; // For this action, order is important
    amount: number;
    discardOptions: SearchDiscardOptions;

    constructor(player: OathPlayer, cards: Iterable<WorldCard>, amount?: number, discardOptions?: SearchDiscardOptions) {
        super(player);
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard);
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
    readonly selects: { site: SelectNOf<Site | undefined>; facedown: SelectBoolean; };
    readonly parameters: { site: (Site | undefined)[]; facedown: boolean[]; };
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
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard);
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

    static getCapacityInformation(player: OathPlayer, site?: Site, playing?: WorldCard, facedown: boolean = !!playing && playing.facedown): [number, WorldCard[], boolean] {
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

        return [capacity, [...target].filter(e => !takesNoSpace.has(e)), ignoresCapacity];
    }

    modifiedExecution() {
        const [capacity, takesSpaceInTarget, ignoresCapacity] = SearchPlayAction.getCapacityInformation(this.player, this.site?.original, this.card, this.facedown);

        const excess = Math.max(0, takesSpaceInTarget.length - capacity); // +1 because we are playing a card there, if it counts
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
    readonly selects: { discarding: SelectNOf<WorldCard>; };
    readonly parameters: { discarding: WorldCard[]; };
    readonly message: string;

    playing: WorldCard;
    site?: Site;
    facedown: boolean;
    discardable: Set<WorldCard>;
    excess: number;
    discardOptions: SearchDiscardOptions;
    discarding: WorldCard[]; // For this action, order is important
    onBottom = false;

    constructor(player: OathPlayer, playing: WorldCard, facedown: boolean, site: Site | undefined, discardable: Iterable<WorldCard>, excess: number, discardOptions?: SearchDiscardOptions) {
        super(player);
        this.playing = playing;
        this.message = "Discard cards to play " + playing.name;
        this.facedown = facedown;
        this.site = site;
        this.discardable = new Set(discardable);
        this.excess = excess;
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard);
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
    readonly selects: { card: SelectNOf<Denizen>; };
    readonly parameters: { card: Denizen[]; };
    readonly message = "You may discard a card";

    discardOptions: SearchDiscardOptions;

    constructor(player: OathPlayer, discardOptions?: SearchDiscardOptions) {
        super(player);
        this.discardOptions = discardOptions || new SearchDiscardOptions(player.discard);
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
        new DiscardCardEffect(this.player, card, this.discardOptions).do();
    }
}


export class CampaignAction extends MajorAction {
    readonly selects: { defender: SelectNOf<OathPlayer | undefined>; };
    readonly parameters: { defender: (OathPlayer | undefined)[]; };
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

export class CampaignAtttackAction extends ModifiableAction {
    readonly selects: { targets: SelectNOf<CampaignActionTarget>; pool: SelectNumber; };
    readonly parameters: { targets: CampaignActionTarget[]; pool: number[]; };
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
            for (const relic of defender.relics) choices.set(relic.name, relic);
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
        super(player, true); // Don't copy because this is a big chain
        this.next = new CampaignEndAction(attacker, true); // Same deal
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
    atkForce: number; // TODO: Handle forces correctly, in particular for killing
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
                pawnTargeted = true;
                continue;
            }

            // TODO: Make that modular
            if (target instanceof Site) {
                if (this.defender?.site.original === target.original) pawnTargeted = true;
                total += this.defender ? target.getWarbands(this.defender) : target.bandits;
                continue;
            }
        }

        this.defForce = total + (this.defender && pawnTargeted ? this.defender.totalWarbands : 0);
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
    readonly selects: { doSacrifice: SelectBoolean; };
    readonly parameters: { doSacrifice: boolean[]; };
    readonly message = "Sacrifice is needed to win";

    campaignResult = new CampaignResult(this.game);
    doSacrifice: boolean;

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
    readonly selects: { amount: SelectNumber; };
    readonly parameters: { amount: number[]; };
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
    readonly selects: { site: SelectNOf<Site>; };
    readonly parameters: { site: Site[]; };
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
        if (this.game.oathkeeper === this.player && !this.player.isImperial)
            if (this.game.isUsurper)
                return new WinGameEffect(this.player).do();

            else
                new SetUsurperEffect(this.game, true).do();

        if (this.player instanceof Exile && this.player.vision && this.game.worldDeck.visionsDrawn >= 3) {
            const candidates = this.player.vision.oath.getCandidates();
            if (candidates.size === 1 && candidates.has(this.player))
                return new WinGameEffect(this.player).do();
        }

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
