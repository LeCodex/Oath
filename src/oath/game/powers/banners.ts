import { PeoplesFavorWakeAction, WakeAction, SearchPlayAction, PeoplesFavorDiscardAction, SearchAction } from "../actions/actions";
import { Banner, PeoplesFavor, DarkestSecret } from "../banks";
import { ActionModifier } from "./powers";


export abstract class BannerActionModifier<T extends Banner> extends ActionModifier<T> {
    canUse(): boolean {
        return super.canUse() && this.action.playerProxy === this.sourceProxy.owner;
    }
}

export class PeoplesFavorSearch extends BannerActionModifier<PeoplesFavor> {
    name = "People's Favor";
    modifiedAction = SearchPlayAction;
    action: SearchPlayAction;
    mustUse = true; // Not strictly true, but it involves a choice either way, so it's better to always include it

    applyAtStart(): void {
        for (const siteProxy of this.action.playerProxy.site.region.sites)
            if (!siteProxy.facedown)
                this.action.selects.site.choices.set(siteProxy.id, siteProxy);
    }

    applyBefore(): void {
        if (this.action.siteProxy) new PeoplesFavorDiscardAction(this.action.player, this.action.discardOptions).doNext();
    }
}

export class PeoplesFavorWake extends BannerActionModifier<PeoplesFavor> {
    name = "People's Favor";
    modifiedAction = WakeAction;
    action: WakeAction;
    mustUse = true;

    applyBefore(): void {
        if (this.sourceProxy.owner?.original) {
            new PeoplesFavorWakeAction(this.sourceProxy.owner?.original, this.source).doNext();
            if (this.source.isMob) new PeoplesFavorWakeAction(this.sourceProxy.owner?.original, this.source).doNext();
        }
    }
}


export class DarkestSecretPower extends BannerActionModifier<DarkestSecret> {
    name = "Darkest Secret";
    modifiedAction = SearchAction;
    action: SearchAction;
    mustUse = true;

    applyBefore(): void {
        this.action.supplyCost = 2;
    }
}
