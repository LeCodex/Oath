import { ActionModifier, Reliquary, ResourceTransferModifier, SupplyCostModifier } from ".";
import { CampaignAttackAction, SearchAction, TradeAction, TravelAction } from "../actions";
import { InvalidActionResolution } from "../actions/utils";
import { ResourceTransferContext, SupplyCostContext } from "./context";
import { RegionKey } from "../enums";
import { ReliquarySlot } from "../model/reliquary";
import { Favor, Secret } from "../model/resources";


@Reliquary
export class Brutal extends ActionModifier<ReliquarySlot, CampaignAttackAction> {
    modifiedAction = CampaignAttackAction;

    applyBefore() {
        this.action.campaignResult.attackerKillsEntireForce = true;
        this.action.campaignResult.defenderKillsEntireForce = true;
    }
}

@Reliquary
export class Greedy extends ActionModifier<ReliquarySlot, SearchAction> {
    modifiedAction = SearchAction;

    applyBefore(): void {
        this.action.amount += 2;
    }
    
    applyAfter(): void {
        if (this.action.supplyCost.amount > 2) throw new InvalidActionResolution("Cannot do a Greedy Search for more than 2 Supply.");
    }
}

@Reliquary
export class Careless extends ResourceTransferModifier<ReliquarySlot> {
    canUse(context: ResourceTransferContext): boolean {
        return context.origin instanceof TradeAction;
    }

    apply(context: ResourceTransferContext): void {
        context.cost.placedResources.set(Secret, context.cost.placedResources.get(Secret) - 1);
        context.cost.placedResources.set(Favor, context.cost.placedResources.get(Favor) + 1);
    }
}

@Reliquary
export class Decadent extends SupplyCostModifier<ReliquarySlot> {
    canUse(context: SupplyCostContext): boolean {
        return context.origin instanceof TravelAction;
    }

    apply(context: SupplyCostContext): void {
        const action = context.origin as TravelAction;
        if (action.siteProxy.inRegion(RegionKey.Cradle) && !this.playerProxy.site.inRegion(RegionKey.Cradle))
            context.cost.multiplier = 0;
    
        if (action.siteProxy.inRegion(RegionKey.Hinterland))
            context.cost.modifier += 1;
    }
}
