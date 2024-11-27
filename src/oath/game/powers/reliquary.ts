import { ActionModifier } from "./powers";
import { CampaignAttackAction, SearchAction, TradeAction, TravelAction } from "../actions/actions";
import { InvalidActionResolution, ModifiableAction } from "../actions/base";
import { RegionKey } from "../enums";
import { ReliquarySlot } from "../reliquary";
import { Favor, Secret } from "../resources";


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
        this.action.campaignResult.attackerKillsEntireForce = true;
        this.action.campaignResult.defenderKillsEntireForce = true;
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
        this.action.getting.set(Secret, (this.action.getting.get(Secret) || 0) - 1);
        this.action.getting.set(Favor, (this.action.getting.get(Favor) || 0) + 1);
    }
}

export class Decadent extends ReliquaryModifier<TravelAction> {
    name = "Decadent";
    modifiedAction = TravelAction;

    applyBefore(): void {
        if (this.action.siteProxy.inRegion(RegionKey.Cradle) && !this.activatorProxy.site.inRegion(RegionKey.Cradle))
            this.action.noSupplyCost = true;

        if (this.action.siteProxy.inRegion(RegionKey.Hinterland))
            this.action.supplyCostModifier += 1;
    }
}
