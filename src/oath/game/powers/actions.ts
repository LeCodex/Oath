import type { WithPowers } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import type { OathPower, ActionModifier } from ".";
import { ActivePower } from ".";
import type { MaskProxyManager } from "../utils";
import { allCombinations } from "../utils";
import { PlayerEffect, OathAction, ResolveCallbackEffect, type ParametersType } from "../actions/base";
import { SelectNOf } from "../actions/selects";
import type { OathPowerManager } from "./manager";
import type { OwnableCard } from "../model/cards";
import { MultiCostContext } from "./context";
import { cannotPayError } from "../actions/utils";
import { TransferResourcesEffect } from "../actions/effects";
import { ResourcesAndWarbands } from "../model/resources";
import type { PowerName } from "./classIndex";
import type { CostContext } from "../costs";
import { ResourceTransferContext } from "../costs";


export abstract class ExpandedAction extends OathAction {
    powerManagerProxy: OathPowerManager;

    constructor(public powerManager: OathPowerManager, player: OathPlayer) {
        super(powerManager.actionManager, player);
        this.powerManagerProxy = this.maskProxyManager.get(powerManager);
    }
}

export class ChooseModifiers<T extends OathAction> extends ExpandedAction {
    declare readonly selects: { modifiers: SelectNOf<ActionModifier<WithPowers, T>[]>; };
    readonly modifiableAction: ModifiableAction<T>;
    readonly next: ModifiableAction<T> | ChooseModifiers<T>;
    readonly message = "Choose modifiers";

    constructor(powerManager: OathPowerManager, next: ModifiableAction<T> | ChooseModifiers<T>, chooser: OathPlayer = next.player) {
        super(powerManager, chooser);
        this.next = next;
        this.modifiableAction = next instanceof ChooseModifiers ? next.modifiableAction : next;
    }

    static gatherActionModifiers<T extends OathAction>(powerManager: OathPowerManager, action: T, player: OathPlayer, maskProxyManager: MaskProxyManager) {
        const persistentModifiers = new Set<ActionModifier<WithPowers, T>>();
        const optionalModifiers = new Set<ActionModifier<WithPowers, T>>();
        for (const modifier of powerManager.gatherActionModifiers(action, player, maskProxyManager)) {
            if (modifier.mustUse) {
                persistentModifiers.add(modifier);
            } else {
                optionalModifiers.add(modifier);
            }
        }

        return {
            persistentModifiers,
            optionalModifiers
        };
    }

    start() {
        const defaults: string[] = [];
        const maskProxyManager = this.modifiableAction.maskProxyManager;
        const { persistentModifiers, optionalModifiers } = ChooseModifiers.gatherActionModifiers(this.powerManager, this.modifiableAction.action, this.player, maskProxyManager);
        
        // TODO: Change to permutations to handle order (maybe have order agnosticity as a property)
        const choices = new Map<string, ActionModifier<WithPowers, T>[]>();
        for (const combination of allCombinations(optionalModifiers)) {
            const completeCombination = [...persistentModifiers, ...combination];
            const totalContext = new MultiCostContext(
                this.powerManager, this.player, completeCombination.map(e => e.selfCostContext),
                ResourceTransferContext.dummyFactory(this.player)
            );
            
            if (totalContext.payableCostsWithModifiers(maskProxyManager).length) {
                choices.set(combination.length ? combination.map(e => e.name).join(", ") : "None", completeCombination);
            }
        }
        this.selects.modifiers = new SelectNOf("Modifiers", choices, { defaults, min: 1 });
        
        return super.start();
    }

    execute() {
        const modifiers = new Set(this.parameters.modifiers[0]);

        if (this.modifiableAction.applyModifiers(modifiers)) {
            this.next.doNext();
        }
    }
}

export class ModifiableAction<T extends OathAction> extends OathAction {
    modifiers: ActionModifier<WithPowers, T>[] = [];
    message: string;
    autocompleteSelects: boolean;

    constructor(
        public action: T
    ) {
        super(action.actionManager, action.player);
        this.message = action.message;
        this.autocompleteSelects = action.autocompleteSelects;
    }

    start(): boolean {
        const continueNow = this.action.start();
        for (const modifier of this.modifiers) modifier.applyAtStart();
        Object.assign(this.selects, this.action.selects);
        return continueNow;
    }

    parse(data: Record<string, string[]>): Record<string, any[]> {
        return this.action.parse(data);
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        this.action.applyParameters(values);
    }

    execute() {
        for (const modifier of this.modifiers) modifier.applyBefore();
        new ResolveCallbackEffect(this.actionManager, () => {
            this.action.execute();
            for (const modifier of this.modifiers) modifier.applyAfter();
        }).doNext();
        new ResolveCallbackEffect(this.actionManager, () => { for (const modifier of this.modifiers) modifier.applyAtEnd(); }).doNext();
    }

    serialize(): Record<string, any> | undefined {
        return {
            ...this.action.serialize(),
            modifiers: this.modifiers.map(e => e.serialize())
        };
    }

    applyModifiers(modifiers: Iterable<ActionModifier<WithPowers, T>>, noPay: boolean = false) {
        // NOTE: For ignore loops, all powers in the loop are ignored.
        const modifiersSet = new Set(modifiers);
        const ignore = new Set<ActionModifier<WithPowers, T>>();
        for (const modifier of [...modifiers, ...this.modifiers])
            for (const toIgnore of modifier.applyImmediately(modifiers))
                ignore.add(toIgnore);
        for (const modifier of ignore) modifiersSet.delete(modifier);

        this.modifiers.push(...modifiersSet);
        let shouldContinue = true;
        for (const modifier of modifiersSet) {
            if (!noPay) {
                modifier.payCost(success => {
                    if (!success) throw cannotPayError(modifier.cost);
                });
            }

            if (!modifier.applyWhenApplied()) shouldContinue = false;

            // Modifiers can only be applied once
            modifier.sourceProxy.powers.delete(modifier.constructor.name as PowerName);
        }

        return shouldContinue;
    }
}

export class UsePowerAction extends ExpandedAction {
    declare readonly selects: { power: SelectNOf<ActivePower<OwnableCard>>; };
    readonly autocompleteSelects = false;
    readonly message = "Choose a power to use";

    power: ActivePower<OwnableCard>;

    start() {
        const choices = new Map<string, ActivePower<OwnableCard>>();
        for (const [sourceProxy, power] of this.powerManagerProxy.getPowers(ActivePower<OwnableCard>)) {
            const instance = new power(this.powerManager, sourceProxy.original, this.player, this);
            if (instance.canUse()) choices.set(instance.name, instance);
        }
        this.selects.power = new SelectNOf("Power", choices, { min: 1 });
        return super.start();
    }

    applyParameters(values: Partial<ParametersType<this>>): void {
        super.applyParameters(values);
        this.power = this.parameters.power[0]!;
    }

    execute(): void {
        this.power.payCost(success => {
            if (!success) throw cannotPayError(this.power.cost);
            this.power.usePower();
        });
    }
}

export class ChoosePayableCostContextAction<T extends CostContext<any>> extends ExpandedAction {
    declare readonly selects: { costContext: SelectNOf<T | undefined>; };
    readonly message = "Choose a cost to pay";

    constructor(
        powerManager: OathPowerManager,
        player: OathPlayer,
        public costContext: T,
        public callback: (costContext: T) => void
    ) {
        super(powerManager, player);
    }

    start() {
        const choices = new Map<string, T>();
        const payableCostContextsInfo = this.powerManager.payableCostsWithModifiers(this.costContext, this.maskProxyManager);
        for (const costContextInfo of payableCostContextsInfo)
            choices.set(costContextInfo.context.cost.toString() + ` (${costContextInfo.modifiers.map(e => e.name).join(", ") || "Base"})`, costContextInfo.context as T);
        this.selects.costContext = new SelectNOf("Cost", choices, { min: 1 });
        return super.start();
    }

    execute(): void {
        this.callback(this.parameters.costContext[0]!);
    }
}

export class PayPowerCostEffect extends PlayerEffect<boolean> {
    powerManager: OathPowerManager;

    constructor(
        player: OathPlayer,
        public power: OathPower<WithPowers>
    ) {
        super(power.powerManager.actionManager, player);
        this.powerManager = power.powerManager;
    }

    resolve(): void {
        const target = this.power.source instanceof ResourcesAndWarbands ? this.power.source : undefined;
        const costContext = new ResourceTransferContext(this.player, this.power.source, this.power.cost, target);
        new TransferResourcesEffect(this.actionManager, costContext).doNext(result => this.result = result);
    }
}

