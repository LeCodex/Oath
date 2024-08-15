import { TradeAction, InvalidActionResolution, TravelAction, SearchAction, SearchPlayAction, TakeFavorFromBankAction, CampaignKillWarbandsInForceAction, CampaignResult, MakeDecisionAction, CampaignAction, ActAsIfAtSiteAction, CampaignDefenseAction, ChooseSiteAction, ChoosePlayerAction, MoveWarbandsAction } from "../../actions/actions";
import { Denizen, Edifice, Site, Vision } from "../../cards/cards";
import { PayCostToTargetEffect, MoveResourcesToTargetEffect, TakeWarbandsIntoBagEffect, GainSupplyEffect, TakeResourcesFromBankEffect, BecomeCitizenEffect, PutWarbandsFromBagEffect, ApplyModifiersEffect, PutPawnAtSiteEffect } from "../../effects";
import { OathResource, OathSuit } from "../../enums";
import { OathPlayer } from "../../player";
import { ResourceCost } from "../../resources";
import { AttackerBattlePlan, DefenderBattlePlan, EnemyActionModifier, WhenPlayed, AccessedActionModifier, RestPower, ActivePower, ActionModifier } from "../powers";


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

export class EncirclementAttack extends AttackerBattlePlan<Denizen> {
    name = "Encirclement";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        if (this.action.campaignResult.totalAtkForce > this.action.campaignResult.totalDefForce) this.action.campaignResult.atkPool += 2;
    }
}
export class EncirclementDefense extends DefenderBattlePlan<Denizen> {
    name = "Encirclement";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        if (this.action.campaignResult.totalDefForce > this.action.campaignResult.totalAtkForce) this.action.campaignResult.atkPool -= 2;
    }
}

export class CodeOfHonorAttack extends AttackerBattlePlan<Denizen> {
    name = "Code of Honor";

    applyBefore(): void {
        for (const modifier of this.action.modifiers)
            if (modifier !== this && modifier instanceof AttackerBattlePlan)
                throw new InvalidActionResolution("Cannot use other battle plans with the Code of Honor");

        this.action.campaignResult.atkPool += 2;
    }
}
export class CodeOfHonorDefense extends DefenderBattlePlan<Denizen> {
    name = "Code of Honor";

    applyBefore(): void {
        for (const modifier of this.action.modifiers)
            if (modifier !== this && modifier instanceof AttackerBattlePlan)
                throw new InvalidActionResolution("Cannot use other battle plans with the Code of Honor");

        this.action.campaignResult.atkPool -= 2;
    }
}

export class BattleHonorsAttack extends AttackerBattlePlan<Denizen> {
    name = "Battle Honors";

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, () => new TakeResourcesFromBankEffect(this.game, this.activator, this.game.favorBanks.get(OathSuit.Order), 2).do());
    }
}
export class BattleHonorsDefense extends DefenderBattlePlan<Denizen> {
    name = "Battle Honors";

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(false, () => new TakeResourcesFromBankEffect(this.game, this.activator, this.game.favorBanks.get(OathSuit.Order), 2).do());
    }
}

function militaryParadeResolution(campaignResult: CampaignResult, activator: OathPlayer) {
    if (campaignResult.loser)
        for (let i = OathSuit.Discord; i <= OathSuit.Nomad; i++)
            new TakeResourcesFromBankEffect(activator.game, activator, activator.game.favorBanks.get(i), campaignResult.loser.suitAdviserCount(i)).do();
}
export class MilitaryParadeAttack extends AttackerBattlePlan<Denizen> {
    name = "Military Parade";

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, () => militaryParadeResolution(this.action.campaignResult, this.activator));
    }
}
export class MilitaryParadeDefense extends DefenderBattlePlan<Denizen> {
    name = "Military Parade";

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(false, () => militaryParadeResolution(this.action.campaignResult, this.activator));
    }
}

export class MartialCultureAttack extends AttackerBattlePlan<Denizen> {
    name = "Martial Culture";

    applyBefore(): void {
        if (!this.action.campaignResult.defender?.isImperial)
            this.action.campaignResult.onSuccessful(true, () => new MakeDecisionAction(this.activator, "Become a Citizen?", () => new BecomeCitizenEffect(this.activator).do()));
    }
}
export class MartialCultureDefense extends DefenderBattlePlan<Denizen> {
    name = "Martial Culture";

    applyBefore(): void {
        if (!this.action.campaignResult.defender?.isImperial)
            this.action.campaignResult.onSuccessful(false, () => new MakeDecisionAction(this.activator, "Become a Citizen?", () => new BecomeCitizenEffect(this.activator).do()));
    }
}

export class FieldPromotionAttack extends AttackerBattlePlan<Denizen> {
    name = "Field Promotion";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, () => new PutWarbandsFromBagEffect(this.activator.leader, 3).do());
    }
}
export class FieldPromotionDefense extends DefenderBattlePlan<Denizen> {
    name = "Field Promotion";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(false, () => new PutWarbandsFromBagEffect(this.activator.leader, 3).do());
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

export class Wrestlers extends DefenderBattlePlan<Denizen> {
    name = "Wrestlers";

    applyBefore(): void {
        if (this.action.campaignResult.totalDefForce > 0) {
            this.action.campaignResult.defPool++;
            new CampaignKillWarbandsInForceAction(this.action.campaignResult, false, 1).doNext();
        }
    }
}

export class BearTraps extends DefenderBattlePlan<Denizen> {
    name = "Bear Traps";

    applyBefore(): void {
        this.action.campaignResult.atkPool--;
        new TakeWarbandsIntoBagEffect(this.action.campaignResult.attacker.leader, 1).do();
    }
}

export class Keep extends DefenderBattlePlan<Denizen> {
    name = "Keep";

    applyBefore(): void {
        if (this.source.site && this.action.campaignResult.targets.has(this.source.site))
            this.action.campaignResult.defPool += 2;
    }
}

export class Scouts extends AttackerBattlePlan<Denizen> {
    name = "Scouts";

    applyBefore(): void {
        new GainSupplyEffect(this.activator, 1).do();
    }
}

export class Outriders extends AttackerBattlePlan<Denizen> {
    name = "Outriders";

    applyBefore(): void {
        this.action.campaignResult.ignoreSkulls = true;
    }
}

export class Specialist extends AttackerBattlePlan<Denizen> {
    name = "Specialist";
    cost = new ResourceCost([[OathResource.Favor, 2]]);

    applyBefore(): void {
        new ApplyModifiersEffect(this.action.next, [new SpecialistRestriction(this.source, this.action.next, this.action.player)]).do();
    }
}
export class SpecialistRestriction extends ActionModifier<Denizen> {
    name = "Specialist";
    modifiedAction = CampaignDefenseAction;
    action: CampaignDefenseAction;
    mustUse = true;

    applyBefore(): void {
        for (const modifier of this.action.modifiers)
            if (modifier instanceof DefenderBattlePlan)
                throw new InvalidActionResolution("Cannot use defender battle plans while under the Specialist");
    }
}

export class Curfew extends EnemyActionModifier<Denizen> {
    name = "Curfew";
    modifiedAction = TradeAction;
    action: TradeAction;
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.activatorProxy.site?.ruler === this.sourceProxy.ruler;
    }

    applyBefore(): void {
        if (!new PayCostToTargetEffect(this.game, this.activator, new ResourceCost([[OathResource.Favor, 1]]), this.sourceProxy.ruler?.original).do())
            throw new InvalidActionResolution("Cannot pay the Curfew.");
    }
}

export class TollRoads extends EnemyActionModifier<Denizen> {
    name = "Toll Roads";
    modifiedAction = TravelAction;
    action: TravelAction;

    applyBefore(): void {
        if (this.action.siteProxy.ruler === this.sourceProxy.ruler)
            if (!new PayCostToTargetEffect(this.game, this.activator, new ResourceCost([[OathResource.Favor, 1]]), this.sourceProxy.ruler?.original).do())
                throw new InvalidActionResolution("Cannot pay the Toll Roads.");
    }
}

export class ForcedLabor extends EnemyActionModifier<Denizen> {
    name = "Forced Labor";
    modifiedAction = SearchAction;
    action: SearchAction;
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.activatorProxy.site?.ruler === this.sourceProxy.ruler;
    }

    applyBefore(): void {
        if (!new PayCostToTargetEffect(this.game, this.activator, new ResourceCost([[OathResource.Favor, 1]]), this.sourceProxy.ruler?.original).do())
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
        new TakeFavorFromBankAction(this.activator, 1).doNext();
    }
}

export class Captains extends ActivePower<Denizen> {
    name = "Captains";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        const campaignAction = new CampaignAction(this.action.player);
        const sites = new Set<Site>();
        for (const siteProxy of this.gameProxy.board.sites())
            if (siteProxy.ruler === this.action.playerProxy)
                sites.add(siteProxy.original);
        
        new ActAsIfAtSiteAction(this.action.player, campaignAction, sites).doNext();
    }
}

export class SiegeEngines extends ActivePower<Denizen> {
    name = "Siege Engines";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        new ChooseSiteAction(
            this.action.player, "Kill two warbands",
            (site: Site | undefined) => {
                if (!site) return;
                site.killWarbands(this.action.player, 2);
            },
            this.action.playerProxy.site.region.original.sites.filter(e => e.totalWarbands)
        ).doNext();
    }
}

export class Messenger extends ActivePower<Denizen> {
    name = "Messenger";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        new ChooseSiteAction(
            this.action.player, "Exchange warbands with a site",
            (site: Site | undefined) => {
                if (!site) return;
                const action = new MoveWarbandsAction(this.action.player);
                action.playerProxy.site = site;
                action.doNext();
                this.usePower();
            },
            [...this.gameProxy.board.sites()].filter(e => e.ruler === this.action.playerProxy).map(e => e.original),
            "Finish"
        ).doNext();
    }
}

export class Palanquin extends ActivePower<Denizen> {
    name = "Palanquin";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        new ChoosePlayerAction(
            this.action.player, "Choose a player to move",
            (target: OathPlayer | undefined) => {
                if (!target) return;
                new ChooseSiteAction(
                    this.action.player, "Force travel to a site",
                    (site: Site | undefined) => {
                        if (!site) return;
                        new PutPawnAtSiteEffect(this.action.player, site).do();
                        const travelAction = new TravelAction(target, this.action.player, (s: Site) => s === site);
                        travelAction._noSupplyCost = true;
                        travelAction.doNext();
                    }
                )
            },
            Object.values(this.gameProxy.players).filter(e => e !== this.action.playerProxy && e.site.region === this.action.playerProxy.site.region).map(e => e.original)
        ).doNext();
    }
}


export class BanditRampart extends DefenderBattlePlan<Edifice> {
    name = "Bandit Rampart";

    applyBefore(): void {
        if (this.source.site && this.action.campaignResult.targets.has(this.source.site))
            this.action.campaignResult.atkPool -= 2;
    }
}