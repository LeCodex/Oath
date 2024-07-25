import { SearchPlayAction, PeoplesFavorDiscardAction, WakeAction, PeoplesFavorWakeAction, SearchAction } from "../actions";
import { Banner, PeoplesFavor, DarkestSecret } from "../resources";
import { ActionModifier } from "./powers";


export abstract class BannerActionModifier<T extends Banner> extends ActionModifier<T> {
    canUse(): boolean {
        return super.canUse() && this.action.player === this.source.owner;
    }
}

export class PeoplesFavorSearch extends BannerActionModifier<PeoplesFavor> {
    name = "People's Favor";
    modifiedAction = SearchPlayAction;
    action: SearchPlayAction;
    mustUse = true; // Not strictly true, but it involves a choice either way, so it's better to always include it

    applyAtStart(): void {
        for (const site of this.action.player.site.region.sites) {
            this.action.selects.site.choices.set(site.name, site);
        }
    }

    applyDuring(): void {
        if (this.action.site) new PeoplesFavorDiscardAction(this.action.player, this.action.discardOptions).doNext();
    }
}
export class PeoplesFavorWake extends BannerActionModifier<PeoplesFavor> {
    name = "People's Favor";
    modifiedAction = WakeAction;
    action: WakeAction;
    mustUse = true;

    applyBefore(): boolean {
        if (this.source.owner) {
            new PeoplesFavorWakeAction(this.source.owner, this.source).doNext();
            if (this.source.isMob) new PeoplesFavorWakeAction(this.source.owner, this.source).doNext();
        }

        return true;
    }
}


export class DarkestSecretPower extends BannerActionModifier<DarkestSecret> {
    name = "Darkest Secret";
    modifiedAction = SearchAction;
    action: SearchAction;
    mustUse = true;

    applyDuring(): void {
        this.action.supplyCost = 2;
    }
}
