import { TradeAction, TakeResourceFromPlayerAction, TakeFavorFromBankAction, CampaignEndAction, ModifiableAction } from "../../actions/actions";
import { Denizen } from "../../cards/cards";
import { TakeWarbandsIntoBagEffect, TakeResourcesFromBankEffect, PlayVisionEffect, PlayWorldCardEffect, OathEffect, PeekAtCardEffect } from "../../effects";
import { OathResource, BannerName, OathSuit } from "../../enums";
import { ResourceCost } from "../../resources";
import { DefenderBattlePlan, AccessedActionModifier, ActivePower, WhenPlayed, EnemyEffectModifier, EnemyActionModifier, AccessedEffectModifier } from "../powers";


export class HeartsAndMinds extends DefenderBattlePlan<Denizen> {
    name = "Hearts and Minds";
    cost = new ResourceCost([[OathResource.Favor, 3]]);

    applyWhenApplied(): boolean {
        // TODO: Put this in an effect
        this.action.campaignResult.successful = false;
        this.action.next.doNext();

        if (this.action.gameProxy.banners.get(BannerName.PeoplesFavor)?.owner !== this.action.playerProxy)
            this.action.campaignResult.discardAtEnd(this.source);

        return false;
    }
}

export class AwaitedReturn extends AccessedActionModifier<Denizen> {
    name = "Awaited Return";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyBefore(): void {
        // NOTE: I am enforcing that you can only sacrifice warbands of your leader's color
        // while *technically* this restriction doesn't exist but making it an action seems overkill
        if (new TakeWarbandsIntoBagEffect(this.action.player, 1).do() > 0)
            this.action.noSupplyCost = true;
    }
}

export class CharmingFriend extends ActivePower<Denizen> {
    name = "Charming Friend";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        const players = Object.values(this.gameProxy.players).filter(e => e.site === this.action.playerProxy.site).map(e => e.original);
        new TakeResourceFromPlayerAction(this.action.player, OathResource.Favor, 1, players).doNext();
    }
}

export class FabledFeast extends WhenPlayed<Denizen> {
    name = "FabledFeast";

    whenPlayed(): void {
        new TakeResourcesFromBankEffect(this.game, this.effect.player, this.game.favorBanks.get(OathSuit.Hearth), this.effect.playerProxy.ruledSuitCount(OathSuit.Hearth)).do();
    }
}

export class BookBinders extends EnemyEffectModifier<Denizen> {
    name = "Book Binders";
    modifiedEffect = PlayVisionEffect;
    effect: PlayVisionEffect;

    applyAfter(result: void): void {
        if (!this.sourceProxy.ruler?.original) return;
        new TakeFavorFromBankAction(this.sourceProxy.ruler?.original, 2).doNext();
    }
}

export class SaddleMakers extends EnemyEffectModifier<Denizen> {
    name = "Saddle Makers";
    modifiedEffect = PlayWorldCardEffect;
    effect: PlayWorldCardEffect;

    applyAfter(result: void): void {
        if (!this.sourceProxy.ruler?.original) return;
        if (this.effect.facedown || !(this.effect.card instanceof Denizen)) return;

        const cardProxy = this.effect.maskProxyManager.get(this.effect.card);
        if (cardProxy.suit === OathSuit.Nomad || cardProxy.suit === OathSuit.Order)
            new TakeResourcesFromBankEffect(this.effect.game, this.sourceProxy.ruler?.original, this.effect.game.favorBanks.get(cardProxy.suit), 2).do();
    }
}

export class Herald extends EnemyActionModifier<Denizen> {
    name = "Herald";
    modifiedAction = CampaignEndAction;
    action: CampaignEndAction;
    mustUse = true;

    applyAfter(): void {
        if (!this.sourceProxy.ruler?.original) return;
        if (!this.action.campaignResult.defender) return;
        new TakeFavorFromBankAction(this.sourceProxy.ruler?.original, 1).doNext();
    }
}

export class MarriageActionModifier extends AccessedActionModifier<Denizen> {
    name = "Marriage";
    modifiedAction = ModifiableAction;
    action: ModifiableAction;
    mustUse = true;

    applyWhenApplied(): boolean {
        const originalFn = this.action.playerProxy.adviserSuitCount.bind(this.action.playerProxy);
        this.action.playerProxy.adviserSuitCount = (suit: OathSuit) => {
            return originalFn(suit) + (suit === OathSuit.Hearth ? 1 : 0);
        };
        return true;
    }
}
export class MarriageEffectModifier extends AccessedEffectModifier<Denizen> {
    name = "Marriage";
    modifiedEffect = OathEffect;
    effect: OathEffect<any>;
    mustUse = true;

    applyWhenApplied(): void {
        if (!this.effect.playerProxy) return;
        const originalFn = this.effect.playerProxy.adviserSuitCount.bind(this.effect.playerProxy);
        this.effect.playerProxy.adviserSuitCount = (suit: OathSuit) => {
            return originalFn(suit) + (suit === OathSuit.Hearth ? 1 : 0);
        };
    }
}

export class TavernSongs extends ActivePower<Denizen> {
    name = "Tavern Songs";

    usePower(): void {
        for (let i = 0; i < 3; i++) {
            const card = this.action.player.site.region.discard.cards[i];
            if (card) new PeekAtCardEffect(this.action.player, card).do();
        }
    }
}
