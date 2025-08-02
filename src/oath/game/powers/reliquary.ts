import { ActionModifier, ResourceTransferModifier, SupplyCostModifier } from ".";
import { Reliquary } from "./base";
import { CampaignAttackAction, SearchAction, TradeAction, TravelAction } from "../actions";
import { InvalidActionResolution } from "../actions/utils";
import { RegionKey } from "../enums";
import type { ReliquarySlot } from "../model/reliquary";
import { Favor, Secret } from "../model/resources";
import type { ResourceTransferContext, SupplyCostContext } from "../costs";


export class Brutal extends Reliquary(ActionModifier<ReliquarySlot, CampaignAttackAction>) {
    modifiedAction = CampaignAttackAction;

    applyBefore() {
        this.action.campaignResult.attackerKillsEntireForce = true;
        this.action.campaignResult.defenderKillsEntireForce = true;
    }
}

export class Greedy extends Reliquary(ActionModifier<ReliquarySlot, SearchAction>) {
    modifiedAction = SearchAction;

    applyBefore(): void {
        this.action.amount += 2;
    }
    
    applyAfter(): void {
        if (this.action.supplyCost.amount > 2) throw new InvalidActionResolution("Cannot do a Greedy Search for more than 2 Supply.");
    }
}

export class Careless extends Reliquary(ResourceTransferModifier<ReliquarySlot>) {
    canUse(context: ResourceTransferContext): boolean {
        return super.canUse(context) && context.origin instanceof TradeAction;
    }

    apply(context: ResourceTransferContext): void {
        context.cost.placedResources.set(Secret, context.cost.placedResources.get(Secret) - 1);
        context.cost.placedResources.set(Favor, context.cost.placedResources.get(Favor) + 1);
    }
}

export class Decadent extends Reliquary(SupplyCostModifier<ReliquarySlot>) {
    canUse(context: SupplyCostContext): boolean {
        return super.canUse(context) && context.origin instanceof TravelAction;
    }

    apply(context: SupplyCostContext): void {
        const action = context.origin as TravelAction;
        if (action.siteProxy.inRegion(RegionKey.Cradle) && !this.playerProxy.site.inRegion(RegionKey.Cradle))
            context.cost.multiplier = 0;
    
        if (action.siteProxy.inRegion(RegionKey.Hinterland))
            context.cost.modifier += 1;
    }
}
