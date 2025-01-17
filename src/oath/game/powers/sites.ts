import { ChooseResourceToTakeAction, WakeAction, TravelAction, CampaignAttackAction, MusterAction, SearchAction, StartBindingExchangeAction, MakeBindingExchangeOfferAction, SearchPlayOrDiscardAction, MayDiscardACardAction } from "../actions";
import { ModifiableAction } from "../actions/base";
import { InvalidActionResolution } from "../actions/utils";
import { Site, Denizen } from "../model/cards";
import { PlayWorldCardEffect, PutResourcesOnTargetEffect, FlipSecretsEffect, ParentToTargetEffect, RecoverTargetEffect } from "../actions/effects";
import { OathSuit } from "../enums";
import { isAtSite, WithPowers } from "../model/interfaces";
import { OathPlayer } from "../model/player";
import { Secret } from "../model/resources";
import { ActionCostModifier, ActionModifier, ActivePower, AtSite, NoSupplyCostActionModifier, SupplyCostModifier } from ".";
import { SupplyCostContext } from "../costs";


export abstract class HomelandSitePower extends ActionModifier<Site, PlayWorldCardEffect> {
    modifiedAction = PlayWorldCardEffect;
    abstract suit: OathSuit;
    mustUse = true;

    applyAfter(): void {
        // TODO: "and if you have not discarded a <suit> card here during this turn"
        if (this.action.site === this.source && this.action.card instanceof Denizen && this.action.card.suit === this.suit)
            this.giveReward(this.action.executorProxy);
    }

    abstract giveReward(player: OathPlayer): void;
}

export class Wastes extends HomelandSitePower {
    suit = OathSuit.Discord;

    giveReward(playerProxy: OathPlayer): void {
        const relic = this.sourceProxy.relics[0]?.original;
        if (relic) return new RecoverTargetEffect(playerProxy.original, relic).doNext();
    }
}

export class StandingStones extends HomelandSitePower {
    suit = OathSuit.Arcane;

    giveReward(playerProxy: OathPlayer): void {
        new PutResourcesOnTargetEffect(this.game, playerProxy.original, Secret, 1).doNext();
    }
}

export class AncientCity extends HomelandSitePower {
    suit = OathSuit.Order;

    giveReward(playerProxy: OathPlayer): void {
        new ParentToTargetEffect(this.game, playerProxy.original, playerProxy.leader.bag.original.get(2)).doNext();
    }
}

export class FertileValley extends HomelandSitePower {
    suit = OathSuit.Hearth;

    giveReward(playerProxy: OathPlayer): void {
        const bank = this.game.favorBank(this.suit);
        if (bank) new ParentToTargetEffect(this.game, playerProxy.original, bank?.get(1)).doNext();
    }
}

export class Steppe extends HomelandSitePower {
    suit = OathSuit.Nomad;

    giveReward(playerProxy: OathPlayer): void {
        new PutResourcesOnTargetEffect(this.game, playerProxy.original, Secret, 1).doNext();
    }
}

export class DeepWoods extends HomelandSitePower {
    suit = OathSuit.Beast;

    giveReward(playerProxy: OathPlayer): void {
        const relic = this.sourceProxy.relics[0]?.original;
        if (relic) return new RecoverTargetEffect(playerProxy.original, relic).doNext();
    }
}


@AtSite
export class CoastalSite extends ActionModifier<Site, TravelAction> {
    modifiedAction = TravelAction;

    canUse(): boolean {
        for (const siteProxy of this.gameProxy.map.sites())
            if (!siteProxy.facedown && siteProxy !== this.sourceProxy)
                for (const power of siteProxy.powers)
                    if (power === CoastalSite)
                        return super.canUse();

        return false;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TravelAction>>): Iterable<ActionModifier<WithPowers, TravelAction>> {
        return [...modifiers].filter(e => e instanceof NarrowPass);
    }

    applyAtStart(): void {
        this.action.selects.siteProxy.filterChoices(e => !e.facedown && e.powers.has(CoastalSite));
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
        new FlipSecretsEffect(this.game, this.player, 1, true).doNext(amount => {
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
            this.action.selects.siteProxy.filterChoices(e => e.original.powers.has(NarrowPass) || e.region !== this.sourceProxy.region);
    }
}

export class TheHiddenPlaceTravel extends ActionModifier<Site, TravelAction> {
    modifiedAction = TravelAction;
    mustUse = true;

    applyBefore(): void {
        if (this.action.siteProxy !== this.sourceProxy) return;
        new FlipSecretsEffect(this.game, this.action.player, 1, true).doNext(amount => {
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
                new FlipSecretsEffect(this.game, this.action.player, 1, true).doNext(amount => {
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
        if (!this.source.empty) new ChooseResourceToTakeAction(this.player, this.source).doNext();
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
            new MayDiscardACardAction(this.player, this.action.discardOptions, this.source.denizens).doNext();
    }
}

export class TheTribunal extends ActivePower<Site> {
    canUse(): boolean {
        return super.canUse() && (this.playerProxy.site === this.sourceProxy || this.sourceProxy.ruler === this.playerProxy.leader);
    }

    usePower(): void {
        // Can't enforce future actions, so just do a basic binding exchange
        new StartBindingExchangeAction(this.action.player, MakeBindingExchangeOfferAction).doNext();
    }
}
