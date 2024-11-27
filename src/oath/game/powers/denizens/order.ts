import { TradeAction, TravelAction, SearchAction, SearchPlayOrDiscardAction, TakeFavorFromBankAction, CampaignKillWarbandsInForceAction, CampaignResult, MakeDecisionAction, CampaignAction, ActAsIfAtSiteAction, CampaignDefenseAction, ChooseSitesAction, ChoosePlayersAction, KillWarbandsOnTargetAction, MusterAction, MoveWarbandsBetweenBoardAndSitesAction } from "../../actions/actions";
import { InvalidActionResolution } from "../../actions/base";
import { Denizen, Edifice, Relic, Site, Vision } from "../../cards/cards";
import { DieSymbol } from "../../dice";
import { PayCostToTargetEffect, MoveResourcesToTargetEffect, GainSupplyEffect, BecomeCitizenEffect, PutPawnAtSiteEffect, MoveOwnWarbandsEffect, BecomeExileEffect, PlayVisionEffect, TakeOwnableObjectEffect, ParentToTargetEffect } from "../../actions/effects";
import { BannerName, OathSuit } from "../../enums";
import { OathGameObject } from "../../gameObject";
import { CampaignActionTarget } from "../../interfaces";
import { OathPlayer } from "../../player";
import { Favor, ResourceCost } from "../../resources";
import { AttackerBattlePlan, DefenderBattlePlan, EnemyActionModifier, WhenPlayed, AccessedActionModifier, RestPower, ActivePower, ActionModifier, AccessedEffectModifier, EnemyEffectModifier, EnemyAttackerCampaignModifier } from "../powers";


export class LongbowsAttack extends AttackerBattlePlan<Denizen> {
    name = "Longbows";

    applyBefore(): void {
        this.action.campaignResult.params.atkPool++;
    }
}
export class LongbowsDefense extends DefenderBattlePlan<Denizen> {
    name = "Longbows";

    applyBefore(): void {
        this.action.campaignResult.params.atkPool--;
    }
}

export class EncirclementAttack extends AttackerBattlePlan<Denizen> {
    name = "Encirclement";
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        if (this.action.campaignResult.totalAtkForce > this.action.campaignResult.totalDefForce) this.action.campaignResult.params.atkPool += 2;
    }
}
export class EncirclementDefense extends DefenderBattlePlan<Denizen> {
    name = "Encirclement";
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        if (this.action.campaignResult.totalDefForce > this.action.campaignResult.totalAtkForce) this.action.campaignResult.params.atkPool -= 2;
    }
}

export class CodeOfHonorAttack extends AttackerBattlePlan<Denizen> {
    name = "Code of Honor";

    applyBefore(): void {
        for (const modifier of this.action.modifiers)
            if (modifier !== this && modifier instanceof AttackerBattlePlan)
                throw new InvalidActionResolution("Cannot use other battle plans with the Code of Honor");

        this.action.campaignResult.params.atkPool += 2;
    }
}
export class CodeOfHonorDefense extends DefenderBattlePlan<Denizen> {
    name = "Code of Honor";

    applyBefore(): void {
        for (const modifier of this.action.modifiers)
            if (modifier !== this && modifier instanceof DefenderBattlePlan)
                throw new InvalidActionResolution("Cannot use other battle plans with the Code of Honor");

        this.action.campaignResult.params.atkPool -= 2;
    }
}

export class BattleHonorsAttack extends AttackerBattlePlan<Denizen> {
    name = "Battle Honors";

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, () => {
            const bank = this.game.favorBank(OathSuit.Order);
            if (bank) new ParentToTargetEffect(this.game, this.activator, bank.get(2)).doNext();
        })
    }
}
export class BattleHonorsDefense extends DefenderBattlePlan<Denizen> {
    name = "Battle Honors";

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(false, () => () => {
            const bank = this.game.favorBank(OathSuit.Order);
            if (bank) new ParentToTargetEffect(this.game, this.activator, bank.get(2)).doNext();
        })
    }
}

function militaryParadeResolution(campaignResult: CampaignResult, activator: OathPlayer) {
    if (campaignResult.loser) {
        for (let i = OathSuit.Discord; i <= OathSuit.Nomad; i++) {
            const bank = activator.game.favorBank(i);
            if (bank) new ParentToTargetEffect(activator.game, activator, bank.get(campaignResult.loser.suitAdviserCount(i))).doNext();
        }
    }
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
            this.action.campaignResult.onSuccessful(true, () => new MakeDecisionAction(this.activator, "Become a Citizen?", () => new BecomeCitizenEffect(this.activator).doNext()));
    }
}
export class MartialCultureDefense extends DefenderBattlePlan<Denizen> {
    name = "Martial Culture";

    applyBefore(): void {
        if (!this.action.campaignResult.defender?.isImperial)
            this.action.campaignResult.onSuccessful(false, () => new MakeDecisionAction(this.activator, "Become a Citizen?", () => new BecomeCitizenEffect(this.activator).doNext()));
    }
}

export class FieldPromotionAttack extends AttackerBattlePlan<Denizen> {
    name = "Field Promotion";
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, () => new ParentToTargetEffect(this.game, this.activator, this.activatorProxy.leader.original.bag.get(3)).doNext());
    }
}
export class FieldPromotionDefense extends DefenderBattlePlan<Denizen> {
    name = "Field Promotion";
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(false, () => new ParentToTargetEffect(this.game, this.activator, this.activatorProxy.leader.original.bag.get(3)).doNext());
    }
}

export class PeaceEnvoyAttack extends AttackerBattlePlan<Denizen> {
    name = "Peace Envoy";
    cost = new ResourceCost([[Favor, 1]]);

    applyWhenApplied(): boolean {
        for (const modifier of this.action.modifiers)
            if (modifier !== this && modifier instanceof DefenderBattlePlan)
                throw new InvalidActionResolution("Cannot use other battle plans with the Peace Envoy");

        // TODO: This will mean no other modifiers get to do anything. Is this fine?
        if (this.action.campaignResultProxy.defender?.site === this.activatorProxy.site) {
            new MoveResourcesToTargetEffect(this.game, this.activator, Favor, this.action.campaignResult.params.defPool, this.action.campaignResult.defender).doNext(amount => {
                if (amount === 0) return;
                this.action.campaignResult.successful = false;
                this.action.campaignResult.params.ignoreKilling = true;
                this.action.next.doNext();
            });
        }

        return false;
    }
}
export class PeaceEnvoyDefense extends DefenderBattlePlan<Denizen> {
    name = "Peace Envoy";
    cost = new ResourceCost([[Favor, 1]]);

    applyWhenApplied(): boolean {
        for (const modifier of this.action.modifiers)
            if (modifier !== this && modifier instanceof DefenderBattlePlan)
                throw new InvalidActionResolution("Cannot use other battle plans with the Peace Envoy");

        if (this.action.campaignResultProxy.attacker.site === this.activatorProxy.site) {
            new MoveResourcesToTargetEffect(this.game, this.activator, Favor, this.action.campaignResult.params.defPool, this.action.campaignResult.attacker).doNext(amount => {
                if (amount === 0) return;
                this.action.campaignResult.successful = false;
                this.action.campaignResult.params.ignoreKilling = true;
                this.action.next.doNext();
            });
        }

        return false;
    }
}

export class ShieldWall extends DefenderBattlePlan<Denizen> {
    name = "Shield Wall";
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.params.defPool += 2;
        this.action.campaignResult.params.defenderKillsEntireForce = true;
    }
}

export class Wrestlers extends DefenderBattlePlan<Denizen> {
    name = "Wrestlers";

    applyBefore(): void {
        if (this.action.campaignResult.totalDefForce > 0) {
            this.action.campaignResult.params.defPool++;
            new CampaignKillWarbandsInForceAction(this.action.campaignResult, false, 1).doNext();
        }
    }
}

export class BearTraps extends DefenderBattlePlan<Denizen> {
    name = "Bear Traps";

    applyBefore(): void {
        this.action.campaignResult.params.atkPool--;
        new KillWarbandsOnTargetAction(this.action.player, this.action.campaignResult.attacker, 1).doNext();
    }
}

export class Keep extends DefenderBattlePlan<Denizen> {
    name = "Keep";

    applyBefore(): void {
        if (this.source.site && this.action.campaignResult.params.targets.has(this.source.site))
            this.action.campaignResult.params.defPool += 2;
    }
}

export class Scouts extends AttackerBattlePlan<Denizen> {
    name = "Scouts";

    applyBefore(): void {
        new GainSupplyEffect(this.activator, 1).doNext();
    }
}

export class Outriders extends AttackerBattlePlan<Denizen> {
    name = "Outriders";

    applyBefore(): void {
        this.action.campaignResult.params.atkRoll.ignore.add(DieSymbol.Skull);
    }
}

export class Specialist extends AttackerBattlePlan<Denizen> {
    name = "Specialist";
    cost = new ResourceCost([[Favor, 2]]);

    applyBefore(): void {
        this.action.next.applyModifiers([new SpecialistRestriction(this.source, this.action.next, this.action.player)]);
    }
}
export class SpecialistRestriction extends ActionModifier<Denizen, CampaignDefenseAction> {
    name = "Specialist";
    modifiedAction = CampaignDefenseAction;
    mustUse = true;

    applyBefore(): void {
        for (const modifier of this.action.modifiers)
            if (modifier instanceof DefenderBattlePlan)
                throw new InvalidActionResolution("Cannot use defender battle plans while under the Specialist");
    }
}

export class RelicHunter extends AttackerBattlePlan<Denizen> {
    name = "Relic Hunter";

    applyAtStart(): void {
        for (const [name, choice] of this.action.selects.targets.choices) {
            if (choice instanceof Relic && choice.site) {
                this.action.selects.targets.choices.set(name, new RelicWrapper(choice));
            }
        }
    }

    applyBefore(): void {
        for (const target of this.action.campaignResult.params.targets) {
            if (target instanceof RelicWrapper) {
                let targetedSite = false;
                for (const target2 of this.action.campaignResult.params.targets) {
                    if (target.relic.site === target2) {
                        targetedSite = true;
                        break;
                    }
                }

                if (!targetedSite) throw new InvalidActionResolution("Must target the site to also target the relic");
            }
        }
    }
}
export class RelicWrapper extends OathGameObject<Relic["key"]> implements CampaignActionTarget {
    type = "relic";
    defense = 1;
    force = undefined;
    relic: Relic;

    constructor(relic: Relic) {
        super(relic.id);
        this.relic = relic;
    }

    get key() { return this.relic.key; }

    seize(player: OathPlayer): void {
        this.relic.seize(player);
    }

    serialize(): Record<string, any> | undefined {
        return this.relic.serialize();
    }
}

export class Curfew extends EnemyActionModifier<Denizen, TradeAction> {
    name = "Curfew";
    modifiedAction = TradeAction;
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.activatorProxy.site?.ruler === this.sourceProxy.ruler;
    }

    applyBefore(): void {
        const cost = new ResourceCost([[Favor, 1]]);
        new PayCostToTargetEffect(this.game, this.activator, cost, this.sourceProxy.ruler?.original).doNext(success => {
            if (!success) throw cost.cannotPayError;
        });
    }
}

export class TollRoads extends EnemyActionModifier<Denizen, TravelAction> {
    name = "Toll Roads";
    modifiedAction = TravelAction;

    applyBefore(): void {
        if (this.action.siteProxy.ruler === this.sourceProxy.ruler) {
            const cost = new ResourceCost([[Favor, 1]]);
            new PayCostToTargetEffect(this.game, this.activator, cost, this.sourceProxy.ruler?.original).doNext(success => {
                if (!success) throw cost.cannotPayError;
            });
        }
    }
}

export class ForcedLabor extends EnemyActionModifier<Denizen, SearchAction> {
    name = "Forced Labor";
    modifiedAction = SearchAction;
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.activatorProxy.site?.ruler === this.sourceProxy.ruler;
    }

    applyBefore(): void {
        const cost = new ResourceCost([[Favor, 1]]);
        new PayCostToTargetEffect(this.game, this.activator, cost, this.sourceProxy.ruler?.original).doNext(success => {
            if (!success) throw cost.cannotPayError;
        });
    }
}

export class SecretPolice extends EnemyEffectModifier<Denizen, PlayVisionEffect> {
    name = "Secret Police";
    modifiedEffect = PlayVisionEffect;
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.effect.executorProxy.site?.ruler === this.sourceProxy.ruler;
    }

    applyBefore(): void {
        throw new InvalidActionResolution("Cannot play Visions under the Secret Police.");
    }
}

export class TomeGuardians extends EnemyEffectModifier<Denizen, TakeOwnableObjectEffect> {
    name = "Tome Guardians";
    modifiedEffect = TakeOwnableObjectEffect;

    applyBefore(): void {
        if (this.effect.maskProxyManager.get(this.effect.target) === this.gameProxy.banners.get(BannerName.DarkestSecret))
            throw new InvalidActionResolution("Cannot take the Darkest Secret from the Tome Guardians.");
    }
}
export class TomeGuardiansAttack extends EnemyAttackerCampaignModifier<Denizen> {
    name = "Tome Guardians";

    applyBefore(): void {
        for (const targetProxy of this.action.campaignResultProxy.params.targets)
            if (targetProxy === this.gameProxy.banners.get(BannerName.DarkestSecret))
                throw new InvalidActionResolution("Cannot target the Darkest Secret under the Tome Guardians.");
    }
}

export class Tyrant extends AccessedActionModifier<Denizen, TravelAction> {
    name = "Tyrant";
    modifiedAction = TravelAction;
    museUse = true;

    applyAfter(): void {
        new KillWarbandsOnTargetAction(this.action.player, this.action.siteProxy.original, 1).doNext();
    }
}

export class CouncilSeat extends AccessedEffectModifier<Denizen, BecomeExileEffect> {
    name = "Council Seat";
    modifiedEffect = BecomeExileEffect;
    museUse = true;

    applyBefore(): void {
        throw new InvalidActionResolution("Cannot be exiled with the Council Seat");
    }
}

export class Pressgangs extends AccessedActionModifier<Denizen, MusterAction> {
    name = "Pressgangs";
    modifiedAction = MusterAction;

    applyAtStart(): void {
        // TODO: This doesn't take other modifiers into account. There is none like that, but if you had something similar to Map Library for mustering, this wouldn't work with it
        for (const denizenProxy of this.action.playerProxy.site.denizens)
            this.action.selects.card.choices.set(denizenProxy.visualName(this.action.player), denizenProxy.original);
    }
}

export class KnightsErrant extends AccessedActionModifier<Denizen, MusterAction> {
    name = "Knights Errant";
    modifiedAction = MusterAction;
    mustUse = true;  // Involves a choice, so better to include it by default

    applyAfter(): void {
        new MakeDecisionAction(this.action.player, "Start a campaign?",
            () => {
                const campaignAction = new CampaignAction(this.action.player);
                campaignAction.noSupplyCost = true;
                campaignAction.doNext();
            }
        ).doNext();
    }
}

export class HuntingParty extends AccessedActionModifier<Denizen, SearchAction> {
    name = "Hunting Party";
    modifiedAction = SearchAction;
    mustUse = true;  // Involves a choice, so better to include it by default

    applyAfter(): void {
        if (this.action.deckProxy === this.gameProxy.worldDeck) {
            new MakeDecisionAction(this.action.player, "Start a campaign?",
                () => { 
                    const campaignAction = new CampaignAction(this.action.player);
                    campaignAction.noSupplyCost = true;
                    campaignAction.doNext();
                }
            ).doNext();
        }
    }
}

export class RoyalTax extends WhenPlayed<Denizen> {
    name = "Royal Tax";

    whenPlayed(): void {
        for (const playerProxy of this.gameProxy.players) {
            if (playerProxy.site.ruler === this.effect.executorProxy.leader)
                new MoveResourcesToTargetEffect(this.game, this.effect.executor, Favor, 2, this.effect.executor, playerProxy).doNext();
        }
    }
}

export class Garrison extends WhenPlayed<Denizen> {
    name = "Garrison";

    whenPlayed(): void {
        const sites = new Set<Site>();
        const leader = this.effect.executorProxy.leader.original;
        for (const siteProxy of this.gameProxy.board.sites()) {
            if (siteProxy.ruler === this.effect.executorProxy.leader) {
                new ParentToTargetEffect(this.game, this.effect.executor, this.effect.executorProxy.leader.original.bag.get(1), siteProxy.original).doNext();
                sites.add(siteProxy.original);
            }
        }
        
        new ChooseSitesAction(
            this.effect.executor, "Place a warband on each site you rule",
            (sites: Site[]) => { for (const site of sites) new MoveOwnWarbandsEffect(leader, this.effect.executor, site).doNext() },
            [sites],
            [[Math.min(sites.size, this.effect.executor.getWarbandsAmount(leader.key))]]
        ).doNext();
    }
}

export class VowOfObedience extends AccessedActionModifier<Denizen, SearchPlayOrDiscardAction> {
    name = "Vow of Obedience";
    modifiedAction = SearchPlayOrDiscardAction;
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
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        const campaignAction = new CampaignAction(this.action.player);
        campaignAction.noSupplyCost = true;

        const sites = new Set<Site>();
        for (const siteProxy of this.gameProxy.board.sites())
            if (siteProxy.ruler === this.action.playerProxy.leader)
                sites.add(siteProxy.original);
        
        new ActAsIfAtSiteAction(this.action.player, campaignAction, sites).doNext();
    }
}

export class SiegeEngines extends ActivePower<Denizen> {
    name = "Siege Engines";
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new ChooseSitesAction(
            this.action.player, "Kill two warbands",
            (sites: Site[]) => { if (sites[0]) new KillWarbandsOnTargetAction(this.action.player, sites[0], 2).doNext(); },
            [this.action.playerProxy.site.region?.original.sites.filter(e => e.warbands.length) ?? []]
        ).doNext();
    }
}

export class Messenger extends ActivePower<Denizen> {
    name = "Messenger";
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new MoveWarbandsBetweenBoardAndSitesAction(this.action.playerProxy).doNext();
    }
}

export class Palanquin extends ActivePower<Denizen> {
    name = "Palanquin";
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new ChoosePlayersAction(
            this.action.player, "Choose a player to move",
            (targets: OathPlayer[]) => {
                if (!targets[0]) return;
                new ChooseSitesAction(
                    this.action.player, "Force travel to a site",
                    (sites: Site[]) => {
                        if (!sites[0]) return;
                        new PutPawnAtSiteEffect(this.action.player, sites[0]).doNext();
                        const travelAction = new TravelAction(targets[0]!, this.action.player, (s: Site) => s === sites[0]);
                        travelAction.noSupplyCost = true;
                        travelAction.doNext();
                    }
                )
            },
            [this.gameProxy.players.filter(e => e !== this.action.playerProxy && e.site.region === this.action.playerProxy.site.region).map(e => e.original)]
        ).doNext();
    }
}


export class SprawlingRampart extends DefenderBattlePlan<Edifice> {
    name = "Sprawling Rampart";

    applyBefore(): void {
        for (const targetProxy of this.action.campaignResultProxy.params.targets) {
            if (targetProxy instanceof Site && targetProxy.ruler === this.sourceProxy.ruler)
                this.action.campaignResult.params.defPool++;
        }
    }
}

export class BanditRampart extends DefenderBattlePlan<Edifice> {
    name = "Bandit Rampart";

    applyBefore(): void {
        if (this.source.site && this.action.campaignResult.params.targets.has(this.source.site))
            this.action.campaignResult.params.atkPool -= 2;
    }
}