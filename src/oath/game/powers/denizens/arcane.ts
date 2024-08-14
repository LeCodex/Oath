import { CampaignAtttackAction, CampaignDefenseAction, TakeFavorFromBankAction, TradeAction, AskForRerollAction, TravelAction, InvalidActionResolution } from "../../actions/actions";
import { Denizen, Site } from "../../cards/cards";
import { RegionDiscardEffect, PutResourcesOnTargetEffect, RollDiceEffect } from "../../effects";
import { OathResource, OathSuit } from "../../enums";
import { ResourceCost } from "../../resources";
import { ActionModifier, AttackerBattlePlan, DefenderBattlePlan, ActivePower, WhenPlayed, AccessedActionModifier, EffectModifier } from "../powers";


export class GleamingArmorAttack extends ActionModifier<Denizen> {
    name = "Gleaming Armor";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;
    mustUse = true;

    canUse(): boolean {
        return this.action.campaignResult.defender === this.sourceProxy.ruler?.original;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        for (const modifier of modifiers)
            if (modifier instanceof AttackerBattlePlan)
                modifier.cost.add(new ResourceCost([[OathResource.Secret, 1]]));

        return [];
    }
}
export class GleamingArmorDefense extends ActionModifier<Denizen> {
    name = "Gleaming Armor";
    modifiedAction = CampaignDefenseAction;
    action: CampaignDefenseAction;
    mustUse = true;

    canUse(): boolean {
        return this.action.campaignResult.attacker === this.sourceProxy.ruler?.original;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        for (const modifier of modifiers)
            if (modifier instanceof DefenderBattlePlan)
                modifier.cost.add(new ResourceCost([[OathResource.Secret, 1]]));

        return [];
    }
}

export class SpiritSnare extends ActivePower<Denizen> {
    name = "Spirit Snare";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        new TakeFavorFromBankAction(this.action.player, 1).doNext();
    }
}

export class Dazzle extends WhenPlayed<Denizen> {
    name = "Dazzle";

    whenPlayed(): void {
        new RegionDiscardEffect(this.effect.player, [OathSuit.Hearth, OathSuit.Order], this.source).do();
    }
}

export class Tutor extends ActivePower<Denizen> {
    name = "Tutor";
    cost = new ResourceCost([[OathResource.Favor, 1], [OathResource.Secret, 1]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.action.game, this.action.player, OathResource.Secret, 1).do();
    }
}

export class Alchemist extends ActivePower<Denizen> {
    name = "Alchemist";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Secret, 1]]);

    usePower(): void {
        for (let i = 0; i < 4; i++) new TakeFavorFromBankAction(this.action.player, 1).doNext();
    }
}

export class ActingTroupe extends AccessedActionModifier<Denizen> {
    name = "Acting Troupe";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyBefore(): void {
        if (this.action.cardProxy.suit === OathSuit.Order || this.action.cardProxy.suit === OathSuit.Beast)
            this.sourceProxy.suit = this.action.cardProxy.suit;
    }
}

export class Jinx extends EffectModifier<Denizen> {
    name = "Jinx";
    modifiedEffect = RollDiceEffect;
    effect: RollDiceEffect;
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    canUse(): boolean {
        return !!this.effect.playerProxy && this.effect.playerProxy.rules(this.sourceProxy) && !(!this.sourceProxy.empty && this.gameProxy.currentPlayer === this.effect.playerProxy);
    }

    applyAfter(result: number[]): void {
        if (!this.effect.player) return;
        new AskForRerollAction(this.effect.player, result, this.effect.die, this).doNext();
    }
}

export class Portal extends AccessedActionModifier<Denizen> {
    name = "Portal";
    modifiedAction = TravelAction;
    action: TravelAction;
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        return [...modifiers].filter(e => e.source instanceof Site);
    }

    applyBefore(): void {
        if (this.action.playerProxy.site !== this.sourceProxy.site && this.action.siteProxy !== this.sourceProxy.site)
            throw new InvalidActionResolution("When using the Portal, you must travel to or from its site");

        this.action.noSupplyCost = true;
    }
}
