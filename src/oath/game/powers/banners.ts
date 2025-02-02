import { WakeAction, SearchPlayOrDiscardAction, MayDiscardACardAction, SearchAction, PeoplesFavorWakeAction, RecoverBannerPitchAction, ChooseSuitsAction } from "../actions";
import type { PeoplesFavor, DarkestSecret, Banner} from "../model/banks";
import { FavorBank } from "../model/banks";
import { ActionModifier, SupplyCostModifier , SeizeModifier, RecoverModifier } from ".";
import { Owned } from "./base";
import { Denizen } from "../model/cards";
import { CardRestriction, OathSuit } from "../enums";
import { SetPeoplesFavorMobState, TakeOwnableObjectEffect, TransferResourcesEffect } from "../actions/effects";
import type { SupplyCostContext } from "../costs";
import { ResourceCost } from "../costs";
import type { OathResourceType} from "../model/resources";
import { Secret } from "../model/resources";


export class BannerSeize extends SeizeModifier<Banner> {
    applyAfter() {
        new TakeOwnableObjectEffect(this.actionManager, this.action.player, this.source).doNext();
        new TransferResourcesEffect(this.actionManager, this.action.player, new ResourceCost([], [[this.source.cls as OathResourceType, 2]]), undefined, this.source).doNext();
    }
}
abstract class BannerRecover<T extends Banner> extends RecoverModifier<T> {
    modify(): void {
        new RecoverBannerPitchAction(this.actionManager, this.action.player, this.source).doNext();
    }
}

export class PeoplesFavorSearch extends Owned(ActionModifier<PeoplesFavor, SearchPlayOrDiscardAction>) {
    modifiedAction = SearchPlayOrDiscardAction;
    mustUse = true; // Not strictly true, but it involves a choice either way, so it's better to always include it

    applyAtStart(): void {
        if (this.playerProxy.site.region && this.action.cardProxy instanceof Denizen && this.action.cardProxy.restriction !== CardRestriction.Adviser)
            for (const siteProxy of this.playerProxy.site.region.sites)
                if (!siteProxy.facedown)
                    this.action.selects.choice.choices.set(siteProxy.name, siteProxy);
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
export class PeoplesFavorRecover extends BannerRecover<PeoplesFavor> {
    modify(): void {
        super.modify();

        let amount = this.source.amount;
        new SetPeoplesFavorMobState(this.actionManager, this.action.player, false).doNext();
        new ChooseSuitsAction(
            this.actionManager, this.action.player, "Choose where to start returning the favor (" + amount + ")",
            (suits: OathSuit[]) => {
                let suit = suits[0];
                if (suit === undefined) return;

                while (amount > 0) {
                    const bank = this.game.byClass(FavorBank).byKey(suit)[0];
                    if (bank) {
                        new TransferResourcesEffect(this.actionManager, this.action.player, new ResourceCost([[bank.cls, 1]]), bank, this.source).doNext();
                        amount--;
                    }
                    if (++suit > OathSuit.Nomad) suit = OathSuit.Discord;
                }
            }
        ).doNext();
    }
}

export class DarkestSecretPower extends Owned(SupplyCostModifier<DarkestSecret>) {
    mustUse = true;

    canUse(context: SupplyCostContext): boolean {
        return context instanceof SearchAction;
    }

    apply(context: SupplyCostContext): void {
        context.cost.base = 2;
    }
}
export class DarkestSecretRecover extends BannerRecover<DarkestSecret> {
    modify(): void {
        super.modify();
        
        const amount = this.source.amount;
        new TransferResourcesEffect(this.actionManager, this.action.player, new ResourceCost([[Secret, 1]]), this.action.player, this.source).doNext();
        if (this.source.owner)
            new TransferResourcesEffect(this.actionManager, this.source.owner, new ResourceCost([[Secret, amount - 1]]), this.source).doNext();
    }
}
