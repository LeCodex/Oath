import { ActionModifier, WhenPlayed } from ".";
import type { CapacityInformation} from "../actions";
import { ActPhaseAction, SearchPlayOrDiscardAction } from "../actions";
import type { OathEffect } from "../actions/base";
import { CheckCapacityEffect, PaySupplyEffect, PlayWorldCardEffect, TransferResourcesEffect } from "../actions/effects";
import { InvalidActionResolution } from "../actions/utils";
import { type Cost, type CostContext } from "../costs";
import { Site } from "../model/cards";
import type { OathGame } from "../model/game";
import { hasCostContexts } from "../model/interfaces";
import type { AbstractConstructor, MaskProxyManager } from "../utils";
import { allChoices, allCombinations, isExtended } from "../utils";
import { ChooseModifiers, ChooseModifiedCostContextAction, UsePowerAction } from "./actions";
import { powersIndex } from "./classIndex";
import { MultiCostContext } from "./context";
import type { OathPowerManager } from "./manager";
import { getCapacityInformation } from "./utils";


export class AddUsePowerAction extends ActionModifier<OathGame, ActPhaseAction> {
    modifiedAction = ActPhaseAction;
    mustUse = true;

    applyAtStart(): void {
        this.action.selects.action.choices.set("Use", () => this.action.next = new UsePowerAction(this.powerManager, this.action.player));
    }
}
export class FilterUnpayableActions extends ActionModifier<OathGame, ActPhaseAction> {
    modifiedAction = ActPhaseAction;
    mustUse = true;

    applyAtStart(): void {
        this.action.selects.action.filterChoices((factory) => {
            const dummyAction = factory();
            const maskProxyManager = this.action.maskProxyManager;
            const { persistentModifiers, optionalModifiers } = ChooseModifiers.gatherActionModifiers(this.powerManager, dummyAction, this.action.player, maskProxyManager);
            for (const combination of allCombinations(optionalModifiers)) {
                try {
                    const action = factory();  // Get a blank state, then update the modifiers to use that new action
                    const completeCombination = new Set([...persistentModifiers, ...combination].map((e) => { e.action = action; return e; }));
                    const modifiableAction = this.powerManager.getModifiable(action);
                    if (!modifiableAction.applyModifiers(completeCombination, true)) continue;
                    modifiableAction.start();
                    if (!hasCostContexts(action)) return true;

                    for (const choice of allChoices(Object.entries(action.selects).map(([k, v]) => [...v.allPossibleChoices].map((e) => [k, e] as const)))) {
                        const parsed = modifiableAction.parse(Object.fromEntries(choice));
                        modifiableAction.applyParameters(parsed);

                        const costContextPerType = new Map<typeof CostContext<Cost>, CostContext<Cost>[]>();
                        for (const context of action.costContexts) {
                            const cls = context.constructor as typeof CostContext<Cost>;
                            if (!costContextPerType.has(cls)) costContextPerType.set(cls, []);
                            costContextPerType.get(cls)!.push(context);
                        }
                        
                        if ([...costContextPerType].every(([cls, contexts]) =>
                            new MultiCostContext(this.powerManager, this.player, contexts, cls.dummyFactory(this.player)).costsWithModifiers(maskProxyManager).length
                        )) {
                            return true;
                        }
                    }
                } catch (e) {
                    if (e instanceof InvalidActionResolution) continue;
                    throw e;
                }
            }

            return false;
        });
    }
}
function ModifyCostContextResolver<T extends OathEffect<any> & { context: CostContext<Cost> }>(base: AbstractConstructor<T>) {
    abstract class ModifyCostContextResolver extends ActionModifier<OathGame, T> {
        modifiedAction = base;
        mustUse = true;

        applyBefore(): void {
            if (!this.player) return;
            new ChooseModifiedCostContextAction(this.powerManager, this.player, this.action.context, (costContext) => {
                this.action.context = costContext;
            }).doNext();
        }
    }
    return ModifyCostContextResolver;
}
export class ModifyResourceTransfer extends ModifyCostContextResolver(TransferResourcesEffect) { }
export class ModifySupplyPayment extends ModifyCostContextResolver(PaySupplyEffect) { }

export class FilterFullCardTargets extends ActionModifier<OathGame, SearchPlayOrDiscardAction> {
    modifiedAction = SearchPlayOrDiscardAction;
    mustUse = true;

    siteToCapacityInformation = new WeakMap<Site, CapacityInformation>();
    playerCapacityInformation = new Map<boolean, CapacityInformation>();

    applyAtStart(): void {
        this.action.selects.choice.filterChoices((choice) => {
            if (choice === undefined) return true;

            const playingProxy = this.action.cardProxy;
            const facedown = typeof choice === "boolean" ? choice : false;
            const siteProxy = typeof choice === "boolean" ? undefined : choice;
            const canReplace = this.action.canReplace || siteProxy === undefined;

            playingProxy.facedown = facedown;
            const capacityInformation: CapacityInformation = getCapacityInformation(this.powerManager, this.action.maskProxyManager, siteProxy, this.action.playerProxy, playingProxy);
            if (
                !capacityInformation.ignoresCapacity &&
                !canReplace &&
                capacityInformation.capacity <= capacityInformation.takesSpaceInTargetProxies.length
            )
                return false;

            if (typeof choice === "boolean")
                this.playerCapacityInformation.set(choice, capacityInformation);
            else
                this.siteToCapacityInformation.set(choice, capacityInformation);

            return true;
        });
    }

    applyBefore(): void {
        const choice = this.action.parameters.choice[0];
        if (choice !== undefined) {
            if (typeof choice === "boolean")
                this.action.capacityInformation = this.playerCapacityInformation.get(choice)!;
            else
                this.action.capacityInformation = this.siteToCapacityInformation.get(choice)!;
        }
    }
}

export class FillCapacityInformation extends ActionModifier<OathGame, CheckCapacityEffect> {
    modifiedAction = CheckCapacityEffect;
    mustUse = true;

    applyBefore(): void {
        for (const origin of this.action.origins) {
            this.action.capacityInformations.set(origin, getCapacityInformation(
                this.powerManager,
                this.action.maskProxyManager,
                origin instanceof Site ? origin : undefined,
                this.action.playerProxy
            ));
        }
    }
}

export class ResolveWhenPlayed extends ActionModifier<OathGame, PlayWorldCardEffect> {
    modifiedAction = PlayWorldCardEffect;
    mustUse = true;

    applyAtEnd(): void {
        if (this.action.card.facedown) return;
        
        for (const power of this.action.card.powers) {
            const powerCls = powersIndex[power];
            if (isExtended(powerCls, WhenPlayed)) {
                new powerCls(this.powerManager, this.action.card as any, this.action.player, this.action).whenPlayed();
            }
        }
    }
}