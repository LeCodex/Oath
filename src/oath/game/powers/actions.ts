import type { WithPowers } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import type { OathPower, ActionModifier} from ".";
import { ActivePower } from ".";
import type { MaskProxyManager } from "../utils";
import { allCombinations } from "../utils";
import { PlayerEffect, OathAction, ResolveCallbackEffect, type ParametersType } from "../actions/base";
import { SelectNOf } from "../actions/selects";
import type { CostContextInfo, OathPowerManager } from "./manager";
import type { OwnableCard } from "../model/cards";
import { MultiCostContext } from "./context";
import { cannotPayError, InvalidActionResolution } from "../actions/utils";
import { TransferResourcesEffect } from "../actions/effects";
import { ResourcesAndWarbands } from "../model/resources";
import type { PowerName } from "./classIndex";
import type { CostContext } from "../costs";
import { ResourceTransferContext } from "../costs";
import { recordExecutionTime } from "../../utils";


export abstract class ExpandedAction extends OathAction {
    powerManagerProxy: OathPowerManager;

    constructor(public powerManager: OathPowerManager, player: OathPlayer | undefined) {
        super(powerManager.actionManager, player);
        this.powerManagerProxy = this.maskProxyManager.get(powerManager);
    }
}

export abstract class ExpandedPlayerAction extends ExpandedAction {
    declare player: OathPlayer;

    constructor(public powerManager: OathPowerManager, player: OathPlayer) {
        super(powerManager, player);
    }
}

export class ChooseModifiers<T extends OathAction> extends ExpandedAction {
    declare readonly selects: { modifiers: SelectNOf<ActionModifier<WithPowers, T>>; };
    readonly modifiableAction: ModifiableAction<T>;
    readonly message = "Choose and order modifiers";

    persistentModifiers = new Set<ActionModifier<WithPowers, T>>();
    chosenModifiers = new Set<ActionModifier<WithPowers, T>>()

    constructor(powerManager: OathPowerManager, public readonly next: ModifiableAction<T> | ChooseModifiers<T>, chooser: OathPlayer | undefined = next.player) {
        super(powerManager, chooser);
        this.modifiableAction = next instanceof ChooseModifiers ? next.modifiableAction : next;
    }

    get defaultChoices() {
        return {
            modifiers: this.selects.modifiers && [...this.selects.modifiers.choices.values()].filter((e) => e.cost.free)
        };
    }

    static gatherActionModifiers<T extends OathAction>(powerManager: OathPowerManager, action: T, player: OathPlayer | undefined, maskProxyManager: MaskProxyManager) {
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
        const defaults = new Set<string>();
        const maskProxyManager = this.modifiableAction.maskProxyManager;
        const { persistentModifiers, optionalModifiers } = ChooseModifiers.gatherActionModifiers(this.powerManager, this.modifiableAction.action, this.player, maskProxyManager);
        this.persistentModifiers = persistentModifiers;

        const combinations: ActionModifier<WithPowers, T>[][] = [];
        for (const combination of allCombinations(optionalModifiers)) {
            const completeCombination = [...persistentModifiers, ...combination];
            const totalContext = new MultiCostContext(
                this.powerManager, this.player, completeCombination.map((e) => e.selfCostContext),
                ResourceTransferContext.dummyFactory(this.player)
            );

            if (totalContext.validCostsWithModifiers(maskProxyManager).length) {
                combinations.push(completeCombination);
            }
        }
        const choices = new Map<string, ActionModifier<WithPowers, T>>();
        for (const combination of combinations) {
            for (const modifier of combination) {
                if (!modifier.mustUse || modifier.order !== undefined && combination.filter((e) => e.order === modifier.order && e.mustUse === modifier.mustUse).length > 1) {
                    choices.set(modifier.name, modifier);
                    this.chosenModifiers.add(modifier);
                    if (modifier.cost.free || modifier.mustUse) defaults.add(modifier.name);
                }
            }
        }
        this.selects.modifiers = new SelectNOf("Modifiers", choices, { defaults });
        

        return super.start();
    }

    execute() {
        const modifiers = new Set<ActionModifier<WithPowers, T>>(this.parameters.modifiers);
        for (const modifier of this.persistentModifiers) {
            if (this.chosenModifiers.has(modifier)) {
                if (!modifiers.has(modifier)) {
                    throw new InvalidActionResolution(`Must use modifier ${modifier.name}`);
                }
            } else {
                modifiers.add(modifier);
            }
        }

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
            recordExecutionTime.skip(`${this.action.constructor.name}.execute`, this.action.execute.bind(this.action));
            for (const modifier of this.modifiers) modifier.applyAfter();
        }).doNext();
        new ResolveCallbackEffect(this.actionManager, () => { for (const modifier of this.modifiers) modifier.applyAtEnd(); }).doNext();
    }

    serialize(): Record<string, any> {
        return {
            ...this.action.serialize(),
            modifiers: this.modifiers.map((e) => e.serialize())
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
        this.modifiers.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
        let shouldContinue = true;
        for (const modifier of modifiersSet) {
            if (!noPay) {
                modifier.payCost((success) => {
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

export class UsePowerAction extends ExpandedPlayerAction {
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
        this.power.payCost((success) => {
            if (!success) throw cannotPayError(this.power.cost);
            this.power.usePower();
        });
    }
}

export class ChooseModifiedCostContextAction<T extends CostContext<any>> extends ExpandedPlayerAction {
    declare readonly selects: { costContextInfo: SelectNOf<CostContextInfo<T>>; };
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
        const choices = new Map<string, CostContextInfo<T>>();
        const payableCostContextsInfo = this.powerManager.validCostsWithModifiers(this.costContext, this.maskProxyManager);
        if (payableCostContextsInfo.length === 0)
            throw new InvalidActionResolution(`Cannot pay cost: ${this.costContext.cost}`);

        for (const costContextInfo of payableCostContextsInfo)
            choices.set(costContextInfo.context.cost.toString() + ` (${costContextInfo.modifiers.map((e) => e.name).join(", ") || "Base"})`, costContextInfo);
        this.selects.costContextInfo = new SelectNOf("Cost", choices, { min: 1 });
        return super.start();
    }

    execute(): void {
        const costContextInfo = this.parameters.costContextInfo[0]!;
        const payedModifiers = new Map(costContextInfo.modifiers.map((e) => [e, false]));
        if (costContextInfo.modifiers.length) {
            for (const modifier of costContextInfo.modifiers) {
                modifier.payCost((success) => {
                    if (!success) throw cannotPayError(modifier.cost);
                    payedModifiers.set(modifier, true);
                    if ([...payedModifiers.values()].every((e) => e)) this.callback(costContextInfo.context);
                });
            }
        } else {
            this.callback(costContextInfo.context);
        }
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
        new TransferResourcesEffect(this.actionManager, costContext).doNext((result) => this.result = result);
    }
}
