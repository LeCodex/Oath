import { CampaignResult } from "../actions/major";
import { TakeFavorFromBankAction } from "../actions/other";
import { Denizen } from "../cards/denizens";
import { DefenseDie } from "../dice";
import { OathSuit } from "../enums";
import { OathGame } from "../game";
import { OathPlayer } from "../player";
import { PeoplesFavor } from "../resources";
import { PlayerEffect, OathEffect } from "./base";
import { PutWarbandsFromBagEffect, DiscardCardGroupEffect } from "./basic";


export class CursedCauldronResolutionEffect extends PlayerEffect<void> {
    result: CampaignResult;

    constructor(player: OathPlayer, result: CampaignResult) {
        super(player, false); // Don't copy, because it's part of the campaign chain
        this.result = result;
    }

    resolve(): void {
        if (this.result.winner?.original === this.player.original)
            new PutWarbandsFromBagEffect(this.result.winner, this.result.loserLoss).do();
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}

export class SetPeoplesFavorMobState extends OathEffect<void> {
    banner: PeoplesFavor;
    state: boolean;
    oldState: boolean;

    constructor(game: OathGame, player: OathPlayer | undefined, banner: PeoplesFavor, state: boolean) {
        super(game, player);
        this.banner = banner;
        this.state = state;
    }

    resolve(): void {
        this.oldState = this.banner.original.isMob;
        this.banner.original.isMob = this.state;
    }

    revert(): void {
        this.banner.original.isMob = this.oldState;
    }
}

export class RegionDiscardEffect extends PlayerEffect<void> {
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

export class GamblingHallEffect extends PlayerEffect<void> {
    faces: number[];

    constructor(player: OathPlayer, faces: number[]) {
        super(player);
        this.faces = faces;
    }

    resolve(): void {
        new TakeFavorFromBankAction(this.player, DefenseDie.getResult(this.faces)).doNext();
    }

    revert(): void {
        // Doesn't do anything on its own
    }
}
