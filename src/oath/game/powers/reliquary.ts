import { ActionModifier } from "./powers";
import { InvalidActionResolution, CampaignAtttackAction, SearchAction, TradeAction, TravelAction } from "../actions/actions";
import { OathResource, RegionName } from "../enums";
import { Reliquary } from "../reliquary";


export abstract class ReliquaryModifier extends ActionModifier<Reliquary> {
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.action.playerProxy === this.action.gameProxy.chancellor;
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
        if (this.action.siteProxy.inRegion(RegionName.Cradle) && !this.action.playerProxy.site.inRegion(RegionName.Cradle))
            this.action.noSupplyCost = true;

        if (this.action.siteProxy.inRegion(RegionName.Hinterland))
            this.action.supplyCostModifier += 1;
    }
}
