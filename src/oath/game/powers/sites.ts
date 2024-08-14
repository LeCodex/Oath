import { InvalidActionResolution, ChooseResourceToTakeAction, WakeAction, TravelAction, ModifiableAction, CampaignAtttackAction } from "../actions/actions";
import { Site, Denizen } from "../cards/cards";
import { PlayWorldCardEffect, TakeOwnableObjectEffect, PutResourcesOnTargetEffect, PutWarbandsFromBagEffect, TakeResourcesFromBankEffect } from "../effects";
import { OathSuit, OathResource } from "../enums";
import { isAtSite } from "../interfaces";
import { OathPlayer } from "../player";
import { AbstractConstructor } from "../utils";
import { EffectModifier, ActionModifier } from "./powers";


export abstract class HomelandSitePower extends EffectModifier<Site> {
    modifiedEffect = PlayWorldCardEffect;
    effect: PlayWorldCardEffect;
    abstract suit: OathSuit;

    applyAfter(result: void): void {
        // TODO: "and if you have not discarded a <suit> card here during this turn"
        if (this.effect.site === this.source && this.effect.card instanceof Denizen && this.effect.card.suit === this.suit)
            this.giveReward(this.effect.player);
    }

    abstract giveReward(player: OathPlayer): void;
}

export class Wastes extends HomelandSitePower {
    name = "Wastes";
    suit = OathSuit.Discord;

    giveReward(player: OathPlayer): void {
        // TODO: Should probably have an effect just for recovering
        for (const relicProxy of this.sourceProxy.relics)
            return new TakeOwnableObjectEffect(this.game, player, relicProxy.original).do();
    }
}

export class StandingStones extends HomelandSitePower {
    name = "Standing Stones";
    suit = OathSuit.Arcane;

    giveReward(player: OathPlayer): void {
        new PutResourcesOnTargetEffect(this.game, player, OathResource.Secret, 1).do();
    }
}

export class AncientCity extends HomelandSitePower {
    name = "Ancient City";
    suit = OathSuit.Order;

    giveReward(player: OathPlayer): void {
        new PutWarbandsFromBagEffect(player, 2).do();
    }
}

export class FertileValley extends HomelandSitePower {
    name = "Fertile Valley";
    suit = OathSuit.Hearth;

    giveReward(player: OathPlayer): void {
        new TakeResourcesFromBankEffect(this.game, player, this.game.favorBanks.get(this.suit), 1).do();
    }
}

export class Steppe extends HomelandSitePower {
    name = "Steppe";
    suit = OathSuit.Nomad;

    giveReward(player: OathPlayer): void {
        new PutResourcesOnTargetEffect(this.game, player, OathResource.Secret, 1).do();
    }
}

export class DeepWoods extends HomelandSitePower {
    name = "Deep Woods";
    suit = OathSuit.Beast;

    giveReward(player: OathPlayer): void {
        for (const relicProxy of this.sourceProxy.relics)
            return new TakeOwnableObjectEffect(player.game, player, relicProxy.original).do();
    }
}


export abstract class SiteActionModifier extends ActionModifier<Site> {
    canUse(): boolean {
        return this.action.playerProxy.site === this.sourceProxy;
    }
}

export class CoastalSite extends SiteActionModifier {
    name = "Coastal Site";
    modifiedAction = TravelAction;
    action: TravelAction;

    canUse(): boolean {
        for (const siteProxy of this.gameProxy.board.sites())
            if (!siteProxy.facedown && siteProxy !== this.sourceProxy)
                for (const power of siteProxy.powers)
                    if (power === CoastalSite)
                        return super.canUse();

        return false;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        // TODO: Ignore only the Narrow Pass and not the Hidden Place
        return [...modifiers].filter(e => e.source instanceof Site && e.source !== this.source);
    }

    applyBefore(): void {
        if (this.action.siteProxy.facedown) return;

        for (const power of this.action.siteProxy.powers) {
            if (power === CoastalSite) {
                this.action.supplyCost = 1;
                return;
            }
        }

        throw new InvalidActionResolution("When using a Coastal Site, you must travel to another Coastal Site");
    }
}

export class CharmingValley extends SiteActionModifier {
    name = "Charming Valley";
    modifiedAction = TravelAction;
    action: TravelAction;
    mustUse = true;

    applyBefore(): void {
        this.action.supplyCostModifier += 1;
    }
}

export class OpportunitySite extends SiteActionModifier {
    name = "Opportunity Site";
    modifiedAction = WakeAction;
    action: WakeAction;

    canUse(): boolean {
        return super.canUse() && this.source.totalResources > 0;
    }

    applyBefore(): void {
        if (!this.source.empty) new ChooseResourceToTakeAction(this.action.player, this.source).doNext();
    }
}

export class Plains extends SiteActionModifier {
    name = "Plains";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (target === this.source || isAtSite(target) && target.site === this.source) {
                this.action.campaignResult.atkPool++;
                return
            }
        }
    }
}

export class Mountain extends SiteActionModifier {
    name = "Mountain";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (target === this.source || isAtSite(target) && target.site === this.source) {
                this.action.campaignResult.atkPool--;
                return
            }
        }
    }
}