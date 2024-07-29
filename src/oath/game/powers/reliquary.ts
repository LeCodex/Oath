import { CampaignAtttackAction, SearchAction, InvalidActionResolution, TradeAction, TravelAction } from "../actions";
import { OathResource, RegionName } from "../enums";
import { Reliquary } from "../player";
import { ActionModifier } from "./powers";


export abstract class ReliquaryModifier extends ActionModifier<Reliquary> {
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.action.player === this.action.game.chancellor;
    }
}

export class Brutal extends ReliquaryModifier {
    name = "Brutal";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;

    applyBefore() {
        this.action.campaignResult.attackerKillsEntireForce = true;
        this.action.campaignResult.defenderKillsEntireForce = true;
    }
}

export class Greedy extends ReliquaryModifier {
    name = "Greedy";
    modifiedAction = SearchAction;
    action: SearchAction;

    applyBefore(): void {
        if (this.action.actualSupplyCost > 2) throw new InvalidActionResolution("Cannot do a Greedy Search for more than 2 Supply.");
        this.action.amount += 2;
    }
}

export class Careless extends ReliquaryModifier {
    name = "Careless";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyBefore(): void {
        this.action.getting.set(OathResource.Secret, Math.max(0, (this.action.getting.get(OathResource.Secret) || 0) - 1));
        this.action.getting.set(OathResource.Favor, (this.action.getting.get(OathResource.Favor) || 0) + 1);
    }
}

export class Decadent extends ReliquaryModifier {
    name = "Decadent";
    modifiedAction = TravelAction;
    action: TravelAction;

    applyBefore(): void {
        if (this.action.site.inRegion(RegionName.Cradle) && !this.action.player.site.inRegion(RegionName.Cradle))
            this.action.noSupplyCost = true;

        if (this.action.site.inRegion(RegionName.Hinterland))
            this.action.supplyCostModifier += 1;
    }
}
