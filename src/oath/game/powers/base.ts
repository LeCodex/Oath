import type { OathPower } from ".";
import { ActionModifier } from ".";
import type { OathAction } from "../actions/base";
import { DiscardCardEffect, PlayWorldCardEffect } from "../actions/effects";
import type { OathSuit } from "../enums";
import type { Site, OathCard } from "../model/cards";
import { Denizen } from "../model/cards";
import type { OwnableObject, WithPowers } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import type { ReliquarySlot } from "../model/reliquary";
import type { AbstractConstructor, Concrete, Constructor } from "../utils";
import type { PowerName } from "./classIndex";


export function GainPowersModifier<T extends OathAction>(action: Constructor<T>, ...powers: Constructor<OathPower<WithPowers>>[]) {
    return class GainPowers extends ActionModifier<WithPowers, T> {
        modifiedAction = action;
        mustUse = true;

        applyBefore(): void {
            for (const power of powers)
                this.source.powers.add(power.name as PowerName);
        }
    }
}
export function LosePowersModifier<T extends OathAction>(action: Constructor<T>, ...powers: Constructor<OathPower<WithPowers>>[]) {
    return class LosePowers extends ActionModifier<WithPowers, T> {
        modifiedAction = action;
        mustUse = true;

        applyBefore(): void {
            for (const power of powers)
                this.source.powers.delete(power.name as PowerName);
        }
    }
}

export function HomelandSitePower(suit: OathSuit) {
    abstract class HomelandSitePower extends ActionModifier<Site, PlayWorldCardEffect> {
        static suit = suit;
        modifiedAction = PlayWorldCardEffect;
        mustUse = true;
    
        applyAfter(): void {
            if (this.action.site === this.source && this.action.card instanceof Denizen && this.action.card.suit === HomelandSitePower.suit)
                this.giveReward(this.action.executorProxy);
        }
    
        abstract giveReward(player: OathPlayer): void;
    }
    return HomelandSitePower;
}
export function HomelandSiteLosePower(base: Concrete<ReturnType<typeof HomelandSitePower>> & { suit: OathSuit }) {
    abstract class HomelandSitePowerDeactivate extends LosePowersModifier(DiscardCardEffect<OathCard>, base) {
        canUse(): boolean {
            return super.canUse() && this.action.card instanceof Denizen && this.action.card.site === this.source && this.action.card.suit === base.suit;
        }
    }
    return HomelandSitePowerDeactivate;
}

export function Owned<T extends AbstractConstructor<OathPower<OwnableObject & WithPowers> & { canUse(...args: any[]): boolean; }>>(Base: T) {
    abstract class OwnedModifier extends Base {
        canUse(...args: any[]): boolean {
            return super.canUse(...args) && this.playerProxy === this.sourceProxy.owner;
        }
    }
    return OwnedModifier;
}

// TODO: Could be using Accessed, but eh
export function Reliquary<T extends AbstractConstructor<OathPower<ReliquarySlot> & { mustUse: boolean; canUse(...args: any[]): boolean; }>>(Base: T) {
    abstract class ReliquaryModifier extends Base {
        mustUse = true;

        canUse(...args: any[]): boolean {
            return super.canUse(...args) && this.playerProxy === this.gameProxy.chancellor;
        }
    }
    return ReliquaryModifier;
}

export function AtSite<T extends AbstractConstructor<OathPower<Site> & { canUse(...args: any[]): boolean; }>>(Base: T) {
    abstract class AtSiteModifier extends Base {
        canUse(...args: any[]): boolean {
            return super.canUse(...args) && this.playerProxy.site === this.sourceProxy;
        }
    }
    return AtSiteModifier;
}
