import type { WithPowers } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import { ActivePower, type ActionModifier } from ".";
import { allCombinations } from "../utils";
import { PlayerEffect, ActionWithProxy } from "../actions/base";
import { SelectNOf } from "../actions/selects";
import type { OathPowersManager } from "./manager";
import type { OathActionManager } from "../actions/manager";
import type { OwnableCard } from "../model/cards";
import { MultiResourceTransferContext, type CostContext } from "./context";
import { cannotPayError } from "../actions/utils";
import type { PowerName } from "./classIndex";
import {  TransferResourcesEffect } from "../actions/effects";
import { ResourcesAndWarbands } from "../model/resources";


export abstract class ExpandedAction extends ActionWithProxy {
    constructor(public powersManager: OathPowersManager, actionManager: OathActionManager, player: OathPlayer) {
        super(actionManager, player);
    }
}

export class ChooseModifiers<T extends ActionWithProxy> extends ExpandedAction {
    declare readonly selects: { modifiers: SelectNOf<ActionModifier<WithPowers, T>[]>; };
    declare readonly parameters: { modifiers: ActionModifier<WithPowers, T>[][]; };
    readonly action: T;
    readonly next: T | ChooseModifiers<T>;
    readonly message = "Choose modifiers";

    constructor(powersManager: OathPowersManager, next: T | ChooseModifiers<T>, chooser: OathPlayer = next.player) {
        super(powersManager, next.actionManager, chooser);
        this.next = next;
        this.action = next instanceof ChooseModifiers ? next.action : next;
    }

    start() {
        const defaults: string[] = [];
        const persistentModifiers = new Set<ActionModifier<WithPowers, T>>();
        const optionalModifiers = new Set<ActionModifier<WithPowers, T>>();
        for (const modifier of this.powersManager.gatherActionModifiers(this.action, this.player)) {
            if (modifier.mustUse) {
                persistentModifiers.add(modifier);
            } else {
                optionalModifiers.add(modifier);
            }
        }

        // TODO: Change to permutations to handle order (maybe have order agnosticity as a property)
        const choices = new Map<string, ActionModifier<WithPowers, T>[]>();
        for (const combination of allCombinations(optionalModifiers)) {
            const totalContext = new MultiResourceTransferContext(this.player, this, [...persistentModifiers, ...combination].map(e => e.costContext));
            if (!totalContext.payableCostsWithModifiers(this.action.maskProxyManager).length)
                choices.set(combination.map(e => e.name).join(", "), combination);
        }
        this.selects.modifiers = new SelectNOf("Modifiers", choices, { defaults });

        return super.start();
    }

    execute() {
        const modifiers = new Set(this.parameters.modifiers[0]);

        // NOTE: For ignore loops, all powers in the loop are ignored.
        const ignore = new Set<ActionModifier<WithPowers, T>>();
        for (const modifier of modifiers)
            for (const toIgnore of modifier.applyImmediately(modifiers))
                ignore.add(toIgnore);
        for (const modifier of ignore) modifiers.delete(modifier);

        if (this.applyModifiers(modifiers)) {
            this.next.doNext();
        }
    }

    applyModifiers(modifiers: Iterable<ActionModifier<WithPowers, this["action"]>>) {
        this.modifiers.push(...modifiers);

        let shouldContinue = true;
        for (const modifier of modifiers) {
            modifier.payCost(success => {
                if (!success) throw cannotPayError(modifier.cost);
            });

            if (!modifier.applyWhenApplied()) shouldContinue = false;

            // Modifiers can only be applied once
            modifier.sourceProxy.powers.delete(modifier.constructor.name as PowerName);
        }

        return shouldContinue;
    }
}

export class UsePowerAction extends ExpandedAction {
    declare readonly selects: { power: SelectNOf<ActivePower<OwnableCard>>; };
    declare readonly parameters: { power: ActivePower<OwnableCard>[]; };
    readonly autocompleteSelects = false;
    readonly message = "Choose a power to use";

    power: ActivePower<OwnableCard>;

    start() {
        const choices = new Map<string, ActivePower<OwnableCard>>();
        for (const [sourceProxy, power] of this.powersManager.getPowers(ActivePower<OwnableCard>)) {
            const instance = new power(sourceProxy.original, this.player, this);
            if (instance.canUse()) choices.set(instance.name, instance);
        }
        this.selects.power = new SelectNOf("Power", choices, { min: 1 });
        return super.start();
    }

    execute(): void {
        this.power = this.parameters.power[0]!;
        super.execute();
    }

    modifiedExecution(): void {
        this.power.payCost(success => {
            if (!success) throw cannotPayError(this.power.cost);
            this.power.usePower();
        });
    }
}

export class ChoosePayableCostContextAction<T extends CostContext<any>> extends ExpandedAction {
    declare readonly selects: { costContext: SelectNOf<T | undefined>; };
    declare readonly parameters: { costContext: (T | undefined)[]; };
    readonly message: string;

    constructor(
        powersManager: OathPowersManager,
        actionManager: OathActionManager,
        player: OathPlayer,
        public costContext: T,
        public callback: (costContext: T) => void
    ) {
        super(powersManager, actionManager, player);
    }

    start() {
        const choices = new Map<string, T>();
        const payableCostContextsInfo = this.costContext.payableCostsWithModifiers(this.maskProxyManager);
        for (const costContextInfo of payableCostContextsInfo)
            choices.set(costContextInfo.context.cost.toString() + `(${costContextInfo.modifiers.map(e => e.name).join(", ") || "Base"})`, costContextInfo.context as T);
        this.selects.costContext = new SelectNOf("Cost", choices, { min: 1 });
        return super.start();
    }

    modifiedExecution(): void {
        this.callback(this.parameters.costContext[0]!);
    }
}

export class PayPowerCostEffect extends PlayerEffect<boolean> {
    power: OathPower<WithPowers>;

    constructor(player: OathPlayer, power: OathPower<WithPowers>) {
        super(player);
        this.power = power;
    }

    resolve(): void {
        const target = this.power.source instanceof ResourcesAndWarbands ? this.power.source : undefined;
        new TransferResourcesEffect(this.game, this.power.costContext).doNext(result => this.result = result);
    }
}

