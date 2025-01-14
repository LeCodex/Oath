import { WakeAction, SearchPlayOrDiscardAction, MayDiscardACardAction, SearchAction, PeoplesFavorWakeAction } from "../actions";
import { type PeoplesFavor, type DarkestSecret } from "../banks";
import { type SupplyCostContext } from "../costs";
import { SupplyCostModifier, ActionModifier, PowerWithProxy } from ".";
import { Denizen } from "../cards";
import { CardRestriction } from "../enums";
import { AbstractConstructor } from "../utils";
import { OwnableObject, WithPowers } from "../interfaces";


export function Owned<T extends AbstractConstructor<PowerWithProxy<OwnableObject & WithPowers> & { canUse(...args: any[]): boolean }>>(Base: T) {
    abstract class OwnedModifier extends Base {
        canUse(...args: any[]): boolean {
            return super.canUse(...args) && this.playerProxy === this.sourceProxy.owner;
        }
    }
    return OwnedModifier;
}

@Owned
export class PeoplesFavorSearch extends ActionModifier<PeoplesFavor, SearchPlayOrDiscardAction> {
    modifiedAction = SearchPlayOrDiscardAction;
    mustUse = true; // Not strictly true, but it involves a choice either way, so it's better to always include it

    applyAtStart(): void {
        if (this.playerProxy.site.region && this.action.cardProxy instanceof Denizen && this.action.cardProxy.restriction !== CardRestriction.Adviser)
            for (const siteProxy of this.playerProxy.site.region.sites)
                if (!siteProxy.facedown)
                    this.action.selects.choice.choices.set(siteProxy.name, siteProxy);
    }

    applyBefore(): void {
        if (this.action.siteProxy) new MayDiscardACardAction(this.player, this.action.discardOptions).doNext();
    }
}
@Owned
export class PeoplesFavorWake extends ActionModifier<PeoplesFavor, WakeAction> {
    modifiedAction = WakeAction;
    mustUse = true;

    applyBefore(): void {
        if (this.sourceProxy.owner?.original) {
            new PeoplesFavorWakeAction(this.sourceProxy.owner?.original, this.source).doNext();
            if (this.source.isMob) new PeoplesFavorWakeAction(this.sourceProxy.owner?.original, this.source).doNext();
        }
    }
}

@Owned
export class DarkestSecretPower extends SupplyCostModifier<DarkestSecret> {
    mustUse = true;

    canUse(context: SupplyCostContext): boolean {
        return context instanceof SearchAction;
    }

    apply(context: SupplyCostContext): void {
        context.cost.base = 2;
    }
}
