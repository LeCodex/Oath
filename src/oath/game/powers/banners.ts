import { WakeAction, SearchPlayOrDiscardAction, MayDiscardACardAction, SearchAction, PeoplesFavorWakeAction } from "../actions";
import type { PeoplesFavor, DarkestSecret} from "../model/banks";
import { ActionModifier, SupplyCostModifier } from ".";
import { Owned } from "./base";
import { Denizen } from "../model/cards";
import { CardRestriction } from "../enums";
import type { SupplyCostContext } from "../costs";
import { ResourceCost } from "../costs";
import { getCapacityInformation } from "./utils";


export class PeoplesFavorSearch extends Owned(ActionModifier<PeoplesFavor, SearchPlayOrDiscardAction>) {
    modifiedAction = SearchPlayOrDiscardAction;
    mustUse = true; // Not strictly true, but it involves a choice either way, so it's better to always include it

    applyAtStart(): void {
        if (this.playerProxy.site.region && this.action.cardProxy instanceof Denizen && this.action.cardProxy.restriction !== CardRestriction.Adviser) {
            for (const siteProxy of this.playerProxy.site.region.sites) {
                const capacityInformation = getCapacityInformation(this.powerManager, this.action.maskProxyManager, siteProxy, this.action.playerProxy);
                if (!siteProxy.facedown && capacityInformation.capacity > capacityInformation.takesSpaceInTargetProxies.length) {
                    this.action.selects.choice.choices.set(siteProxy.name, siteProxy);
                }
            }
        }
    }

    applyBefore(): void {
        if (this.action.siteProxy) new MayDiscardACardAction(this.actionManager, this.player, this.action.discardOptions).doNext();
    }
}
export class PeoplesFavorWake extends Owned(ActionModifier<PeoplesFavor, WakeAction>) {
    modifiedAction = WakeAction;
    mustUse = true;

    applyBefore(): void {
        if (this.sourceProxy.owner?.original) {
            new PeoplesFavorWakeAction(this.actionManager, this.sourceProxy.owner?.original, this.source).doNext();
            if (this.source.isMob) new PeoplesFavorWakeAction(this.actionManager, this.sourceProxy.owner?.original, this.source).doNext();
        }
    }
}

export class DarkestSecretPower extends Owned(SupplyCostModifier<DarkestSecret>) {
    mustUse = true;

    canUse(context: SupplyCostContext): boolean {
        return super.canUse(context) && context.origin instanceof SearchAction;
    }

    apply(context: SupplyCostContext): void {
        context.cost.base = 2;
    }
}
