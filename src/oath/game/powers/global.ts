import { ActionModifier, WhenPlayed } from ".";
import { ActPhaseAction } from "../actions";
import { PlayWorldCardEffect } from "../actions/effects";
import type { OathGame } from "../model/game";
import { isExtended } from "../utils";
import { UsePowerAction } from "./actions";
import { powersIndex } from "./classIndex";


export class AddUsePowerAction extends ActionModifier<OathGame, ActPhaseAction> {
    modifiedAction = ActPhaseAction;
    mustUse = true;

    applyAtStart(): void {
        this.action.selects.action.choices.set("Use", () => this.action.next = new UsePowerAction(this.powerManager, this.action.player));
    }
}

export class ResolveWhenPlayed extends ActionModifier<OathGame, PlayWorldCardEffect> {
    modifiedAction = PlayWorldCardEffect;
    mustUse = true;

    applyAtEnd(): void {
        for (const power of this.action.card.powers) {
            const powerCls = powersIndex[power];
            if (isExtended(powerCls, WhenPlayed)) {
                new powerCls(this.powerManager, this.action.card as any, this.action.player, this.action).whenPlayed();
            }
        }
    }
}