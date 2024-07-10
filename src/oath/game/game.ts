import { ChooseNewOathkeeper, OathAction } from "./actions";
import { OathBoard } from "./board";
import { RelicDeck, WorldDeck } from "./cards/decks";
import { AddActionToStackEffect, OathEffect } from "./effects";
import { BannerName, OathType, OathPhase, OathSuit } from "./enums";
import { Chancellor, OathPlayer } from "./player";
import { OathPower } from "./power";
import { Banner, FavorBank } from "./resources";

export class OathGame {
    board: OathBoard;
    banners: Map<BannerName, Banner>;
    favorBanks: Map<OathSuit,FavorBank>;
    worldDeck: WorldDeck;
    relicDeck: RelicDeck;
    
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

        const reliquary = this.chancellor.reliquary;
        for (const [i, power] of reliquary.powers.entries()) {
            if (!reliquary.relics[i] && isExtended(power, type)) powers.push([reliquary, power]);
        }

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

        return powers;
    }

    checkForNextAction() {
        if (this.actionStack.length) {
            this.actionStack[this.actionStack.length - 1].start();
        } else {
            this.checkForOathkeeper();
            // TODO: Clear and save the effects stack
        }

    }

    continueAction(values: StringObject<string[]>) {
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

    checkForOathkeeper() {
        let max = 0, newOathkeepers = new Set<OathPlayer>();
        for (const player of this.players) {
            const score = this.oath.scorePlayer(player);
            if (score > max) {
                newOathkeepers.clear();
                newOathkeepers.add(player);
                max = score;
            } else if (score === max) {
                newOathkeepers.add(player);
            }
        }

        if (newOathkeepers.has(this.oathkeeper)) return;
        if (newOathkeepers.size) {
            // TODO: Can this be added to the stack directly?
            new AddActionToStackEffect(new ChooseNewOathkeeper(this.oathkeeper, newOathkeepers)).do();
            this.checkForNextAction();
        }
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


export abstract class Oath extends OathGameObject{
    type: OathType;

    abstract scorePlayer(player: OathPlayer): number;
    abstract isSuccessor(player: OathPlayer): boolean;
}

export class OathOfSupremacy extends Oath {
    type = OathType.Supremacy;

    scorePlayer(player: OathPlayer): number {
        let total = 0;
        for (const region of this.game.board.regions.values())
            for (const site of region.sites)
                if (site.ruler === player) total++;

        return total
    }

    isSuccessor(player: OathPlayer): boolean {
        return player.relics.size + player.banners.size > this.game.chancellor.relics.size + this.game.chancellor.banners.size;
    }
}

export class OathOfProtection extends Oath {
    type = OathType.Protection;

    scorePlayer(player: OathPlayer): number {
        return player.relics.size + player.banners.size;
    }

    isSuccessor(player: OathPlayer): boolean {
        return this.game.banners.get(BannerName.PeoplesFavor)?.owner === player;
    }
}

export class OathOfThePeople extends Oath {
    type = OathType.ThePeople;

    scorePlayer(player: OathPlayer): number {
        return this.game.banners.get(BannerName.PeoplesFavor)?.owner === player ? 1 : 0;
    }

    isSuccessor(player: OathPlayer): boolean {
        return this.game.banners.get(BannerName.DarkestSecret)?.owner === player;
    }
}

export class OathOfDevotion extends Oath {
    type = OathType.Devotion;

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