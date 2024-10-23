import { ActionModifier } from "./powers";
import { InvalidActionResolution, CampaignAttackAction, SearchAction, TradeAction, TravelAction, ModifiableAction } from "../actions/actions";
import { OathResource, RegionName } from "../enums";
import { ReliquarySlot } from "../reliquary";


export abstract class ReliquaryModifier<T extends ModifiableAction> extends ActionModifier<ReliquarySlot, T> {
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.activatorProxy === this.gameProxy.chancellor;
    }
}

export class Brutal extends ReliquaryModifier<CampaignAttackAction> {
    name = "Brutal";
    modifiedAction = CampaignAttackAction;

    applyBefore() {
        this.action.campaignResult.params.attackerKillsEntireForce = true;
        this.action.campaignResult.params.defenderKillsEntireForce = true;
    }
}

export class Greedy extends ReliquaryModifier<SearchAction> {
    name = "Greedy";
    modifiedAction = SearchAction;

    applyBefore(): void {
        this.action.amount += 2;
    }
    
    applyAfter(): void {
        if (this.action.actualSupplyCost > 2) throw new InvalidActionResolution("Cannot do a Greedy Search for more than 2 Supply.");
    }
}

export class Careless extends ReliquaryModifier<TradeAction> {
    name = "Careless";
    modifiedAction = TradeAction;

    applyBefore(): void {
        this.action.getting.set(OathResource.Secret, (this.action.getting.get(OathResource.Secret) || 0) - 1);
        this.action.getting.set(OathResource.Favor, (this.action.getting.get(OathResource.Favor) || 0) + 1);
    }
}

export class Decadent extends ReliquaryModifier<TravelAction> {
    name = "Decadent";
    modifiedAction = TravelAction;

    applyBefore(): void {
        if (this.action.siteProxy.inRegion(RegionName.Cradle) && !this.activatorProxy.site.inRegion(RegionName.Cradle))
            this.action.noSupplyCost = true;

        if (this.action.siteProxy.inRegion(RegionName.Hinterland))
            this.action.supplyCostModifier += 1;
    }
}
