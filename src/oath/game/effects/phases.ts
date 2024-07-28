import { InvalidActionResolution } from "../utils";
import { VowOathAction, ChooseNewCitizensAction, BuildOrRepairEdificeAction, AddCardsToWorldDeckAction } from "../actions/end";
import { WakeAction } from "../actions/major";
import { SearchDiscardOptions } from "../actions/types";
import { Region } from "../board";
import { Site } from "../cards/sites";
import { Denizen, Edifice } from "../cards/denizens";
import { edificeData } from "../cards/data/denizens";
import { OathPhase, OathSuit } from "../enums";
import { Oath } from "../oaths";
import { shuffleArray } from "../utils";
import { PlayerEffect, OathEffect } from "./base";
import { MoveResourcesToTargetEffect, MoveWarbandsToEffect, DiscardCardEffect, HandleD6ResultEffect, RollDiceEffect } from "./basic";
import { D6 } from "../dice";
import { OathGame } from "../game";
import { Exile } from "../player";


// NOTE: In theory, none of those should get rolled back, but you never know
export class WinGameEffect extends PlayerEffect<void> {
    oldOath: Oath;

    resolve(): void {
        this.oldOath = this.game.original.oath;
        new VowOathAction(this.player).doNext();

        if (!this.player.isImperial)
            new ChooseNewCitizensAction(this.player).doNext();

        else
            new BuildOrRepairEdificeAction(this.player).doNext();

        new CleanUpMapEffect(this.player).doNext();
    }

    revert(): void {
        this.game.original.oath = this.oldOath;
    }
}

export class BuildEdificeFromDenizenEffect extends OathEffect<void> {
    denizen: Denizen;
    site: Site;
    edifice: Edifice;

    constructor(denizen: Denizen) {
        super(denizen.game, undefined);
        this.denizen = denizen;
    }

    resolve(): void {
        if (!this.denizen.site) throw new InvalidActionResolution("Card is not at a site");
        this.site = this.denizen.site;

        for (const data of Object.values(edificeData)) {
            const suit = data[0];
            if (suit === this.denizen.suit) {
                this.edifice = new Edifice(this.game, data[0], ...data[1]);
                this.edifice.putAtSite(this.site);
                break;
            }
        }
        this.site.region.discard.putCard(this.denizen);
    }

    revert(): void {
        if (!this.site) return;
        this.site.region.discard.drawSingleCard();
        this.denizen.putAtSite(this.site);
        this.edifice.setOwner(undefined);
    }
}

export class ChangeEdificeEffect extends OathEffect<void> {
    ruin: boolean;
    edifice: Edifice;
    newEdifice: Edifice;

    constructor(edifice: Edifice, ruin: boolean) {
        super(edifice.game, undefined);
        this.edifice = edifice;
        this.ruin = ruin;
    }

    resolve(): void {
        if (!this.edifice.site) throw new InvalidActionResolution("Card is not at a site (How?)");

        for (const data of Object.values(edificeData)) {
            const name = data[this.ruin ? 1 : 2][0];
            if (name === this.edifice.name) {
                this.newEdifice = new Edifice(this.game, this.ruin ? OathSuit.None : data[0], ...data[this.ruin ? 2 : 1]);
                this.newEdifice.putAtSite(this.edifice.site);

                for (const [resource, amount] of this.edifice.resources)
                    new MoveResourcesToTargetEffect(this.game, undefined, resource, amount, this.newEdifice, this.edifice).do();
                for (const [player, amount] of this.edifice.warbands)
                    new MoveWarbandsToEffect(this.game, undefined, player, amount, this.newEdifice, this.edifice).do();

                break;
            }
        }
        this.edifice.setOwner(undefined);
    }

    revert(): void {
        if (!this.newEdifice?.site) return;
        this.edifice.putAtSite(this.newEdifice.site);
        this.newEdifice.setOwner(undefined);
    }
}

export class CleanUpMapEffect extends PlayerEffect<void> {
    oldRegions = new Map<Region, Site[]>();
    discardedDenizens = new Map<Site, Set<Denizen>>();

    resolve(): void {
        const storedSites: Site[] = [];
        const pushedSites: Site[] = [];

        // Discard and put aside sites 
        for (const region of Object.values(this.game.original.board.regions)) {
            this.oldRegions.set(region, [...region.sites]);

            for (const site of region.sites) {
                site.clear();
                for (const denizen of site.denizens) denizen.clear();

                region.sites.splice(region.sites.indexOf(site), 1);
                if (!site.ruler?.isImperial && site.ruler?.original !== this.player.original) {
                    this.game.original.siteDeck.putCard(site);
                    this.discardedDenizens.set(site, new Set(site.denizens));
                    for (const denizen of site.denizens) {
                        if (denizen instanceof Edifice && denizen.suit !== OathSuit.None) {
                            new ChangeEdificeEffect(denizen, true).do();
                            pushedSites.push(site);
                        } else {
                            new DiscardCardEffect(this.player, denizen, new SearchDiscardOptions(region.discard, false, true));
                        }
                    }
                } else {
                    storedSites.push(site);
                }
            }
        }
        this.game.original.siteDeck.shuffle();
        let total = Object.values(this.game.original.board.regions).reduce((a, e) => a + e.size, 0);
        total -= storedSites.length + pushedSites.length;
        for (var i = 0; i < total; i++) {
            const site = this.game.original.siteDeck.drawSingleCard();
            if (!site) throw Error("Not enough sites");
            storedSites.push(site);
        }
        storedSites.push(...pushedSites);

        // Rebuild the map
        for (const region of Object.values(this.game.original.board.regions)) {
            let hasFaceupSite = false;
            while (region.sites.length < region.size) {
                const site = storedSites.shift();
                if (!site) break;
                region.sites.push(site);
                if (!site.facedown) hasFaceupSite = true;
            }

            if (!hasFaceupSite) region.sites[0].reveal();
        }

        // Collect and deal relics (technically not at this point of the Chronicle, but this has no impact)
        const futureReliquary = [...this.game.original.chancellor.reliquary.relics.filter(e => e !== undefined)];
        const relicDeck = this.game.original.relicDeck;
        for (const player of Object.values(this.game.original.players)) {
            for (const relic of player.relics) {
                if (relic === this.game.original.grandScepter) continue;

                if (player === this.player.original)
                    futureReliquary.push(relic);

                else
                    relicDeck.putCard(relic);
            }
        }
        relicDeck.shuffle();
        for (const site of this.game.board.sites()) {
            if (site.facedown) continue;
            for (i = site.relics.size; i < site.startingRelics; i++) {
                const relic = relicDeck.drawSingleCard();
                relic?.putAtSite(site);
            }
        }

        shuffleArray(futureReliquary);
        while (futureReliquary.length) {
            const relic = futureReliquary.pop();
            if (relic) relicDeck.putCard(relic);
        }
        for (let i = 0; i < 4; i++) {
            this.game.original.chancellor.reliquary.relics[i] = relicDeck.drawSingleCard();
        }

        new AddCardsToWorldDeckAction(this.player).doNext();
    }

    revert(): void {
        // TODO: See if this is a good way of doing the revert
        for (const [region, sites] of this.oldRegions) {
            region.sites = sites;
        }

        for (const [site, denizens] of this.discardedDenizens) {
            site.denizens = denizens;
        }
    }
}
export class ChangePhaseEffect extends OathEffect<void> {
    phase: OathPhase;
    oldPhase: OathPhase;

    constructor(game: OathGame, phase: OathPhase) {
        super(game, undefined);
        this.phase = phase;
    }

    resolve(): void {
        this.oldPhase = this.game.original.phase;
        this.game.original.phase = this.phase;
        this.game.original.checkForOathkeeper();
    }

    revert(): void {
        this.game.original.phase = this.oldPhase;
    }
}

export class NextTurnEffect extends OathEffect<void> {
    constructor(game: OathGame) {
        super(game, undefined);
    }

    resolve(): void {
        this.game.original.turn = (this.game.original.turn + 1) % this.game.original.order.length;
        if (this.game.original.turn === 0) this.game.original.round++;

        if (this.game.round > 8) {
            if (this.game.oathkeeper.isImperial)
                return this.game.original.empireWins();

            if (this.game.isUsurper)
                return new WinGameEffect(this.game.oathkeeper).do();

            // TODO: Break ties according to the rules. Maybe have constant references to the Visions?
            for (const player of Object.values(this.game.players)) {
                if (player instanceof Exile && player.vision) {
                    const candidates = player.vision.oath.getCandidates();
                    if (candidates.size === 1 && candidates.has(player))
                        return new WinGameEffect(player).do();
                }
            }

            return this.game.original.empireWins();
        }

        if (this.game.round > 5 && this.game.oathkeeper.isImperial) {
            const result = new RollDiceEffect(this.game, this.game.chancellor, D6, 1).do();
            new HandleD6ResultEffect(this.game, result).doNext();
            return;
        }

        new ChangePhaseEffect(this.game, OathPhase.Wake).doNext();
        new WakeAction(this.game.original.currentPlayer).doNext();
    }

    revert(): void {
        if (this.game.original.turn === 0) this.game.original.round--;
        this.game.original.turn = (this.game.original.turn - 1 + this.game.original.order.length) % this.game.original.order.length;
    }
}

