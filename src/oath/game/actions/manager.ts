import { OathAction, InvalidActionResolution,  UsePowerAction, PlayFacedownAdviserAction, MoveWarbandsAction, RestAction, MusterAction, TradeAction, TravelAction, RecoverAction, SearchAction, CampaignAction } from "./actions";
import { OathEffect, AddActionToStackEffect, PopActionFromStackEffect } from "../effects";
import { Constructor } from "../utils";
import { PlayerColor } from "../enums";
import { OathGame } from "../game";


export class OathActionManager {
    game: OathGame;
    actionsStack: OathAction[] = [];
    futureActionsList: OathAction[] = [];
    currentEffectsStack: OathEffect<any>[] = [];
    pastEffectsStack: OathEffect<any>[][] = [];
    cancelledEffects: OathEffect<any>[] = [];
    startOptions: Record<string, Constructor<OathAction>> = {};
    noReturn: boolean = false;

    constructor(game: OathGame) {
        this.game = game;
    }
 
    checkForNextAction(): Record<string, any> {
        for (const action of this.futureActionsList) new AddActionToStackEffect(action).do();
        this.futureActionsList.length = 0;

        if (!this.actionsStack.length) this.game.checkForOathkeeper();
        let action = this.actionsStack[this.actionsStack.length - 1];

        let continueNow = action?.start();
        if (continueNow) return this.resolveTopAction();

        if (this.noReturn) {
            this.currentEffectsStack.length = 0;
            this.pastEffectsStack.length = 0;
        }
        this.noReturn = false;

        if (!action) this.startOptions = this.getStartOptions();

        const returnData = {
            activeAction: action?.serialize(),
            startOptions: !action ? Object.keys(this.startOptions) : undefined,
            appliedEffects: this.currentEffectsStack.map(e => e.serialize()).filter(e => e !== undefined).map(e => ({effect: e.constructor.name, ...e})),
            cancelledEffects: this.cancelledEffects.map(e => e.serialize()).filter(e => e !== undefined).map(e => ({effect: e.constructor.name, ...e})),
            game: this.game.serialize()
        };
        this.cancelledEffects.length = 0;
        return returnData;
    }

    storeEffects() {
        if (this.currentEffectsStack.length) {
            this.pastEffectsStack.push([...this.currentEffectsStack]);
            this.currentEffectsStack.length = 0;
        }
    }

    getStartOptions(): Record<string, Constructor<OathAction>> {
        return {
            "Muster": MusterAction,
            "Trade": TradeAction,
            "Travel": TravelAction,
            "Recover": RecoverAction,
            "Search": SearchAction,
            "Campaign": CampaignAction,

            "Use": UsePowerAction,
            "Reveal": PlayFacedownAdviserAction,
            "Move warbands": MoveWarbandsAction,
            "Rest": RestAction
        };
    }

    startAction(actionName: string): object {
        const action = this.startOptions[actionName];
        if (!action)
            throw new InvalidActionResolution("Invalid starting action name");

        this.storeEffects();
        new action(this.game.currentPlayer).doNext();

        try {
            return this.checkForNextAction();
        } catch (e) {
            this.revert();
            throw e;
        }
    }

    continueAction(by: PlayerColor, values: Record<string, string[]>): object {
        const action = this.actionsStack[this.actionsStack.length - 1];
        if (!action) throw new InvalidActionResolution("No action to continue");

        const player = this.game.players.byId(by)[0];
        if (!player) throw new InvalidActionResolution(`Invalid player id ${by}`);
        if (action.player !== player) throw new InvalidActionResolution(`Action must be resolved by ${action.player.name}, not ${player.name}`);

        this.storeEffects();
        const parsed = action.parse(values);
        action.applyParameters(parsed);

        try {
            return this.resolveTopAction();
        } catch (e) {
            this.revert();
            throw e;
        }
    }

    resolveTopAction(): object {
        const action = new PopActionFromStackEffect(this.game).do();
        if (!action) return this.checkForNextAction();

        action.execute();
        return this.checkForNextAction();
    }

    cancelAction(): object {
        if (this.currentEffectsStack.length == 0 && this.pastEffectsStack.length == 0) throw new InvalidActionResolution("Cannot roll back");

        this.startOptions = {};
        const reverted = this.revert();
        this.cancelledEffects.splice(0, 0, ...reverted);
        return this.checkForNextAction();
    }

    revert(): OathEffect<any>[] {
        this.futureActionsList.length = 0;

        const reverted: OathEffect<any>[] = [];
        while (this.currentEffectsStack.length) {
            const effect = this.currentEffectsStack.pop();
            if (!effect) break;
            effect.revert();
            reverted.push(effect);
        }

        const group = this.pastEffectsStack.pop();
        this.currentEffectsStack.length = 0;
        if (group) this.currentEffectsStack.push(...group);

        return reverted;
    }
}
