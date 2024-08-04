import { TravelAction, InvalidActionResolution, WakeAction, ChooseResourceToTakeAction } from "../actions";
import { Site, Denizen } from "../cards/cards";
import { PlayWorldCardEffect, TakeOwnableObjectEffect, PutResourcesOnTargetEffect, PutWarbandsFromBagEffect, TakeResourcesFromBankEffect } from "../effects";
import { OathSuit, OathResource } from "../enums";
import { OathPlayer } from "../player";
import { EffectModifier, ActionModifier } from "./powers";


export abstract class HomelandSitePower extends EffectModifier<Site> {
    modifiedEffect = PlayWorldCardEffect;
    effect: PlayWorldCardEffect;
    abstract suit: OathSuit;

    applyAfter(result: void): void {
        // TODO: "and if you have not discarded a <suit> card here during this turn"
        if (this.effect.site?.original === this.source.original && this.effect.card instanceof Denizen && this.effect.card.suit === this.suit)
            this.giveReward(this.effect.player);
    }

    abstract giveReward(player: OathPlayer): void;
}

export class Wastes extends HomelandSitePower {
    name = "Wastes";
    suit = OathSuit.Discord;

    giveReward(player: OathPlayer): void {
        // TODO: This doesn't reveal the card. Also should probably have an effect just for recovering
        for (const relic of this.source.relics) return new TakeOwnableObjectEffect(player.game, player, relic).do();
    }
}

export class StandingStones extends HomelandSitePower {
    name = "Standing Stones";
    suit = OathSuit.Arcane;

    giveReward(player: OathPlayer): void {
        new PutResourcesOnTargetEffect(player.game, player, OathResource.Secret, 1).do();
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
        new TakeResourcesFromBankEffect(player.game, player, player.game.favorBanks.get(this.suit), 1).do();
    }
}

export class Steppe extends HomelandSitePower {
    name = "Steppe";
    suit = OathSuit.Nomad;

    giveReward(player: OathPlayer): void {
        new PutResourcesOnTargetEffect(player.game, player, OathResource.Secret, 1).do();
    }
}

export class DeepWoods extends HomelandSitePower {
    name = "Deep Woods";
    suit = OathSuit.Beast;

    giveReward(player: OathPlayer): void {
        for (const relic of this.source.relics) return new TakeOwnableObjectEffect(player.game, player, relic).do();
    }
}


export abstract class SiteActionModifier extends ActionModifier<Site> {
    canUse(): boolean {
        return this.action.player.site === this.source;
    }
}

export class CoastalSite extends SiteActionModifier {
    name = "Coastal Site";
    modifiedAction = TravelAction;
    action: TravelAction;

    canUse(): boolean {
        for (const site of this.game.board.sites())
            if (!site.facedown && site.original !== this.source.original)
                for (const power of site.powers)
                    if (power === CoastalSite)
                        return super.canUse();

        return false;
    }

    applyImmediately(modifiers: ActionModifier<any>[]): Iterable<ActionModifier<any>> {
        // This ignores a bit more than the Narrow Pass, but it's simpler, and makes no difference
        return modifiers.filter(e => e.source instanceof Site && e.source.original !== this.source.original);
    }

    applyBefore(): void {
        if (this.action.site.facedown) return;

        for (const power of this.action.site.powers) {
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
