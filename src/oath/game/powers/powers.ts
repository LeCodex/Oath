import { ModifiableAction, RestAction, UsePowerAction, WakeAction, CampaignAttackAction, CampaignDefenseAction } from "../actions/actions";
import { ApplyWhenPlayedEffect, OathEffect, PayPowerCost } from "../effects";
import { OathCard, OwnableCard, Site, WorldCard } from "../cards/cards";
import { ResourceCost } from "../resources";
import { OathPlayer } from "../player";
import { AbstractConstructor, MaskProxyManager } from "../utils";
import { OathGame } from "../game";
import { WithPowers } from "../interfaces";


//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export abstract class OathPower<T extends WithPowers> {
    abstract name: string;
    source: T;
    cost: ResourceCost = new ResourceCost();

    constructor(source: T) {
        this.source = source;
    }

    get game() { return this.source.game; }

    payCost(player: OathPlayer): boolean {
        return new PayPowerCost(player, this).do();
    }
}

export abstract class PowerWithProxy<T extends WithPowers> extends OathPower<T> {
    gameProxy: OathGame;
    sourceProxy: T;

    constructor(source: T, maskProxyManager: MaskProxyManager) {
        super(source);
        this.gameProxy = maskProxyManager.get(source.game);
        this.sourceProxy = maskProxyManager.get(source);
    }
}

export abstract class CapacityModifier<T extends WorldCard> extends PowerWithProxy<T> {
    canUse(player: OathPlayer, site?: Site): boolean {
        return true;
    }
    
    /** Updates the information to calculate capacity in the group the source is in/being played to.
     *  
     * First return is the update to capacity (min of all values), second is a set of card proxies that don't count towards capacity. */ 
    updateCapacityInformation(targetProxy: Set<WorldCard>): [number, Iterable<WorldCard>] { return [Infinity, []]; }

    ignoreCapacity(cardProxy: WorldCard): boolean { return false; }
}

export abstract class WhenPlayed<T extends WorldCard> extends PowerWithProxy<T> {
    effect: ApplyWhenPlayedEffect;

    constructor(source: T, effect: ApplyWhenPlayedEffect) {
        super(source, effect.maskProxyManager);
        this.effect = effect;
    }

    abstract whenPlayed(): void;
}

export abstract class ActionPower<T extends WithPowers, U extends ModifiableAction> extends PowerWithProxy<T> {
    action: U;

    constructor(source: T, action: U) {
        super(source, action.maskProxyManager);
        this.action = action;
    }

    abstract canUse(): boolean;
}

export abstract class ActivePower<T extends OathCard> extends ActionPower<T, UsePowerAction> {
    canUse(): boolean {
        return this.sourceProxy.accessibleBy(this.action.playerProxy) && this.sourceProxy.empty;
    }

    abstract usePower(): void;
}

export abstract class ActionModifier<T extends WithPowers, U extends ModifiableAction> extends ActionPower<T, U> {
    abstract modifiedAction: AbstractConstructor<U>;
    mustUse: boolean = false;

    activator: OathPlayer;
    activatorProxy: OathPlayer;

    constructor(source: T, action: U, activator: OathPlayer) {
        super(source, action);
        this.activator = activator;
        this.activatorProxy = action.maskProxyManager.get(activator);
    }

    canUse(): boolean {
        return true;
    }

    /** Applied right after all the possible modifiers are collected */
    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, U>>): Iterable<ActionModifier<WithPowers, U>> { return []; }
    /** Applied before the action is added to the stack. If returns false, it will not be added */
    applyWhenApplied(): boolean { return true; }
    /** Applied when the action starts and selects are set up (before choices are made) */
    applyAtStart(): void { }
    /** Applied right before the execution of the action is put on the stack */
    applyBefore(): void { }
    /** Applied after the execution of the action is put onto the stack */
    applyAfter(): void { }
    /** Applied after the full execution of the action */
    applyAtEnd(): void { }
    
    serialize(): string {
        return this.name;
    }
}

export abstract class EnemyActionModifier<T extends OwnableCard, U extends ModifiableAction> extends ActionModifier<T, U> {
    mustUse = true;

    canUse(): boolean {
        return this.activatorProxy.enemyWith(this.sourceProxy.ruler);
    }
}

export abstract class AccessedActionModifier<T extends OwnableCard, U extends ModifiableAction> extends ActionModifier<T, U> {
    canUse(): boolean {
        return this.sourceProxy.accessibleBy(this.activatorProxy) && this.sourceProxy.empty;
    }
}

export abstract class WakePower<T extends OwnableCard> extends AccessedActionModifier<T, WakeAction> {
    modifiedAction = WakeAction;
    mustUse = true;
}

export abstract class RestPower<T extends OwnableCard> extends AccessedActionModifier<T, RestAction> {
    modifiedAction = RestAction;
    mustUse = true;
}

export abstract class BattlePlan<T extends OwnableCard, U extends ModifiableAction> extends ActionModifier<T, U> {
    canUse(): boolean {
        return this.activatorProxy.rules(this.sourceProxy);
    }
}

export abstract class AttackerBattlePlan<T extends OwnableCard> extends BattlePlan<T, CampaignAttackAction> {
    modifiedAction = CampaignAttackAction;
}

export abstract class DefenderBattlePlan<T extends OwnableCard> extends BattlePlan<T, CampaignDefenseAction> {
    modifiedAction = CampaignDefenseAction;
}

export abstract class EnemyAttackerCampaignModifier<T extends OwnableCard> extends ActionModifier<T, CampaignAttackAction> {
    modifiedAction = CampaignAttackAction;
    mustUse = true;

    canUse(): boolean {
        const ruler = this.sourceProxy.ruler?.original;
        return (
            (ruler === this.action.campaignResult.defender || !!ruler && this.action.campaignResult.defenderAllies.has(ruler))
            && this.activator === this.action.campaignResult.attacker
        );
    }
}

export abstract class EnemyDefenderCampaignModifier<T extends OwnableCard> extends ActionModifier<T, CampaignDefenseAction> {
    modifiedAction = CampaignDefenseAction;
    mustUse = true;

    canUse(): boolean {
        const ruler = this.sourceProxy.ruler?.original;
        return (
            (this.activator === this.action.campaignResult.defender || this.action.campaignResult.defenderAllies.has(this.activator))
            && ruler === this.action.campaignResult.attacker
        );
    }
}

export abstract class EffectModifier<T extends WithPowers, U extends OathEffect<any>> extends PowerWithProxy<T> {
    abstract modifiedEffect: AbstractConstructor<U>;
    effect: U;

    constructor(source: T, effect: U) {
        super(source, effect.maskProxyManager);
        this.effect = effect;
    }

    canUse(): boolean {
        return true;
    }

    applyBefore(): void { }                                                 // Applied right before the resolution of the effect
    applyAfter(result: U extends OathEffect<infer V> ? V : never): void { } // Applied after the resolution of the effect
}

export abstract class EnemyEffectModifier<T extends OwnableCard, U extends OathEffect<any>> extends EffectModifier<T, U> {
    mustUse = true;

    canUse(): boolean {
        return !!this.effect.playerProxy && this.effect.playerProxy?.enemyWith(this.sourceProxy.ruler);
    }
}

export abstract class AccessedEffectModifier<T extends OwnableCard, U extends OathEffect<any>> extends EffectModifier<T, U> {
    canUse(): boolean {
        return !!this.effect.playerProxy && this.sourceProxy.accessibleBy(this.effect.playerProxy);
    }
}
