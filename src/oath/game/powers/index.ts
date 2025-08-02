import { RestAction, WakeAction, CampaignAttackAction, CampaignDefenseAction, RecoverAction } from "../actions";
import { UsePowerAction, PayPowerCostEffect } from "./actions";
import { OathAction } from "../actions/base";
import { PlayWorldCardEffect, SeizeTargetEffect } from "../actions/effects";
import { OathCard, OwnableCard, Site, WorldCard } from "../model/cards";
import { CostContext, ResourceCost, ResourceTransferContext, SupplyCostContext } from "../costs";
import { OathPlayer } from "../model/player";
import { AbstractConstructor, Constructor, MaskProxyManager } from "../utils";
import { OathGame } from "../model/game";
import { CampaignActionTarget, RecoverActionTarget, WithPowers } from "../model/interfaces";
import { OathPowerManager } from "./manager";


//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export abstract class OathPower<T extends WithPowers> {
    cost: ResourceCost = new ResourceCost();
    powerManagerProxy: OathPowerManager;
    gameProxy: OathGame;
    playerProxy: OathPlayer;
    sourceProxy: T;
    
    constructor(
        public powerManager: OathPowerManager,
        public source: T,
        public player: OathPlayer,
        public maskProxyManager: MaskProxyManager
    ) {
        this.powerManagerProxy = maskProxyManager.get(powerManager);
        this.gameProxy = maskProxyManager.get(source.game);
        this.playerProxy = maskProxyManager.get(player);
        this.sourceProxy = maskProxyManager.get(source);
    }

    get actionManager() { return this.powerManager.actionManager; }
    
    get selfCostContext() { return new ResourceTransferContext(this.player, this, this.cost, this.source); }
    get name() { return this.source.name; }
    get game() { return this.source.game; }

    payCost(next?: (success: boolean) => void): void {
        if (this.cost.free) {
            if (next) next(true);
            return;
        }
        new PayPowerCostEffect(this.player, this).doNext(next);
    }
}

export function Accessed<T extends AbstractConstructor<OathPower<OwnableCard> & { canUse(...args: any[]): boolean }>>(Base: T) {
    abstract class AccessedModifier extends Base {
        canUse(...args: any[]): boolean {
            return super.canUse(...args) && this.sourceProxy.accessibleBy(this.playerProxy) && (this.sourceProxy.empty || !this.cost.placesResources);
        }
    }
    return AccessedModifier;
}

// TODO: Could maybe turn those into singletons? Something to consider
export abstract class CapacityModifier<T extends WorldCard> extends OathPower<T> {
    canUse(player: OathPlayer, site?: Site): boolean {
        return true;
    }
    
    /** Updates the information to calculate capacity in the group the source is in/being played to.
     *  
     * First return is the update to capacity (min of all values), second is a set of card proxies that don't count towards capacity. */ 
    updateCapacityInformation(targetProxy: Iterable<WorldCard>): [number, Iterable<WorldCard>] { return [Infinity, []]; }

    ignoreCapacity(cardProxy: WorldCard): boolean { return false; }
}

export abstract class CostModifier<T extends WithPowers, U extends CostContext<any>> extends OathPower<T> {
    abstract modifiedContext: AbstractConstructor<U>;
    mustUse: boolean = false;

    canUse(context: U): boolean {
        return true;
    }

    abstract apply(context: U): void;
}
export abstract class SupplyCostModifier<T extends WithPowers> extends CostModifier<T, SupplyCostContext> {
    modifiedContext = SupplyCostContext;
};
export abstract class ResourceTransferModifier<T extends WithPowers> extends CostModifier<T, ResourceTransferContext> {
    modifiedContext = ResourceTransferContext;
};

export abstract class ActionPower<T extends WithPowers, U extends OathAction> extends OathPower<T> {
    constructor(
        powerManager: OathPowerManager,
        source: T,
        player: OathPlayer,
        public action: U
    ) {
        super(powerManager, source, player, action.maskProxyManager);
    }

    abstract canUse(): boolean;
}

export abstract class ActivePower<T extends OathCard> extends ActionPower<T, UsePowerAction> {
    canUse(): boolean {
        return (
            this.powerManager.costsWithModifiers(this.selfCostContext, this.action.maskProxyManager).length > 0 &&  // TODO: Make this global
            this.sourceProxy.accessibleBy(this.action.playerProxy) &&
            (this.sourceProxy.empty || !this.cost.placesResources)
        );
    }

    abstract usePower(): void;
}

export abstract class WhenPlayed<T extends WorldCard> extends ActionPower<T, PlayWorldCardEffect> {
    canUse(): boolean {
        return true;
    }

    abstract whenPlayed(): void;
}

export abstract class ActionModifier<T extends WithPowers, U extends OathAction> extends ActionPower<T, U> {
    abstract modifiedAction: AbstractConstructor<U>;
    mustUse: boolean = false;

    canUse(): boolean {
        return true;
    }

    /** Applied right after all the chosen modifiers are collected. Returns modifiers to ignore.
     * 
     * NO SIDE EFFECTS BESIDES THE MODIFIED ACTION. */
    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, U>>): Iterable<ActionModifier<WithPowers, U>> { return []; }
    /** Applied before the action is added to the stack. If returns false, it will not be added.
     * 
     * NO SIDE EFFECTS BESIDES THE MODIFIED ACTION. */
    applyWhenApplied(): boolean { return true; }
    /** Applied when the action starts and selects are set up (before choices are made).
     * 
     * NO SIDE EFFECTS BESIDES THE MODIFIED ACTION. */
    applyAtStart(): void { }
    /** Applied right before the modified execution of the action is put on the stack. Choices are made right before */
    applyBefore(): void { }
    /** Applied right after the modified execution of the action */
    applyAfter(): void { }
    /** Applied after the full execution of the action (and its modifiers) */
    applyAtEnd(): void { }
    
    serialize() {
        return this.name;
    }
}

export function ActionCostModifier<T extends WithPowers, U extends CostContext<any>>(base: Constructor<ActionModifier<T, OathAction>>, costContext: Constructor<U>) {
    abstract class ActionCostModifier extends CostModifier<T, U> {
        modifiedContext = costContext;

        canUse(context: U): boolean {
            const instance = new base(this.powerManager, this.source, this.player, context.origin);  // Actions can't have modifiedAction as static because of initialization order making it a pain
            return super.canUse(context) && context.origin instanceof instance.modifiedAction && !!this.powerManager.futureActionsModifiable.get(context.origin)?.modifiers.some(e => e instanceof base);
        }
    }
    return ActionCostModifier;
}
export function NoSupplyCostActionModifier<T extends WithPowers>(base: Constructor<ActionModifier<T, OathAction>>) {
    return class NoSupplyCostActionModifier extends ActionCostModifier(base, SupplyCostContext) {
        apply(context: SupplyCostContext): void {
            context.cost.multiplier = 0;
        }
    }
}

export abstract class EnemyActionModifier<T extends OwnableCard, U extends OathAction> extends ActionModifier<T, U> {
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.playerProxy.enemyWith(this.sourceProxy.ruler);
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

export abstract class BattlePlan<T extends OwnableCard, U extends CampaignAttackAction | CampaignDefenseAction> extends ActionModifier<T, U> {
    canUse(): boolean {
        return super.canUse() && this.playerProxy.rules(this.sourceProxy);
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
        return super.canUse() && this.action.campaignResult.areEnemies(ruler, this.player);
    }
}

export abstract class EnemyDefenderCampaignModifier<T extends OwnableCard> extends ActionModifier<T, CampaignDefenseAction> {
    modifiedAction = CampaignDefenseAction;
    mustUse = true;

    canUse(): boolean {
        const ruler = this.sourceProxy.ruler?.original;
        return super.canUse() && this.action.campaignResult.areEnemies(ruler, this.player);
    }
}

export abstract class SeizeModifier<T extends CampaignActionTarget & WithPowers> extends ActionModifier<T, SeizeTargetEffect> {
    modifiedAction = SeizeTargetEffect;
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.action.target === this.source;
    }
}

export abstract class RecoverModifier<T extends RecoverActionTarget & WithPowers> extends ActionModifier<T, RecoverAction> {
    modifiedAction = RecoverAction;
    mustUse = true;

    applyBefore(): void {
        if (this.action.targetProxy === this.sourceProxy)
            this.modify();
    }

    abstract modify(): void;
}
