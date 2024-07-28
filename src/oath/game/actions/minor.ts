import { WorldCard } from "../cards/base";
import { Site } from "../cards/sites";
import { MoveAdviserEffect, MoveOwnWarbandsEffect } from "../effects/basic";
import { OathPlayer } from "../player";
import { ActivePower } from "../powers/base";
import { SelectNOf, SelectNumber, SelectBoolean, OathAction } from "./base";
import { OathEffect } from "../effects/base";
import { ModifiableAction } from "./modifiers";
import { InvalidActionResolution } from "../utils";
import { SearchPlayAction } from "./major";


export class UsePowerAction extends ModifiableAction {
    readonly selects: { power: SelectNOf<ActivePower<any>>; };
    readonly parameters: { power: ActivePower<any>[]; };
    readonly autocompleteSelects = false;
    readonly message = "Choose a power to use";

    power: ActivePower<any>;

    start() {
        const choices = new Map<string, ActivePower<any>>();
        for (const [source, power] of this.game.getPowers((ActivePower<any>))) {
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
        if (!this.power.payCost(this.player))
            throw new InvalidActionResolution("Cannot pay the resource cost.");

        this.power.usePower(this);
    }
}


export class PlayFacedownAdviserAction extends ModifiableAction {
    readonly selects: { cards: SelectNOf<WorldCard>; };
    readonly parameters: { cards: WorldCard[]; };
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
        this.selects.cards = new SelectNOf(cardsChoice, 1);
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
    readonly selects: { target: SelectNOf<Site | OathPlayer>; amount: SelectNumber; giving: SelectBoolean; };
    readonly parameters: { target: (Site | OathPlayer)[]; amount: number[]; giving: boolean[]; };
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
        this.selects.target = new SelectNOf(choices, 1);

        const values = [];
        for (let i = 1; i <= max; i++) values.push(i);
        this.selects.amount = new SelectNumber(values);

        this.selects.giving = new SelectBoolean(["Giving", "Taking"]);

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
    readonly selects: { allow: SelectBoolean; };
    readonly parameters: { allow: boolean[]; };
    readonly message = "Do you allow this action?";

    effect: OathEffect<any>;

    constructor(player: OathPlayer, effect: OathEffect<any>) {
        super(player);
        this.effect = effect;
    }

    start(): boolean {
        this.selects.allow = new SelectBoolean(["Allow", "Deny"]);
        return super.start();
    }

    execute(): void {
        if (this.parameters.allow[0]) this.effect.do();
    }
}
