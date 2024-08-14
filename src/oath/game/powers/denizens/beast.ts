import { SearchAction, CampaignAtttackAction, CampaignDefenseAction, TradeAction, TakeFavorFromBankAction, PiedPiperAction, InvalidActionResolution, ActAsIfAtSiteAction } from "../../actions/actions";
import { Denizen, Site } from "../../cards/cards";
import { RegionDiscardEffect } from "../../effects";
import { OathResource, OathSuit } from "../../enums";
import { ResourceCost } from "../../resources";
import { AccessedActionModifier, ActionModifier, AttackerBattlePlan, DefenderBattlePlan, WhenPlayed, RestPower, ActivePower } from "../powers";


export class Bracken extends AccessedActionModifier<Denizen> {
    name = "Bracken";
    modifiedAction = SearchAction;
    action: SearchAction;

    applyBefore(): void {
        // TODO: Action to change the discard options
    }
}

export class InsectSwarmAttack extends ActionModifier<Denizen> {
    name = "Insect Swarm";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;
    mustUse = true;

    canUse(): boolean {
        return this.action.campaignResult.defender === this.sourceProxy.ruler?.original;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        for (const modifier of modifiers)
            if (modifier instanceof AttackerBattlePlan)
                modifier.cost.add(new ResourceCost([], [[OathResource.Favor, 1]]));

        return [];
    }
}
export class InsectSwarmDefense extends ActionModifier<Denizen> {
    name = "Insect Swarm";
    modifiedAction = CampaignDefenseAction;
    action: CampaignDefenseAction;
    mustUse = true;

    canUse(): boolean {
        return this.action.campaignResult.attacker === this.sourceProxy.ruler?.original;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        for (const modifier of modifiers)
            if (modifier instanceof DefenderBattlePlan)
                modifier.cost.add(new ResourceCost([], [[OathResource.Favor, 1]]));

        return [];
    }
}

export class ThreateningRoar extends WhenPlayed<Denizen> {
    name = "Threatening Roar";

    whenPlayed(): void {
        new RegionDiscardEffect(this.effect.player, [OathSuit.Beast, OathSuit.Nomad], this.source).do();
    }
}

export class VowOfPoverty extends AccessedActionModifier<Denizen> {
    name = "Vow of Poverty";
    modifiedAction = TradeAction;
    action: TradeAction;
    mustUse = true;

    applyBefore(): void {
        this.action.getting.set(OathResource.Favor, -Infinity);
    }
}
export class VowOfPovertyRest extends RestPower<Denizen> {
    name = "Vow of Poverty";

    applyAfter(): void {
        if (this.action.playerProxy.getResources(OathResource.Favor) === 0)
            new TakeFavorFromBankAction(this.action.player, 2).doNext();
    }
}

export class PiedPiperActive extends ActivePower<Denizen> {
    name = "Pied Piper";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        new PiedPiperAction(this.action.player, this.source).doNext();
    }
}

export class SmallFriends extends AccessedActionModifier<Denizen> {
    name = "Small Friends";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        // Ignore all other modifiers, since we are going to select them again anyways
        return [...modifiers].filter(e => e !== this);
    }

    applyWhenApplied(): boolean {
        const sites = new Set<Site>();
        for (const siteProxy of this.gameProxy.board.sites())
            if (siteProxy !== this.action.playerProxy.site)
                for (const denizenProxy of siteProxy.denizens)
                    if (denizenProxy.suit === OathSuit.Beast)
                        sites.add(siteProxy.original);

        if (sites.size === 0)
            throw new InvalidActionResolution("No other site with a Beast card");

        new ActAsIfAtSiteAction(this.action.player, this.action, sites).doNext();
        return false;
    }
}
