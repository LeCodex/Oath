import { RestAction, UsePowerAction, WakeAction, CampaignAttackAction, CampaignDefenseAction } from "../actions";
import { ModifiableAction } from "../actions/base";
import { ApplyWhenPlayedEffect, GainPowerEffect, LosePowerEffect, PayPowerCostEffect } from "../actions/effects";
import { OathCard, OwnableCard, Site, WorldCard } from "../cards";
import { ResourceCost, ResourceCostContext } from "../resources";
import { OathPlayer } from "../player";
import { AbstractConstructor, Constructor, MaskProxyManager } from "../utils";
import { OathGame } from "../game";
import { WithCost, WithPowers } from "../interfaces";


//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export abstract class OathPower<T extends WithPowers> implements WithCost {
    cost: ResourceCost = new ResourceCost();
    
    constructor(
        public source: T,
        public player: OathPlayer
    ) { }
    
    get costContext() { return new ResourceCostContext(this.player, this, this.cost, this.source) }
    get name() { return this.source.name; }
    get game() { return this.source.game; }

    payCost(next?: (success: boolean) => void): void {
        new PayPowerCostEffect(this.player, this).doNext(next);
    }
}

export abstract class PowerWithProxy<T extends WithPowers> extends OathPower<T> {
    gameProxy: OathGame;
    playerProxy: OathPlayer;
    sourceProxy: T;

    constructor(source: T, player: OathPlayer, maskProxyManager: MaskProxyManager) {
        super(source, player);
        this.gameProxy = maskProxyManager.get(source.game);
        this.playerProxy = maskProxyManager.get(player);
        this.sourceProxy = maskProxyManager.get(source);
    }
}

export function Accessed<T extends AbstractConstructor<PowerWithProxy<OwnableCard> & { canUse(...args: any[]): boolean }>>(Base: T) {
    abstract class Accessed extends Base {
        canUse(...args: any[]): boolean {
            return super.canUse(...args) && this.sourceProxy.accessibleBy(this.playerProxy) && (this.sourceProxy.empty || !this.cost.placesResources);
        }
    }
    return Accessed
}

// TODO: Could maybe turn those into singletons? Something to consider
export abstract class CapacityModifier<T extends WorldCard> extends PowerWithProxy<T> {
    canUse(player: OathPlayer, site?: Site): boolean {
        return true;
    }
    
    /** Updates the information to calculate capacity in the group the source is in/being played to.
     *  
     * First return is the update to capacity (min of all values), second is a set of card proxies that don't count towards capacity. */ 
    updateCapacityInformation(targetProxy: Iterable<WorldCard>): [number, Iterable<WorldCard>] { return [Infinity, []]; }

    ignoreCapacity(cardProxy: WorldCard): boolean { return false; }
}

export abstract class CostModifier<T extends WithPowers> extends PowerWithProxy<T> {
    mustUse: boolean = false;

    canUse(context: ResourceCostContext): boolean {
        return true;
    }

    abstract modifyCostContext(context: ResourceCostContext): ResourceCostContext;
}

export abstract class WhenPlayed<T extends WorldCard> extends PowerWithProxy<T> {
    action: ApplyWhenPlayedEffect;

    constructor(source: T, player: OathPlayer, action: ApplyWhenPlayedEffect) {
        super(source, player, action.maskProxyManager);
        this.action = action;
    }

    abstract whenPlayed(): void;
}

export abstract class ActionPower<T extends WithPowers, U extends ModifiableAction> extends PowerWithProxy<T> {
    action: U;

    constructor(source: T, player: OathPlayer, action: U) {
        super(source, player, action.maskProxyManager);
        this.action = action;
    }

    abstract canUse(): boolean;
}

export abstract class ActivePower<T extends OathCard> extends ActionPower<T, UsePowerAction> {
    canUse(): boolean {
        return (
            this.costContext.payableCostsWithModifiers(this.action.maskProxyManager).length > 0 &&  // TODO: Make this global
            this.sourceProxy.accessibleBy(this.action.playerProxy) &&
            (this.sourceProxy.empty || !this.cost.placesResources)
        );
    }

    abstract usePower(): void;
}

export abstract class ActionModifier<T extends WithPowers, U extends ModifiableAction> extends ActionPower<T, U> {
    abstract modifiedAction: AbstractConstructor<U>;
    mustUse: boolean = false;

    constructor(source: T, player: OathPlayer, action: U) {
        super(source, player, action);
    }

    canUse(): boolean {
        return true;
    }

    /** Applied right after all the chosen modifiers are collected. Returns modifiers to ignore */
    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, U>>): Iterable<ActionModifier<WithPowers, U>> { return []; }
    /** Applied before the action is added to the stack. If returns false, it will not be added */
    applyWhenApplied(): boolean { return true; }
    /** Applied when the action starts and selects are set up (before choices are made) */
    applyAtStart(): void { }
    /** Applied right before the modified execution of the action is put on the stack */
    applyBefore(): void { }
    /** Applied right after the modified execution of the action */
    applyAfter(): void { }
    /** Applied after the full execution of the action (and its modifiers) */
    applyAtEnd(): void { }
    
    serialize() {
        return this.name;
    }
}

export abstract class EnemyActionModifier<T extends OwnableCard, U extends ModifiableAction> extends ActionModifier<T, U> {
    mustUse = true;

    canUse(): boolean {
        return this.playerProxy.enemyWith(this.sourceProxy.ruler);
    }
}

@Accessed
export abstract class WakePower<T extends OwnableCard> extends ActionModifier<T, WakeAction> {
    modifiedAction = WakeAction;
    mustUse = true;
}

@Accessed
export abstract class RestPower<T extends OwnableCard> extends ActionModifier<T, RestAction> {
    modifiedAction = RestAction;
    mustUse = true;
}

export function gainPowerUntilActionResolves<T extends WithPowers, U extends ModifiableAction>(source: T, power: Constructor<OathPower<T>>, action: Constructor<U>) {
    new GainPowerEffect(source.game, source, power).doNext();
    new GainPowerEffect(source.game, source, class LosePowerWhenActionResolves extends ActionModifier<T, U> {
        modifiedAction = action;
        mustUse = true;
    
        applyBefore(): void {
            new LosePowerEffect(source.game, source, power).doNext();
            new LosePowerEffect(source.game, source, LosePowerWhenActionResolves).doNext();
        }

        get name() { return `Lose ${power.name}`; }
    }).doNext();
}

export abstract class BattlePlan<T extends OwnableCard, U extends CampaignAttackAction | CampaignDefenseAction> extends ActionModifier<T, U> {
    canUse(): boolean {
        return this.playerProxy.rules(this.sourceProxy);
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
        return this.action.campaignResult.areEnemies(ruler, this.player);
    }
}

export abstract class EnemyDefenderCampaignModifier<T extends OwnableCard> extends ActionModifier<T, CampaignDefenseAction> {
    modifiedAction = CampaignDefenseAction;
    mustUse = true;

    canUse(): boolean {
        const ruler = this.sourceProxy.ruler?.original;
        return this.action.campaignResult.areEnemies(ruler, this.player);
    }
}
