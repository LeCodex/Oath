import { ModifiableAction, RestAction, UsePowerAction, WakeAction, CampaignAtttackAction, CampaignDefenseAction } from "../actions/actions";
import { ApplyWhenPlayedEffect, OathEffect, PayPowerCost } from "../effects";
import { OwnableCard, Site, WorldCard } from "../cards/cards";
import { ResourceCost } from "../resources";
import { OathPlayer } from "../player";
import { OathGameObject } from "../gameObject";
import { AbstractConstructor, MaskProxyManager } from "../utils";
import { OathGame } from "../game";


//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export abstract class OathPower<T extends OathGameObject> {
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

export abstract class PowerWithProxy<T extends OathGameObject> extends OathPower<T> {
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
    
    // Updates the information to calculate capacity in the group the source is in/being played to
    // First return is the update to capacity (min of all values), second is a set of cards that don't count towards capacity
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

export abstract class ActionPower<T extends OathGameObject> extends PowerWithProxy<T> {
    action: ModifiableAction;

    constructor(source: T, action: ModifiableAction) {
        super(source, action.maskProxyManager);
        this.action = action;
    }

    abstract canUse(): boolean;
}

export abstract class ActivePower<T extends OwnableCard> extends ActionPower<T> {
    action: UsePowerAction;

    canUse(): boolean {
        return this.sourceProxy.accessibleBy(this.action.playerProxy) && this.sourceProxy.empty;
    }

    abstract usePower(): void;
}

export abstract class ActionModifier<T extends OathGameObject> extends ActionPower<T> {
    abstract modifiedAction: AbstractConstructor<ModifiableAction>;
    mustUse: boolean = false;

    canUse(): boolean {
        return true;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> { return []; }    // Applied right after all the possible modifiers are collected
    applyWhenApplied(): boolean { return true; }    // Applied before the action is added to the list. If returns false, it will not be added
    applyAtStart(): void { }                        // Applied when the action starts and selects are setup (before choices are made)
    applyBefore(): void { }                         // Applied right before the execution of the action. Actions added by it are executed before the actual body of the modified action
    applyAfter(): void { }                          // Applied after the execution of the action
}

export abstract class EnemyActionModifier<T extends OwnableCard> extends ActionModifier<T> {
    mustUse = true;

    canUse(): boolean {
        return this.action.playerProxy.enemyWith(this.sourceProxy.ruler);
    }
}

export abstract class AccessedActionModifier<T extends OwnableCard> extends ActionModifier<T> {
    canUse(): boolean {
        return this.sourceProxy.accessibleBy(this.action.playerProxy) && this.sourceProxy.empty;
    }
}

export abstract class WakePower<T extends OwnableCard> extends AccessedActionModifier<T> {
    modifiedAction = WakeAction;
    action: WakeAction;
    mustUse = true;
}

export abstract class RestPower<T extends OwnableCard> extends AccessedActionModifier<T> {
    modifiedAction = RestAction;
    action: RestAction;
    mustUse = true;
}

export abstract class BattlePlan<T extends OwnableCard> extends ActionModifier<T> {
    canUse(): boolean {
        return this.action.playerProxy.rules(this.sourceProxy);
    }
}

export abstract class AttackerBattlePlan<T extends OwnableCard> extends BattlePlan<T> {
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;
}

export abstract class DefenderBattlePlan<T extends OwnableCard> extends BattlePlan<T> {
    modifiedAction = CampaignDefenseAction;
    action: CampaignDefenseAction;
}

export abstract class EffectModifier<T extends OathGameObject> extends PowerWithProxy<T> {
    abstract modifiedEffect: AbstractConstructor<OathEffect<any>>;
    effect: OathEffect<any>;

    constructor(source: T, effect: OathEffect<any>) {
        super(source, effect.maskProxyManager);
        this.effect = effect;
    }

    canUse(): boolean {
        return true;
    }

    applyBefore(): void { }             // Applied right before the resolution of the effect
    applyAfter(result: any): void { }   // Applied after the resolution of the effect
}

export abstract class EnemyEffectModifier<T extends OwnableCard> extends EffectModifier<T> {
    mustUse = true;

    canUse(): boolean {
        return !!this.effect.playerProxy && this.effect.playerProxy?.enemyWith(this.sourceProxy.ruler);
    }
}

export abstract class AccessedEffectModifier<T extends OwnableCard> extends EffectModifier<T> {
    canUse(): boolean {
        return !!this.effect.playerProxy && this.sourceProxy.accessibleBy(this.effect.playerProxy);
    }
}
