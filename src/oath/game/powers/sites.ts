import { ChooseResourceToTakeAction, WakeAction, TravelAction, CampaignAttackAction, MusterAction, SearchAction, StartBindingExchangeAction, MakeBindingExchangeOfferAction, SearchPlayOrDiscardAction, MayDiscardACardAction, CampaignSeizeSiteAction } from "../actions";
import { InvalidActionResolution } from "../actions/utils";
import { Site } from "../model/cards";
import { PutResourcesOnTargetEffect, FlipSecretsEffect, ParentToTargetEffect, RecoverTargetEffect, MoveOwnWarbandsEffect } from "../actions/effects";
import { OathSuit } from "../enums";
import { isAtSite, WithPowers } from "../model/interfaces";
import { OathPlayer } from "../model/player";
import { Secret } from "../model/resources";
import { ActionCostModifier, ActionModifier, ActivePower, NoSupplyCostActionModifier, SeizeModifier, SupplyCostModifier } from ".";
import { SupplyCostContext } from "./context";
import { AtSite, HomelandSitePower, HomelandSiteLosePower, GainPowersModifier } from "./base";


export class SiteSeize extends SeizeModifier<Site> {
    applyAfter(): void {
        if (this.source.ruler) new MoveOwnWarbandsEffect(this.actionManager, this.source.ruler.leader, this.source, this.source.ruler).doNext();
        new CampaignSeizeSiteAction(this.actionManager, this.action.player, this.source).doNext();
    }
}

export class Wastes extends HomelandSitePower(OathSuit.Discord) {
    giveReward(playerProxy: OathPlayer): void {
        const relic = this.sourceProxy.relics[0]?.original;
        if (relic) return new RecoverTargetEffect(this.actionManager, playerProxy.original, relic).doNext();
    }
}
export class WastesOff extends HomelandSiteLosePower(Wastes) {}
export class WastesOn extends GainPowersModifier(WakeAction, Wastes) {}

export class StandingStones extends HomelandSitePower(OathSuit.Arcane) {
    giveReward(playerProxy: OathPlayer): void {
        new PutResourcesOnTargetEffect(this.actionManager, playerProxy.original, Secret, 1).doNext();
    }
}
export class StandingStonesOff extends HomelandSiteLosePower(StandingStones) {}
export class StandingStonesOn extends GainPowersModifier(WakeAction, StandingStones) {}

export class AncientCity extends HomelandSitePower(OathSuit.Order) {
    giveReward(playerProxy: OathPlayer): void {
        new ParentToTargetEffect(this.actionManager, playerProxy.original, playerProxy.leader.bag.original.get(2)).doNext();
    }
}
export class AncientCityOff extends HomelandSiteLosePower(AncientCity) {}
export class AncientCityOn extends GainPowersModifier(WakeAction, AncientCity) {}

export class FertileValley extends HomelandSitePower(OathSuit.Hearth) {
    giveReward(playerProxy: OathPlayer): void {
        const bank = this.game.favorBank(OathSuit.Hearth);
        if (bank) new ParentToTargetEffect(this.actionManager, playerProxy.original, bank?.get(1)).doNext();
    }
}
export class FertileValleyOff extends HomelandSiteLosePower(FertileValley) {}
export class FertileValleyOn extends GainPowersModifier(WakeAction, FertileValley) {}

export class Steppe extends HomelandSitePower(OathSuit.Nomad) {
    giveReward(playerProxy: OathPlayer): void {
        new PutResourcesOnTargetEffect(this.actionManager, playerProxy.original, Secret, 1).doNext();
    }
}
export class SteppeOff extends HomelandSiteLosePower(Steppe) {}
export class SteppeOn extends GainPowersModifier(WakeAction, Steppe) {}

export class DeepWoods extends HomelandSitePower(OathSuit.Beast) {
    giveReward(playerProxy: OathPlayer): void {
        const relic = this.sourceProxy.relics[0]?.original;
        if (relic) return new RecoverTargetEffect(this.actionManager, playerProxy.original, relic).doNext();
    }
}
export class DeepWoodsOff extends HomelandSiteLosePower(DeepWoods) {}
export class DeepWoodsOn extends GainPowersModifier(WakeAction, DeepWoods) {}


@AtSite
export class CoastalSite extends ActionModifier<Site, TravelAction> {
    modifiedAction = TravelAction;

    canUse(): boolean {
        for (const siteProxy of this.gameProxy.map.sites())
            if (!siteProxy.facedown && siteProxy !== this.sourceProxy)
                if (siteProxy.powers.has("CoastalSite"))
                    return super.canUse();

        return false;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TravelAction>>): Iterable<ActionModifier<WithPowers, TravelAction>> {
        return [...modifiers].filter(e => e instanceof NarrowPass);
    }

    applyAtStart(): void {
        this.action.selects.siteProxy.filterChoices(e => !e.facedown && e.powers.has("CoastalSite"));
    }
}
export class CoastalSiteCost extends ActionCostModifier(CoastalSite, SupplyCostContext) {
    apply(context: SupplyCostContext): void {
        context.cost.base = 1;
    }
}

@AtSite
export class CharmingValley extends SupplyCostModifier<Site> {
    mustUse = true;

    canUse(context: SupplyCostContext): boolean {
        return context.origin instanceof TravelAction;
    }

    apply(context: SupplyCostContext): void {
        context.cost.modifier += 1;
    }
}

@AtSite
export class BuriedGiant extends ActionModifier<Site, TravelAction> {
    modifiedAction = TravelAction;

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TravelAction>>): Iterable<ActionModifier<WithPowers, TravelAction>> {
        return [...modifiers].filter(e => e instanceof NarrowPass);
    }

    applyBefore(): void {
        new FlipSecretsEffect(this.actionManager, this.player, 1, true).doNext(amount => {
            if (amount < 1) throw new InvalidActionResolution("Cannot flip a secret for Buried Giant");
        });
    }
}
export class BuriedGiantCost extends NoSupplyCostActionModifier(BuriedGiant) { }

@AtSite
export class ShroudedWood extends ActionModifier<Site, TravelAction> {
    modifiedAction = TravelAction;
    mustUse = true;

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TravelAction>>): Iterable<ActionModifier<WithPowers, TravelAction>> {
        return [...modifiers].filter(e => e instanceof NarrowPass || e instanceof TheHiddenPlaceTravel);
    }

    applyWhenApplied(): boolean {
        if (this.sourceProxy.ruler) this.action.player = this.sourceProxy.ruler.original;
        return true;
    }
}
export class ShroudedWoodCost extends ActionCostModifier(ShroudedWood, SupplyCostContext) {
    apply(context: SupplyCostContext): void {
        context.cost.base = 2;
    }
}

export class NarrowPass extends ActionModifier<Site, TravelAction> {
    modifiedAction = TravelAction;
    mustUse = true;

    applyAtStart(): void {
        if (this.playerProxy.site.region !== this.sourceProxy.region)
            this.action.selects.siteProxy.filterChoices(e => e.original.powers.has("NarrowPass") || e.region !== this.sourceProxy.region);
    }
}

export class TheHiddenPlaceTravel extends ActionModifier<Site, TravelAction> {
    modifiedAction = TravelAction;
    mustUse = true;

    applyBefore(): void {
        if (this.action.siteProxy !== this.sourceProxy) return;
        new FlipSecretsEffect(this.actionManager, this.action.player, 1, true).doNext(amount => {
            if (amount < 1) throw new InvalidActionResolution("Cannot flip a secret for The Hidden Place");
        });
    }
}
export class TheHiddenPlaceCampaign extends ActionModifier<Site, CampaignAttackAction> {
    modifiedAction = CampaignAttackAction;
    mustUse = true;

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (target === this.source || isAtSite(target) && target.site === this.source) {
                new FlipSecretsEffect(this.actionManager, this.action.player, 1, true).doNext(amount => {
                    if (amount < 1) throw new InvalidActionResolution("Cannot flip a secret for The Hidden Place");
                });
                break;
            }
        }
    }
}

@AtSite
export class OpportunitySite extends ActionModifier<Site, WakeAction> {
    modifiedAction = WakeAction;

    canUse(): boolean {
        return super.canUse() && !this.source.empty;
    }

    applyBefore(): void {
        if (!this.source.empty) new ChooseResourceToTakeAction(this.actionManager, this.player, this.source).doNext();
    }
}

@AtSite
export class Plains extends ActionModifier<Site, CampaignAttackAction> {
    modifiedAction = CampaignAttackAction;
    mustUse = true;

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (target === this.source || isAtSite(target) && target.site === this.source) {
                this.action.campaignResult.atkPool++;
                return
            }
        }
    }
}

@AtSite
export class Mountain extends ActionModifier<Site, CampaignAttackAction> {
    modifiedAction = CampaignAttackAction;
    mustUse = true;

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (target === this.source || isAtSite(target) && target.site === this.source) {
                this.action.campaignResult.atkPool--;
                return
            }
        }
    }
}

@AtSite
export class River extends ActionModifier<Site, MusterAction> {
    modifiedAction = MusterAction;
    mustUse = true;

    applyBefore(): void {
        if (this.playerProxy === this.sourceProxy.ruler) this.action.getting++;
    }
}

@AtSite
export class Marshes extends ActionModifier<Site, SearchAction> {
    modifiedAction = SearchAction;
    mustUse = true;

    applyBefore(): void {
        this.action.amount--;
    }
}

@AtSite
export class GreatSlum extends ActionModifier<Site, SearchPlayOrDiscardAction> {
    modifiedAction = SearchPlayOrDiscardAction;
    mustUse = true;

    applyBefore(): void {
        if (this.action.siteProxy === this.sourceProxy)
            new MayDiscardACardAction(this.actionManager, this.player, this.action.discardOptions, this.source.denizens).doNext();
    }
}

export class TheTribunal extends ActivePower<Site> {
    canUse(): boolean {
        return super.canUse() && (this.playerProxy.site === this.sourceProxy || this.sourceProxy.ruler === this.playerProxy.leader);
    }

    usePower(): void {
        // Can't enforce future actions, so just do a basic binding exchange
        new StartBindingExchangeAction(this.actionManager, this.action.player, MakeBindingExchangeOfferAction).doNext();
    }
}
