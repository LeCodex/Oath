import { InvalidActionResolution, OathAction } from "./actions";
import { OathBoard } from "./board";
import { RelicDeck, WorldDeck } from "./decks";
import { OathEffect } from "./effects";
import { BannerName, Oath, OathPhase, OathSuit } from "./enums";
import { Chancellor, OathPlayer } from "./player";
import { OathPower } from "./power";
import { Banner, FavorBank } from "./resources";

export class OathGame {
    board: OathBoard;
    banners: Map<BannerName, Banner>;
    favorBanks: Map<OathSuit,FavorBank>
    worldDeck: WorldDeck
    relicDeck: RelicDeck
    
    players: OathPlayer[];
    chancellor: Chancellor;
    
    oath: Oath;
    oathkeeper: OathPlayer;
    isUsurper: boolean;

    turnOrder: OathPlayer[];
    turn: number;
    phase: OathPhase;
    round: number;

    actionStack: OathAction[];
    currentEffects: OathEffect<any>[];

    constructor() {

    }

    get currentPlayer(): OathPlayer { return this.turnOrder[this.turn]; }

    getActivePowers<T extends OathPower<any>>(type: abstract new (...args: any) => T): Set<T> {
        const isType = (power: OathPower<any>): power is T => { return power instanceof type };
        const powers = new Set<T>();

        for (const region of this.board.regions.values()) {
            for (const site of region.sites) {
                for (const denizen of site.denizens) {
                    if (denizen.facedown) continue;
                    for (const power of denizen.powers) {
                        if (isType(power)) powers.add(power);
                    }
                }
            }
        }

        for (const player of this.players) {
            for (const adviser of player.advisers) {
                if (adviser.facedown) continue;
                for (const power of adviser.powers) {
                    if (isType(power)) powers.add(power);
                }
            }

            for (const relic of player.relics) {
                if (relic.facedown) continue;
                for (const power of relic.powers) {
                    if (isType(power)) powers.add(power);
                }
            }
        }

        for (const banner of this.banners.values()) {
            for (const power of banner.powers) {
                if (isType(power)) powers.add(power);
            }
        }

        for (const [i, power] of this.chancellor.reliquary.powers.entries()) {
            if (!this.chancellor.reliquary.relics[i] && isType(power)) powers.add(power);
        }

        return powers;
    }

    continueAction(values: any) {
        const action = this.actionStack.pop();
        if (!action) return;

        this.currentEffects = [];
        action.applyParameters(values);
        try {
            action.execute();
        } catch (e) {
            // Revert all effects that have been done, put the action back on the stack, then pass the error on
            this.revert();
            this.actionStack.push(action);
            throw e;
        }
    }

    revert() {
        for (const effect of this.currentEffects) effect.revert();
    }

    endTurn() {

    }
}

export abstract class OathGameObject {
    game: OathGame;

    constructor(game: OathGame) {
        this.game = game;
    }
}