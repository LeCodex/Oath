import { ChooseResourceToTakeAction, WakeAction, TravelAction, CampaignAttackAction, MusterAction, SearchAction, StartBindingExchangeAction, MakeBindingExchangeOfferAction, SearchPlayOrDiscardAction, MayDiscardACardAction } from "../actions";
import { InvalidActionResolution, ModifiableAction } from "../actions/base";
import { Site, Denizen } from "../cards";
import { PlayWorldCardEffect, PutResourcesOnTargetEffect, FlipSecretsEffect, ParentToTargetEffect, RecoverTargetEffect } from "../actions/effects";
import { OathSuit } from "../enums";
import { isAtSite, WithPowers } from "../interfaces";
import { OathPlayer } from "../player";
import { Secret } from "../resources";
import { ActionModifier, ActivePower } from ".";


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


export abstract class AtSiteActionModifier<T extends ModifiableAction> extends ActionModifier<Site, T> {
    canUse(): boolean {
        return this.playerProxy.site === this.sourceProxy;
    }
}

export class CoastalSite extends AtSiteActionModifier<TravelAction> {
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
        this.action.selects.siteProxy.filterChoices(e => e.facedown || e.powers.has(CoastalSite));
    }

    applyBefore(): void {
        if (this.action.siteProxy.facedown) return;
        this.action.supplyCost = 1;
    }
}

export class CharmingValley extends AtSiteActionModifier<TravelAction> {
    modifiedAction = TravelAction;
    mustUse = true;

    applyBefore(): void {
        this.action.supplyCostModifier += 1;
    }
}

export class BuriedGiant extends AtSiteActionModifier<TravelAction> {
    modifiedAction = TravelAction;

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TravelAction>>): Iterable<ActionModifier<WithPowers, TravelAction>> {
        return [...modifiers].filter(e => e instanceof NarrowPass);
    }

    applyWhenApplied(): boolean {
        new FlipSecretsEffect(this.game, this.action.player, 1, true).doNext(amount => {
            if (amount < 1) throw new InvalidActionResolution("Cannot flip a secret for Buried Giant");
            this.action.noSupplyCost = true;
        });
        return true;
    }
}

export class ShroudedWood extends AtSiteActionModifier<TravelAction> {
    modifiedAction = TravelAction;
    mustUse = true;

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TravelAction>>): Iterable<ActionModifier<WithPowers, TravelAction>> {
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

export class OpportunitySite extends AtSiteActionModifier<WakeAction> {
    modifiedAction = WakeAction;

    canUse(): boolean {
        return super.canUse() && !this.source.empty;
    }

    applyBefore(): void {
        if (!this.source.empty) new ChooseResourceToTakeAction(this.player, this.source).doNext();
    }
}

export class Plains extends AtSiteActionModifier<CampaignAttackAction> {
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

export class Mountain extends AtSiteActionModifier<CampaignAttackAction> {
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

export class River extends AtSiteActionModifier<MusterAction> {
    modifiedAction = MusterAction;
    mustUse = true;

    applyBefore(): void {
        if (this.playerProxy === this.sourceProxy.ruler) this.action.getting++;
    }
}

export class Marshes extends AtSiteActionModifier<SearchAction> {
    modifiedAction = SearchAction;
    mustUse = true;

    applyBefore(): void {
        this.action.amount--;
    }
}

export class GreatSlum extends AtSiteActionModifier<SearchPlayOrDiscardAction> {
    modifiedAction = SearchPlayOrDiscardAction;
    mustUse = true;

    applyBefore(): void {
        if (this.action.siteProxy === this.sourceProxy)
            new MayDiscardACardAction(this.player, this.action.discardOptions, this.source.denizens).doNext();
    }
}

export class TheTribunal extends ActivePower<Site> {
    usePower(): void {
        // Can't enforce future actions, so just do a basic binding exchange
        new StartBindingExchangeAction(this.action.player, MakeBindingExchangeOfferAction).doNext();
    }
}
