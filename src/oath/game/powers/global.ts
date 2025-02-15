import { ActionModifier, WhenPlayed } from ".";
import { ActPhaseAction } from "../actions";
import { PlayWorldCardEffect } from "../actions/effects";
import { InvalidActionResolution } from "../actions/utils";
import type { Cost, CostContext } from "../costs";
import type { OathGame } from "../model/game";
import { hasCostContexts } from "../model/interfaces";
import { allChoices, allCombinations, isExtended } from "../utils";
import { ChooseModifiers, ModifiableAction, UsePowerAction } from "./actions";
import { powersIndex } from "./classIndex";
import { MultiCostContext } from "./context";


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
            const action = factory();
            const maskProxyManager = this.action.maskProxyManager;
            const { persistentModifiers, optionalModifiers } = ChooseModifiers.gatherActionModifiers(this.powerManager, action, this.action.player, this.action.maskProxyManager);
            for (const combination of allCombinations(optionalModifiers)) {
                try {
                    const action = factory();  // Get a blank state, then update the modifiers to use that new action
                    const completeCombination = new Set([...persistentModifiers, ...combination].map(e => { e.action = action; return e; }));
                    const modifiableAction = this.powerManager.getModifiable(action);
                    if (!modifiableAction.applyModifiers(completeCombination, true)) continue;
                    modifiableAction.start();
                    if (!hasCostContexts(action)) return true;

                    for (const choice of allChoices(Object.entries(action.selects).map(([k, v]) => [...v.allPossibleChoices].map(e => [k, e] as const)))) {
                        const parsed = modifiableAction.parse(Object.fromEntries(choice));
                        modifiableAction.applyParameters(parsed);

                        const costContextPerType = new Map<typeof CostContext<Cost>, CostContext<Cost>[]>();
                        for (const context of action.costContexts) {
                            const cls = context.constructor as typeof CostContext<Cost>;
                            if (!costContextPerType.has(cls)) costContextPerType.set(cls, []);
                            costContextPerType.get(cls)!.push(context);
                        }
                        
                        if ([...costContextPerType].every(
                            ([cls, contexts]) => new MultiCostContext(this.powerManager, this.player, contexts, cls.dummyFactory(this.player))
                                .payableCostsWithModifiers(maskProxyManager).length
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

export class ResolveWhenPlayed extends ActionModifier<OathGame, PlayWorldCardEffect> {
    modifiedAction = PlayWorldCardEffect;
    mustUse = true;

    applyAtEnd(): void {
        for (const power of this.action.card.powers) {
            const powerCls = powersIndex[power];
            if (isExtended(powerCls, WhenPlayed)) {
                new powerCls(this.powerManager, this.action.card as any, this.action.player, this.action).whenPlayed();
            }
        }
    }
}