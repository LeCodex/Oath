import { Relic } from "../cards/relics";
import { Site } from "../cards/sites";
import { Denizen } from "../cards/denizens";
import { Die } from "../dice";
import { SetPeoplesFavorMobState } from "../effects/powers";
import { MoveBankResourcesEffect, TakeResourcesFromBankEffect, PutResourcesIntoBankEffect, MoveResourcesToTargetEffect, MoveAdviserEffect, MoveWorldCardToAdvisersEffect, SetUsurperEffect, SetNewOathkeeperEffect, PayCostToTargetEffect } from "../effects/basic";
import { OathSuit, OathSuitName, OathResource, OathResourceName } from "../enums";
import { OathPlayer } from "../player";
import { OathPower } from "../powers/base";
import { PeoplesFavor, ResourcesAndWarbands, Banner, ResourceCost } from "../resources";
import { OathAction, SelectBoolean, SelectNOf } from "./base";
import { InvalidActionResolution } from "../utils";


export class AskForRerollAction extends OathAction {
    readonly selects: { doReroll: SelectBoolean; };
    readonly parameters: { doReroll: boolean[]; };
    readonly message;

    faces: number[];
    die: typeof Die;
    power?: OathPower<any>;

    constructor(player: OathPlayer, faces: number[], die: typeof Die, power?: OathPower<any>) {
        super(player, false); // Don't copy, not modifiable, and not an entry point
        this.faces = faces;
        this.message = "Do you wish to reroll " + faces.join(",") + "?";
        this.die = die;
        this.power = power;
    }

    start() {
        this.selects.doReroll = new SelectBoolean(["Reroll", "Don't reroll"]);
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
    readonly selects: { suit: SelectNOf<OathSuit | undefined>; };
    readonly parameters: { suit: (OathSuit | undefined)[]; };

    suits: Set<OathSuit>;
    suit: OathSuit | undefined;

    constructor(player: OathPlayer, suits?: Iterable<OathSuit>) {
        super(player, false); // Don't copy, they're not modifiable, are not entry points, and can be used to modify data in other actions
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
    readonly selects: { resource: SelectNOf<OathResource>; };
    readonly parameters: { resource: OathResource[]; };
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
    readonly selects: { player: SelectNOf<OathPlayer | undefined>; };
    readonly parameters: { player: (OathPlayer | undefined)[]; };
    readonly canChooseSelf = false;

    players: Set<OathPlayer>;
    target: OathPlayer | undefined;

    constructor(player: OathPlayer, players?: Iterable<OathPlayer>) {
        super(player, false); // Don't copy, they're not modifiable, are not entry points, and can be used to modify data in other actions
        this.players = new Set(players);
    }

    start(none?: string) {
        if (!this.players.size)
            this.players = new Set(Object.values(this.game.players).filter(e => e !== this.player));

        const choices = new Map<string, OathPlayer | undefined>();
        for (const player of this.players)
            if (player.original !== this.player.original || this.canChooseSelf) choices.set(player.name, player);
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
        this.message = `Take ${amount} ${OathResourceName[resource]}(s) from a player`;
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
    readonly selects: { taking: SelectNOf<Relic | Banner>; };
    readonly parameters: { taking: (Relic | Banner)[]; };
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
        if (!new PayCostToTargetEffect(this.game, this.player, new ResourceCost([], [[OathResource.Secret, 1]]), undefined).do())
            throw new InvalidActionResolution("Cannot pay the resource cost");

        taking.seize(this.player);
    }
}


export abstract class ChooseSite extends OathAction {
    readonly selects: { site: SelectNOf<Site | undefined>; };
    readonly parameters: { site: (Site | undefined)[]; };
    readonly canChooseCurrentSite = false;

    sites: Set<Site>;
    target: Site | undefined;

    constructor(player: OathPlayer, sites?: Iterable<Site>) {
        super(player, false); // Don't copy, they're not modifiable, are not entry points, and can be used to modify data in other actions
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
