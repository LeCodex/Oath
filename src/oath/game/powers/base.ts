import { ActionModifier, ActivePower } from ".";
import { PlayWorldCardEffect } from "../actions/effects";
import type { OathSuit } from "../enums";
import type { Site, GrandScepter } from "../model/cards";
import { Denizen } from "../model/cards";
import type { OathPlayer } from "../model/player";


export abstract class HomelandSitePower extends ActionModifier<Site, PlayWorldCardEffect> {
    modifiedAction = PlayWorldCardEffect;
    abstract suit: OathSuit;
    mustUse = true;

    applyAfter(): void {
        // TODO: "and if you have not discarded a <suit> card here during this turn"
        if (this.action.site === this.source && this.action.card instanceof Denizen && this.action.card.suit === this.suit)
            this.giveReward(this.action.executorProxy);
    }

    abstract giveReward(player: OathPlayer): void;
}

export abstract class GrandScepterActive extends ActivePower<GrandScepter> {
    canUse(): boolean {
        return super.canUse() && !this.sourceProxy.seizedThisTurn;
    }
}

