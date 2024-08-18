import { InvalidActionResolution, ChooseResourceToTakeAction, WakeAction, TravelAction, CampaignAttackAction, MusterAction, SearchAction, StartBindingExchangeAction, MakeBindingExchangeOfferAction, SearchPlayOrDiscardAction, MayDiscardACardAction } from "../actions/actions";
import { Site, Denizen } from "../cards/cards";
import { PlayWorldCardEffect, TakeOwnableObjectEffect, PutResourcesOnTargetEffect, PutWarbandsFromBagEffect, TakeResourcesFromBankEffect, FlipSecretsEffect } from "../effects";
import { OathSuit, OathResource } from "../enums";
import { isAtSite } from "../interfaces";
import { OathPlayer } from "../player";
import { EffectModifier, ActionModifier, ActivePower } from "./powers";


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
        new PutWarbandsFromBagEffect(player.leader, 2).do();
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
        return this.activatorProxy.site === this.sourceProxy;
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
        return [...modifiers].filter(e => e instanceof NarrowPass);
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

export class BuriedGiant extends SiteActionModifier {
    name = "Buried Giant";
    modifiedAction = TravelAction;
    action: TravelAction;

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        return [...modifiers].filter(e => e instanceof NarrowPass);
    }

    applyWhenApplied(): boolean {
        if (new FlipSecretsEffect(this.game, this.action.player, 1, true).do() < 1)
            throw new InvalidActionResolution("Cannot pay resource cost for Buried Giant");

        return true;
    }

    applyBefore(): void {
        this.action.noSupplyCost = true;
    }
}

export class ShroudedWood extends SiteActionModifier {
    name = "Shrouded Wood";
    modifiedAction = TravelAction;
    action: TravelAction;
    mustUse = true;

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        return [...modifiers].filter(e => e instanceof NarrowPass || e instanceof TheHiddenPlaceTravel);
    }

    applyWhenApplied(): boolean {
        if (this.sourceProxy.ruler) this.action.player = this.sourceProxy.ruler.original;
        return true;
    }

    applyBefore(): void {
        this.action.supplyCost = 2;
    }
}

export class NarrowPass extends ActionModifier<Site> {
    name = "Narrow Pass";
    modifiedAction = TravelAction;
    action: TravelAction;
    mustUse = true;

    applyBefore(): void {
        if (this.action.siteProxy !== this.sourceProxy && this.activatorProxy.site.region !== this.sourceProxy.region && this.action.siteProxy.region === this.sourceProxy.region)
            throw new InvalidActionResolution("Must go through the Narrow Pass");
    }
}

export class TheHiddenPlaceTravel extends ActionModifier<Site> {
    name = "The Hidden Place";
    modifiedAction = TravelAction;
    action: TravelAction;
    mustUse = true;

    applyBefore(): void {
        if (this.action.siteProxy !== this.sourceProxy) return;
        if (new FlipSecretsEffect(this.game, this.activator, 1, true).do() < 1)
            throw new InvalidActionResolution("Cannot pay resource cost for The Hidden Place");
    }
}

export class TheHiddenPlaceCampaign extends ActionModifier<Site> {
    name = "The Hidden Place";
    modifiedAction = CampaignAttackAction;
    action: CampaignAttackAction;
    mustUse = true;

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (target === this.source || isAtSite(target) && target.site === this.source) {
                if (new FlipSecretsEffect(this.game, this.activator, 1, true).do() < 1)
                    throw new InvalidActionResolution("Cannot pay resource cost for The Hidden Place");
                break;
            }
        }
    }
}

export class OpportunitySite extends SiteActionModifier {
    name = "Opportunity Site";
    modifiedAction = WakeAction;
    action: WakeAction;

    canUse(): boolean {
        return super.canUse() && !this.source.empty;
    }

    applyBefore(): void {
        if (!this.source.empty) new ChooseResourceToTakeAction(this.activator, this.source).doNext();
    }
}

export class Plains extends SiteActionModifier {
    name = "Plains";
    modifiedAction = CampaignAttackAction;
    action: CampaignAttackAction;
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

export class Mountain extends SiteActionModifier {
    name = "Mountain";
    modifiedAction = CampaignAttackAction;
    action: CampaignAttackAction;
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

export class River extends SiteActionModifier {
    name = "River";
    modifiedAction = MusterAction;
    action: MusterAction;
    mustUse = true;

    applyBefore(): void {
        if (this.activatorProxy === this.sourceProxy.ruler) this.action.amount++;
    }
}

export class Marshes extends SiteActionModifier {
    name = "Marshes";
    modifiedAction = SearchAction;
    action: SearchAction;
    mustUse = true;

    applyBefore(): void {
        this.action.amount--;
    }
}

export class GreatSlum extends SiteActionModifier {
    name = "Great Slum";
    modifiedAction = SearchPlayOrDiscardAction;
    action: SearchPlayOrDiscardAction;
    mustUse = true;

    applyBefore(): void {
        if (this.action.siteProxy === this.sourceProxy)
            new MayDiscardACardAction(this.activator, this.action.discardOptions, this.source.denizens).doNext();
    }
}

export class TheTribunal extends ActivePower<Site> {
    name = "The Tribunal";

    usePower(): void {
        // Can't enforce future actions, so just do a basic binding exchange
        new StartBindingExchangeAction(this.action.player, MakeBindingExchangeOfferAction).doNext();
    }
}
