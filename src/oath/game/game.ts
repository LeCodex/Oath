import { ChooseNewOathkeeper, OathAction, OathActionManager } from "./actions";
import { OathBoard } from "./board";
import { Conspiracy, Denizen, Relic, Vision } from "./cards/cards";
import { RelicDeck, WorldDeck } from "./cards/decks";
import { denizenData } from "./cards/denizens";
import { relicsData } from "./cards/relics";
import { AddActionToStackEffect, OathEffect } from "./effects";
import { BannerName, OathType, OathPhase, OathSuit, RegionName, PlayerColor } from "./enums";
import { Chancellor, Exile, OathPlayer } from "./player";
import { OathPower } from "./power";
import { Banner, DarkestSecret, FavorBank, PeoplesFavor } from "./resources";
import { AbstractConstructor, Constructor, CopiableWithOriginal, isExtended, StringObject } from "./utils";


export class OathGame extends CopiableWithOriginal {
    board = new OathBoard(this);
    banners = new Map<BannerName, Banner>([
        [BannerName.PeoplesFavor, new PeoplesFavor(this)],
        [BannerName.DarkestSecret, new DarkestSecret(this)]
    ]);
    favorBanks: Map<OathSuit, FavorBank>;
    worldDeck = new WorldDeck(this);
    relicDeck = new RelicDeck(this);
    
    chancellor: Chancellor;
    players: { [key: number]: OathPlayer } = {};
    order: PlayerColor[] = [PlayerColor.Purple];
    
    oath: Oath;
    oathkeeper: OathPlayer;
    isUsurper = false;

    turn = 0;
    phase = OathPhase.Wake;
    round = 1;

    actionManager = new OathActionManager(this);

    constructor(oath: OathType, playerCount: number) {
        super();
        this.oath = new OathTypeToOath[oath](this);
        this.oath.setup();

        for (const data of Object.values(relicsData)) this.relicDeck.putCard(new Relic(this, ...data));
        this.relicDeck.shuffle();

        // TEMP: Just load every card and shuffle evertyhing for now
        for (const data of Object.values(denizenData)) this.worldDeck.putCard(new Denizen(this, ...data));
        for (const oath of Object.values(OathTypeToOath)) this.worldDeck.putCard(new Vision(new oath(this)));
        this.worldDeck.putCard(new Conspiracy(this));
        this.worldDeck.shuffle();

        const topCradleSite = this.board.regions[RegionName.Cradle].sites[0];
        this.oathkeeper = this.chancellor = new Chancellor(this, topCradleSite);
        this.players[PlayerColor.Purple] = this.chancellor;
        for (let i = 1; i < playerCount; i++) {
            this.players[i+1] = new Exile(this, topCradleSite, i+1);
            this.order.push(i+1);
        }
        
        // TODO: Take favor from supply
        const startingAmount = playerCount < 5 ? 3 : 4;
        this.favorBanks = new Map([
            [OathSuit.Discord, new FavorBank(this, startingAmount)],
            [OathSuit.Arcane, new FavorBank(this, startingAmount)],
            [OathSuit.Order, new FavorBank(this, startingAmount)],
            [OathSuit.Hearth, new FavorBank(this, startingAmount)],
            [OathSuit.Beast, new FavorBank(this, startingAmount)],
            [OathSuit.Nomad, new FavorBank(this, startingAmount)],
        ]);
    }

    get currentPlayer(): OathPlayer { return this.players[this.order[this.turn]]; }

    getPowers<T extends OathPower<any>>(type: AbstractConstructor<T>): [any, Constructor<T>][] {
        const powers: [any, Constructor<T>][] = [];

        const reliquary = this.chancellor.reliquary;
        for (const [i, power] of reliquary.powers.entries()) {
            if (!reliquary.relics[i] && isExtended(power, type)) powers.push([reliquary, power]);
        }

        for (const site of this.board.sites()) {
            for (const denizen of site.denizens) {
                if (denizen.facedown) continue;
                for (const power of denizen.powers)
                    if (isExtended(power, type)) powers.push([denizen, power]);
            }
        }

        for (const player of Object.values(this.players)) {
            for (const adviser of player.advisers) {
                if (adviser.facedown) continue;
                for (const power of adviser.powers)
                    if (isExtended(power, type)) powers.push([adviser, power]);
            }

            for (const relic of player.relics) {
                if (relic.facedown) continue;
                for (const power of relic.powers) {
                    if (isExtended(power, type)) powers.push([relic, power]);
                }
            }

            if (player instanceof Exile && player.vision) {
                for (const power of player.vision.powers)
                    if (isExtended(power, type)) powers.push([player.vision, power]);
            }
        }

        for (const banner of this.banners.values())
            for (const power of banner.powers)
                if (isExtended(power, type)) powers.push([banner, power]);

        return powers;
    }

    checkForOathkeeper(): OathAction | undefined {
        const candidates = this.oath.getCandidates();
        if (candidates.has(this.oathkeeper)) return;
        if (candidates.size) new ChooseNewOathkeeper(this.oathkeeper, candidates).doNext();
    }

    endTurn() {
        this.turn++;
        if (this.turn === Object.keys(this.players).length) this.turn = 0;
    }
}

export abstract class OathGameObject extends CopiableWithOriginal {
    game: OathGame;

    constructor(game: OathGame) {
        super();
        this.game = game;
    }
}


export abstract class Oath extends OathGameObject {
    type: OathType;

    abstract setup(): void;
    abstract scorePlayer(player: OathPlayer): number;
    abstract isSuccessor(player: OathPlayer): boolean;

    getCandidates(): Set<OathPlayer> {
        let max = 0;
        const candidates = new Set<OathPlayer>();
        for (const player of Object.values(this.game.players)) {
            const score = this.scorePlayer(player);
            if (score > max) {
                candidates.clear();
                candidates.add(player);
                max = score;
            } else if (score === max) {
                candidates.add(player);
            }
        }

        return candidates;
    }
}

export class OathOfSupremacy extends Oath {
    type = OathType.Supremacy;

    setup() {
        // Chancellor already rules most sites
    }

    scorePlayer(player: OathPlayer): number {
        let total = 0;
        for (const site of this.game.board.sites())
            if (site.ruler === player) total++;

        return total
    }

    isSuccessor(player: OathPlayer): boolean {
        return player.relics.size + player.banners.size > this.game.chancellor.relics.size + this.game.chancellor.banners.size;
    }
}

export class OathOfProtection extends Oath {
    type = OathType.Protection;

    setup() {
        // Chancellor already has the Scepter
    }

    scorePlayer(player: OathPlayer): number {
        return player.relics.size + player.banners.size;
    }

    isSuccessor(player: OathPlayer): boolean {
        return this.game.banners.get(BannerName.PeoplesFavor)?.owner === player;
    }
}

export class OathOfThePeople extends Oath {
    type = OathType.ThePeople;

    setup() {
        this.game.banners.get(BannerName.PeoplesFavor)?.setOwner(this.game.chancellor);
    }

    scorePlayer(player: OathPlayer): number {
        return this.game.banners.get(BannerName.PeoplesFavor)?.owner === player ? 1 : 0;
    }

    isSuccessor(player: OathPlayer): boolean {
        return this.game.banners.get(BannerName.DarkestSecret)?.owner === player;
    }
}

export class OathOfDevotion extends Oath {
    type = OathType.Devotion;

    setup() {
        this.game.banners.get(BannerName.DarkestSecret)?.setOwner(this.game.chancellor);
    }

    scorePlayer(player: OathPlayer): number {
        return this.game.banners.get(BannerName.DarkestSecret)?.owner === player ? 1 : 0;
    }

    isSuccessor(player: OathPlayer): boolean {
        // TODO: Make this successor goal
        return false;
    }
}

export const OathTypeToOath = {
    [OathType.Supremacy]: OathOfSupremacy,
    [OathType.Protection]: OathOfProtection,
    [OathType.ThePeople]: OathOfThePeople,
    [OathType.Devotion]: OathOfDevotion,
}