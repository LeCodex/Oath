import { TradeAction, InvalidActionResolution, TravelAction, SearchAction, SearchPlayAction, TakeFavorFromBankAction } from "../../actions/actions";
import { Denizen, Vision } from "../../cards/cards";
import { PayCostToTargetEffect, MoveResourcesToTargetEffect } from "../../effects";
import { OathResource } from "../../enums";
import { ResourceCost } from "../../resources";
import { AttackerBattlePlan, DefenderBattlePlan, EnemyActionModifier, WhenPlayed, AccessedActionModifier, RestPower } from "../powers";


export class LongbowsAttack extends AttackerBattlePlan<Denizen> {
    name = "Longbows";

    applyBefore(): void {
        this.action.campaignResult.atkPool++;
    }
}
export class LongbowsDefense extends DefenderBattlePlan<Denizen> {
    name = "Longbows";

    applyBefore(): void {
        this.action.campaignResult.atkPool--;
    }
}

export class ShieldWall extends DefenderBattlePlan<Denizen> {
    name = "Shield Wall";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.defPool += 2;
        this.action.campaignResult.defenderKillsEntireForce = true;
    }
}

export class Curfew extends EnemyActionModifier<Denizen> {
    name = "Curfew";
    modifiedAction = TradeAction;
    action: TradeAction;
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.action.playerProxy.site?.ruler === this.sourceProxy.ruler;
    }

    applyBefore(): void {
        if (!new PayCostToTargetEffect(this.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.sourceProxy.ruler?.original).do())
            throw new InvalidActionResolution("Cannot pay the Curfew.");
    }
}

export class TollRoads extends EnemyActionModifier<Denizen> {
    name = "Toll Roads";
    modifiedAction = TravelAction;
    action: TravelAction;

    applyBefore(): void {
        if (this.action.siteProxy.ruler === this.sourceProxy.ruler)
            if (!new PayCostToTargetEffect(this.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.sourceProxy.ruler?.original).do())
                throw new InvalidActionResolution("Cannot pay the Toll Roads.");
    }
}

export class ForcedLabor extends EnemyActionModifier<Denizen> {
    name = "Forced Labor";
    modifiedAction = SearchAction;
    action: SearchAction;
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.action.playerProxy.site?.ruler === this.sourceProxy.ruler;
    }

    applyBefore(): void {
        if (!new PayCostToTargetEffect(this.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.sourceProxy.ruler?.original).do())
            throw new InvalidActionResolution("Cannot pay the Forced Labor.");
    }
}

export class RoyalTax extends WhenPlayed<Denizen> {
    name = "Royal Tax";

    whenPlayed(): void {
        for (const playerProxy of Object.values(this.gameProxy.players)) {
            if (playerProxy.site.ruler === this.effect.playerProxy.leader)
                new MoveResourcesToTargetEffect(this.game, this.effect.player, OathResource.Favor, 2, this.effect.player, playerProxy).do();
        }
    }
}

export class VowOfObedience extends AccessedActionModifier<Denizen> {
    name = "Vow of Obedience";
    modifiedAction = SearchPlayAction;
    action: SearchPlayAction;
    mustUse = true;

    applyBefore(): void {
        if (!this.action.facedown && this.action.cardProxy instanceof Vision)
            throw new InvalidActionResolution("Playing a Vision faceup is disobedience.");
    }
}
export class VowOfObedienceRest extends RestPower<Denizen> {
    name = "Vow of Obedience";

    applyAfter(): void {
        new TakeFavorFromBankAction(this.action.player, 1).doNext();
    }
}
