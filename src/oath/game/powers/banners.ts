import { WakeAction, SearchPlayOrDiscardAction, MayDiscardACardAction, SearchAction, PeoplesFavorWakeAction, ModifiableAction } from "../actions/actions";
import { Banner, PeoplesFavor, DarkestSecret } from "../banks";
import { ActionModifier } from "./powers";


export abstract class BannerActionModifier<T extends Banner, U extends ModifiableAction> extends ActionModifier<T, U> {
    canUse(): boolean {
        return super.canUse() && this.activatorProxy === this.sourceProxy.owner;
    }
}

export class PeoplesFavorSearch extends BannerActionModifier<PeoplesFavor, SearchPlayOrDiscardAction> {
    name = "People's Favor";
    modifiedAction = SearchPlayOrDiscardAction;
    mustUse = true; // Not strictly true, but it involves a choice either way, so it's better to always include it

    applyAtStart(): void {
        if (this.activatorProxy.site.region)
            for (const siteProxy of this.activatorProxy.site.region.sites)
                if (!siteProxy.facedown)
                    this.action.selects.choice.choices.set(siteProxy.name, siteProxy);
    }

    applyBefore(): void {
        if (this.action.siteProxy) new MayDiscardACardAction(this.activator, this.action.discardOptions).doNext();
    }
}

export class PeoplesFavorWake extends BannerActionModifier<PeoplesFavor, WakeAction> {
    name = "People's Favor";
    modifiedAction = WakeAction;
    mustUse = true;

    applyBefore(): void {
        if (this.sourceProxy.owner?.original) {
            new PeoplesFavorWakeAction(this.sourceProxy.owner?.original, this.source).doNext();
            if (this.source.isMob) new PeoplesFavorWakeAction(this.sourceProxy.owner?.original, this.source).doNext();
        }
    }
}


export class DarkestSecretPower extends BannerActionModifier<DarkestSecret, SearchAction> {
    name = "Darkest Secret";
    modifiedAction = SearchAction;
    mustUse = true;

    applyBefore(): void {
        this.action.supplyCost = 2;
    }
}
