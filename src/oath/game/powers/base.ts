import type { OathPower } from ".";
import { ActionModifier, ActivePower } from ".";
import { WakeAction } from "../actions";
import { DiscardCardEffect, PlayWorldCardEffect } from "../actions/effects";
import type { OathSuit } from "../enums";
import type { Site, GrandScepter, OathCard } from "../model/cards";
import { Denizen } from "../model/cards";
import type { WithPowers } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import type { Constructor } from "../utils";
import type { SitePowerName } from "./classIndex";


export function HomelandSitePower(suit: OathSuit) {
    abstract class HomelandSitePower extends ActionModifier<Site, PlayWorldCardEffect> {
        static suit = suit;
        modifiedAction = PlayWorldCardEffect;
        mustUse = true;
    
        applyAfter(): void {
            // TODO: "and if you have not discarded a <suit> card here during this turn"
            if (this.action.site === this.source && this.action.card instanceof Denizen && this.action.card.suit === HomelandSitePower.suit)
                this.giveReward(this.action.executorProxy);
        }
    
        abstract giveReward(player: OathPlayer): void;
    }
    return HomelandSitePower;
}
export function HomelandSitePowerDeactivate(base: ReturnType<typeof HomelandSitePower>) {
    abstract class HomelandSitePowerDeactivate extends ActionModifier<Site, DiscardCardEffect<OathCard>> {
        modifiedAction = DiscardCardEffect;

        canUse(): boolean {
            return this.action.card instanceof Denizen && this.action.card.site === this.source && this.action.card.suit === base.suit;
        }

        applyBefore(): void {
            this.source.powers.delete(base.constructor.name as SitePowerName);
        }
    }
    return HomelandSitePowerDeactivate;
}

export function ReactivatePowers(bases: Iterable<Constructor<OathPower<WithPowers>>>) {
    abstract class HomelandSitePowerReactivate extends ActionModifier<Site, WakeAction> {
        modifiedAction = WakeAction;

        applyBefore(): void {
            for (const power of bases)
                this.source.powers.add(power.constructor.name as SitePowerName);
        }
    }
    return HomelandSitePowerReactivate;
}

export abstract class GrandScepterActive extends ActivePower<GrandScepter> {
    canUse(): boolean {
        return super.canUse() && !this.sourceProxy.seizedThisTurn;
    }
}

