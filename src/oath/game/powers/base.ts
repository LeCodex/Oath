import type { OathPower } from ".";
import { ActionModifier } from ".";
import { WakeAction } from "../actions";
import { DiscardCardEffect, PlayWorldCardEffect } from "../actions/effects";
import type { OathSuit } from "../enums";
import type { Site, OathCard } from "../model/cards";
import { Denizen } from "../model/cards";
import type { WithPowers } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import type { Constructor } from "../utils";
import type { PowerName, SitePowerName } from "./classIndex";


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
        mustUse = true;

        canUse(): boolean {
            return this.action.card instanceof Denizen && this.action.card.site === this.source && this.action.card.suit === base.suit;
        }

        applyBefore(): void {
            this.source.powers.delete(base.name as SitePowerName);
        }
    }
    return HomelandSitePowerDeactivate;
}

export function WakeReactivatePowers(...bases: Constructor<OathPower<WithPowers>>[]) {
    return class WakeReactivatePowers extends ActionModifier<WithPowers, WakeAction> {
        modifiedAction = WakeAction;
        mustUse = true;

        applyBefore(): void {
            for (const power of bases)
                this.source.powers.add(power.name as PowerName);
        }
    }
}
