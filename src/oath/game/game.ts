import { OathAction } from "./actions";
import { OathBoard } from "./board";
import { RelicDeck, WorldDeck } from "./cards/decks";
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
        // TODO: Do all the missing constructors
    }

    get currentPlayer(): OathPlayer { return this.turnOrder[this.turn]; }

    getPowers<T extends OathPower<any>>(type: AbstractConstructor<T>): [any, Constructor<T>][] {
        const powers: [any, Constructor<T>][] = [];

        for (const region of this.board.regions.values()) {
            for (const site of region.sites) {
                for (const denizen of site.denizens) {
                    if (denizen.facedown) continue;
                    for (const power of denizen.powers) {
                        if (isExtended(power, type)) powers.push([denizen, power]);
                    }
                }
            }
        }

        for (const player of this.players) {
            for (const adviser of player.advisers) {
                if (adviser.facedown) continue;
                for (const power of adviser.powers) {
                    if (isExtended(power, type)) powers.push([adviser, power]);
                }
            }

            for (const relic of player.relics) {
                if (relic.facedown) continue;
                for (const power of relic.powers) {
                    if (isExtended(power, type)) powers.push([relic, power]);
                }
            }
        }

        for (const banner of this.banners.values()) {
            for (const power of banner.powers) {
                if (isExtended(power, type)) powers.push([banner, power]);
            }
        }

        const reliquary = this.chancellor.reliquary;
        for (const [i, power] of reliquary.powers.entries()) {
            if (!reliquary.relics[i] && isExtended(power, type)) powers.push([reliquary, power]);
        }

        return powers;
    }

    checkForNextAction() {
        
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
        } finally {
            this.checkForNextAction();
        }
    }

    cancelAction() {

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