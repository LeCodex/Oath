import { OathGameObject } from "../gameObject";
import { Constructor, InvalidActionResolution } from "../utils";
import { AddActionToStackEffect, PopActionFromStackEffect } from "./resolution";
import { OathAction } from "./base";
import { OathEffect } from "../effects/base";


export class OathActionManager extends OathGameObject {
    readonly actionStack: OathAction[] = [];
    readonly futureActionsList: OathAction[] = [];
    readonly currentEffectsStack: OathEffect<any>[] = [];
    readonly pastEffectsStack: OathEffect<any>[][] = [];
    readonly cancelledEffects: OathEffect<any>[] = [];
    noReturn: boolean = false;

    checkForNextAction(): object {
        for (const action of this.futureActionsList) new AddActionToStackEffect(action).do();
        this.futureActionsList.length = 0;

        if (!this.actionStack.length) this.game.checkForOathkeeper();
        let action = this.actionStack[this.actionStack.length - 1];

        let contineNow = action?.start();
        if (contineNow) return this.resolveTopAction();

        if (this.noReturn) {
            this.currentEffectsStack.length = 0;
            this.pastEffectsStack.length = 0;
        }
        this.noReturn = false;

        const returnData = {
            activeAction: action.serialize(),
            appliedEffects: this.currentEffectsStack.map(e => e.constructor.name),
            cancelledEffects: this.cancelledEffects.map(e => e.constructor.name),
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

    startAction(action: Constructor<OathAction>): object {
        this.storeEffects();
        new action(this.game.currentPlayer).doNext();

        try {
            return this.checkForNextAction();
        } catch (e) {
            this.revert();
            throw e;
        }
    }

    continueAction(by: number, values: Record<string, string[]>): object {
        const action = this.actionStack[this.actionStack.length - 1];
        if (!action) throw new InvalidActionResolution("No action to continue");

        const player = this.game.players[by];
        if (action.player.original !== player) throw new InvalidActionResolution(`Action must be resolved by ${action.player.name}, not ${player.name}`);

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


