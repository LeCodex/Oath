import { TradeAction, TravelAction, SearchAction, SearchPlayOrDiscardAction, TakeFavorFromBankAction, CampaignKillWarbandsInForceAction, MakeDecisionAction, CampaignAction, ActAsIfAtSiteAction, CampaignDefenseAction, ChooseSitesAction, ChoosePlayersAction, KillWarbandsOnTargetAction, MusterAction, MoveWarbandsBetweenBoardAndSitesAction, CampaignAttackAction } from "../actions";
import { CampaignResult, CampaignEndCallback , InvalidActionResolution } from "../actions/utils";

import { Denizen, Edifice, Relic, Site, Vision } from "../model/cards";
import { TransferResourcesEffect, GainSupplyEffect, BecomeCitizenEffect, PutPawnAtSiteEffect, MoveOwnWarbandsEffect, BecomeExileEffect, PlayVisionEffect, TakeOwnableObjectEffect, ParentToTargetEffect } from "../actions/effects";
import { BannerKey, OathSuit } from "../enums";
import { OathGameObject } from "../model/gameObject";
import { CampaignActionTarget, WithPowers } from "../model/interfaces";
import { ExileBoard, OathPlayer } from "../model/player";
import { Favor } from "../model/resources";
import { ResourceCost } from "../costs";
import { ResourceTransferContext } from "./context";
import { AttackerBattlePlan, DefenderBattlePlan, WhenPlayed, RestPower, ActivePower, ActionModifier, Accessed, EnemyActionModifier, BattlePlan } from ".";
import { AttackDieSymbol } from "../dice";


export class LongbowsAttack extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.atkPool++;
    }
}
export class LongbowsDefense extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.atkPool--;
    }
}

export class EncirclementAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        if (this.action.campaignResult.totalAtkForce > this.action.campaignResult.totalDefForce) this.action.campaignResult.atkPool += 2;
    }
}
export class EncirclementDefense extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        if (this.action.campaignResult.totalDefForce > this.action.campaignResult.totalAtkForce) this.action.campaignResult.atkPool -= 2;
    }
}

export class CodeOfHonorAttack extends AttackerBattlePlan<Denizen> {
    applyAtStart(): void {
        for (const modifier of this.action.modifiers)
            if (modifier !== this && modifier instanceof AttackerBattlePlan)
                throw new InvalidActionResolution("Cannot use other battle plans with the Code of Honor");

        this.action.campaignResult.atkPool += 2;
    }
}
export class CodeOfHonorDefense extends DefenderBattlePlan<Denizen> {
    applyAtStart(): void {
        for (const modifier of this.action.modifiers)
            if (modifier !== this && modifier instanceof DefenderBattlePlan)
                throw new InvalidActionResolution("Cannot use other battle plans with the Code of Honor");

        this.action.campaignResult.atkPool -= 2;
    }
}

export class BattleHonorsAttack extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.onAttackWin(new CampaignEndCallback(() => {
            const bank = this.game.favorBank(OathSuit.Order);
            if (bank) new ParentToTargetEffect(this.game, this.player, bank.get(2)).doNext();
        }, this.source.name));
    }
}
export class BattleHonorsDefense extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.onDefenseWin(new CampaignEndCallback(() => {
            const bank = this.game.favorBank(OathSuit.Order);
            if (bank) new ParentToTargetEffect(this.game, this.player, bank.get(2)).doNext();
        }, this.source.name));
    }
}

function militaryParadeResolution(campaignResult: CampaignResult, player: OathPlayer) {
    if (campaignResult.loser) {
        for (let i = OathSuit.Discord; i <= OathSuit.Nomad; i++) {
            const bank = player.game.favorBank(i);
            if (bank) new ParentToTargetEffect(player.game, player, bank.get(campaignResult.loser.suitAdviserCount(i))).doNext();
        }
    }
}
export class MilitaryParadeAttack extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.onAttackWin(new CampaignEndCallback(() => militaryParadeResolution(this.action.campaignResult, this.player), this.source.name));
    }
}
export class MilitaryParadeDefense extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.onDefenseWin(new CampaignEndCallback(() => militaryParadeResolution(this.action.campaignResult, this.player), this.source.name));
    }
}

export class MartialCultureAttack extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        if (!(this.action.playerProxy.board instanceof ExileBoard)) return;
        if (!this.action.campaignResult.defender?.isImperial)
            this.action.campaignResult.onAttackWin(new CampaignEndCallback(
                () => new MakeDecisionAction(this.player, "Become a Citizen?", () => new BecomeCitizenEffect(this.player).doNext()),
                this.source.name
            ));
    }
}
export class MartialCultureDefense extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        if (!(this.action.playerProxy.board instanceof ExileBoard)) return;
        if (!this.action.campaignResult.defender?.isImperial)
            this.action.campaignResult.onDefenseWin(new CampaignEndCallback(
                () => new MakeDecisionAction(this.player, "Become a Citizen?", () => new BecomeCitizenEffect(this.player).doNext()),
                this.source.name
            ));
    }
}

export class FieldPromotionAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.onAttackWin(new CampaignEndCallback(
            () => new ParentToTargetEffect(this.game, this.player, this.playerProxy.leader.original.bag.get(3)).doNext(),
            this.source.name
        ));
    }
}
export class FieldPromotionDefense extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.onDefenseWin(new CampaignEndCallback(
            () => new ParentToTargetEffect(this.game, this.player, this.playerProxy.leader.original.bag.get(3)).doNext(),
            this.source.name
        ));
    }
}

export class PeaceEnvoyAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, CampaignAttackAction>>): Iterable<ActionModifier<WithPowers, CampaignAttackAction>> {
        return [...modifiers].filter(e => e !== this && e instanceof BattlePlan);
    }

    applyWhenApplied(): boolean {
        // TODO: This will mean no other modifiers get to do anything. Is this fine?
        if (this.action.campaignResultProxy.defender?.site === this.playerProxy.site) {
            new TransferResourcesEffect(
                this.game,
                new ResourceTransferContext(this.player, this, new ResourceCost([[Favor, this.action.campaignResult.defPool]]), this.action.campaignResult.defender!)
            ).doNext(success => {
                if (!success) return;
                this.action.campaignResult.successful = true;
                this.action.campaignResult.ignoreKilling = true;
                this.action.next.next.doNext();
            });
        }

        return false;
    }
}
export class PeaceEnvoyDefense extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, CampaignDefenseAction>>): Iterable<ActionModifier<WithPowers, CampaignDefenseAction>> {
        return [...modifiers].filter(e => e !== this && e instanceof BattlePlan);
    }

    applyWhenApplied(): boolean {
        if (this.action.campaignResultProxy.attacker.site === this.playerProxy.site) {
            new TransferResourcesEffect(
                this.game,
                new ResourceTransferContext(this.player, this, new ResourceCost([[Favor, this.action.campaignResult.defPool]]), this.action.campaignResult.attacker)
            ).doNext(success => {
                if (!success) return;
                this.action.campaignResult.successful = false;
                this.action.campaignResult.ignoreKilling = true;
                this.action.next.doNext();
            });
        }

        return false;
    }
}

export class ShieldWall extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.defPool += 2;
        this.action.campaignResult.defenderKillsEntireForce = true;
    }
}

export class Wrestlers extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        if (this.action.campaignResult.totalDefForce > 0) {
            this.action.campaignResult.defPool++;
            new CampaignKillWarbandsInForceAction(this.action.campaignResult, false, 1).doNext();
        }
    }
}

export class BearTraps extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.atkPool--;
        new KillWarbandsOnTargetAction(this.action.player, this.action.campaignResult.attacker, 1).doNext();
    }
}

export class Keep extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        if (this.source.site && this.action.campaignResult.targets.has(this.source.site))
            this.action.campaignResult.defPool += 2;
    }
}

export class Scouts extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        new GainSupplyEffect(this.player, 1).doNext();
    }
}

export class Outriders extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.atkRoll.ignore.add(AttackDieSymbol.Skull);
    }
}

export class Specialist extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 2]]);

    applyBefore(): void {
        this.action.next.applyModifiers([new SpecialistRestriction(this.source, this.action.player, this.action.next)]);
    }
}
export class SpecialistRestriction extends ActionModifier<Denizen, CampaignDefenseAction> {
    modifiedAction = CampaignDefenseAction;

    applyBefore(): void {
        for (const modifier of this.action.modifiers)
            if (modifier instanceof DefenderBattlePlan)
                throw new InvalidActionResolution("Cannot use defender battle plans while under the Specialist");
    }
}

export class RelicHunter extends AttackerBattlePlan<Denizen> {
    applyAtStart(): void {
        for (const choiceProxy of this.action.selects.targetProxies.choices.values()) {
            if (choiceProxy instanceof Site) {
                const relicProxy = choiceProxy.relics[0];
                if (!relicProxy) continue;
                this.action.selects.targetProxies.choices.set(relicProxy.visualName(this.action.player), new RelicWrapper(relicProxy));
            }
        }
    }

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (target instanceof RelicWrapper) {
                const targetedSite = [...this.action.campaignResult.targets].some(e => target.relic.site === e);
                if (!targetedSite) throw new InvalidActionResolution("Must target the site to also target the relic");
            }
        }
    }
}
export class RelicWrapper extends OathGameObject<Relic["key"]> implements CampaignActionTarget {
    readonly type = "relic";
    defense = 1;
    force = undefined;
    relic: Relic;

    constructor(relic: Relic) {
        super(relic.id);
        this.relic = relic;
    }

    get name() { return this.relic.name; }
    get key() { return this.relic.key; }

    seize(player: OathPlayer): void {
        this.relic.seize(player);
    }
}

export class Curfew extends EnemyActionModifier<Denizen, TradeAction> {
    modifiedAction = TradeAction;

    canUse(): boolean {
        return super.canUse() && this.playerProxy.site?.ruler === this.sourceProxy.ruler;
    }

    applyBefore(): void {
        const costContext = new ResourceTransferContext(this.player, this, new ResourceCost([[Favor, 1]]), this.sourceProxy.ruler?.original);
        new TransferResourcesEffect(this.game, costContext).doNext(success => {
            if (!success) throw this.costContext.cost.cannotPayError;
        });
    }
}

export class TollRoads extends EnemyActionModifier<Denizen, TravelAction> {
    modifiedAction = TravelAction;

    applyBefore(): void {
        if (this.action.siteProxy.ruler === this.sourceProxy.ruler) {
            const costContext = new ResourceTransferContext(this.player, this, new ResourceCost([[Favor, 1]]), this.sourceProxy.ruler?.original);
            new TransferResourcesEffect(this.game, costContext).doNext(success => {
                if (!success) throw this.costContext.cost.cannotPayError;
            });
        }
    }
}

export class ForcedLabor extends EnemyActionModifier<Denizen, SearchAction> {
    modifiedAction = SearchAction;

    canUse(): boolean {
        return super.canUse() && this.playerProxy.site?.ruler === this.sourceProxy.ruler;
    }

    applyBefore(): void {
        const costContext = new ResourceTransferContext(this.player, this, new ResourceCost([[Favor, 1]]), this.sourceProxy.ruler?.original);
        new TransferResourcesEffect(this.game, costContext).doNext(success => {
            if (!success) throw this.costContext.cost.cannotPayError;
        });
    }
}

export class SecretPolice extends EnemyActionModifier<Denizen, PlayVisionEffect> {
    modifiedAction = PlayVisionEffect;

    canUse(): boolean {
        return super.canUse() && this.action.executorProxy.site?.ruler === this.sourceProxy.ruler;
    }

    applyBefore(): void {
        throw new InvalidActionResolution("Cannot play Visions under the Secret Police.");
    }
}

export class TomeGuardians extends EnemyActionModifier<Denizen, TakeOwnableObjectEffect> {
    modifiedAction = TakeOwnableObjectEffect;

    applyBefore(): void {
        if (this.action.maskProxyManager.get(this.action.target) === this.gameProxy.banners.get(BannerKey.DarkestSecret))
            throw new InvalidActionResolution("Cannot take the Darkest Secret from the Tome Guardians.");
    }
}
export class TomeGuardiansAttack extends EnemyActionModifier<Denizen, CampaignAttackAction> {
    modifiedAction = CampaignAttackAction;

    applyAtStart(): void {
        this.action.selects.targetProxies.filterChoices(e => e !== this.gameProxy.banners.get(BannerKey.DarkestSecret));
    }
}

@Accessed
export class Tyrant extends ActionModifier<Denizen, TravelAction> {
    modifiedAction = TravelAction;
    museUse = true;

    applyAfter(): void {
        new KillWarbandsOnTargetAction(this.action.player, this.action.siteProxy.original, 1).doNext();
    }
}

@Accessed
export class CouncilSeat extends ActionModifier<Denizen, BecomeExileEffect> {
    modifiedAction = BecomeExileEffect;
    museUse = true;

    applyBefore(): void {
        throw new InvalidActionResolution("Cannot exile the player with the Council Seat");
    }
}

@Accessed
export class Pressgangs extends ActionModifier<Denizen, MusterAction> {
    modifiedAction = MusterAction;
    mustUse = true;  // Nicer to have it automatically apply

    applyAtStart(): void {
        for (const denizenProxy of this.action.accessibleDenizenProxies)
            this.action.selects.cardProxy.choices.set(denizenProxy.visualName(this.action.player), denizenProxy.original);
    }
}

@Accessed
export class KnightsErrant extends ActionModifier<Denizen, MusterAction> {
    modifiedAction = MusterAction;
    mustUse = true;  // Involves a choice, so better to include it by default

    applyAfter(): void {
        new MakeDecisionAction(this.action.player, "Start a campaign?",
            () => {
                const campaignAction = new CampaignAction(this.action.player);
                campaignAction.supplyCost.multiplier = 0;
                campaignAction.doNext();
            }
        ).doNext();
    }
}

@Accessed
export class HuntingParty extends ActionModifier<Denizen, SearchAction> {
    modifiedAction = SearchAction;
    mustUse = true;  // Involves a choice, so better to include it by default

    applyAfter(): void {
        if (this.action.deckProxy === this.gameProxy.worldDeck) {
            new MakeDecisionAction(this.action.player, "Start a campaign?",
                () => { 
                    const campaignAction = new CampaignAction(this.action.player);
                    campaignAction.supplyCost.multiplier = 0;
                    campaignAction.doNext();
                }
            ).doNext();
        }
    }
}

export class RoyalTax extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        for (const playerProxy of this.gameProxy.players) {
            if (playerProxy.site.ruler === this.action.executorProxy.leader)
                new TransferResourcesEffect(this.game, new ResourceTransferContext(this.action.executor, this, new ResourceCost([[Favor, 2]]), this.action.executor, playerProxy)).doNext();
        }
    }
}

export class Garrison extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        const sites = new Set<Site>();
        const leader = this.action.executorProxy.leader.original;
        for (const siteProxy of this.gameProxy.map.sites()) {
            if (siteProxy.ruler === this.action.executorProxy.leader) {
                new ParentToTargetEffect(this.game, this.action.executor, this.action.executorProxy.leader.original.bag.get(1), siteProxy.original).doNext();
                sites.add(siteProxy.original);
            }
        }
        
        new ChooseSitesAction(
            this.action.executor, "Place a warband on each site you rule",
            (sites: Site[]) => { for (const site of sites) new MoveOwnWarbandsEffect(leader, this.action.executor, site).doNext() },
            [sites],
            [[Math.min(sites.size, this.action.executor.getWarbandsAmount(leader.board.key))]]
        ).doNext();
    }
}

@Accessed
export class VowOfObedience extends ActionModifier<Denizen, SearchPlayOrDiscardAction> {
    modifiedAction = SearchPlayOrDiscardAction;
    mustUse = true;

    applyBefore(): void {
        if (!this.action.facedown && this.action.cardProxy instanceof Vision)
            throw new InvalidActionResolution("Playing a Vision faceup is disobedience.");
    }
}
export class VowOfObedienceRest extends RestPower<Denizen> {
    applyAfter(): void {
        new TakeFavorFromBankAction(this.player, 1).doNext();
    }
}

export class Captains extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        const campaignAction = new CampaignAction(this.action.player);
        campaignAction.supplyCost.multiplier = 0;

        const sites = new Set<Site>();
        for (const siteProxy of this.gameProxy.map.sites())
            if (siteProxy.ruler === this.action.playerProxy.leader)
                sites.add(siteProxy.original);
        
        new ActAsIfAtSiteAction(this.action.player, campaignAction, sites).doNext();
    }
}

export class SiegeEngines extends ActivePower<Denizen> {
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
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new MoveWarbandsBetweenBoardAndSitesAction(this.action.playerProxy).doNext();
    }
}

export class Palanquin extends ActivePower<Denizen> {
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
                        travelAction.supplyCost.multiplier = 0;
                        travelAction.doNext();
                    }
                ).doNext();
            },
            [this.gameProxy.players.filter(e => e !== this.action.playerProxy && e.site.region === this.action.playerProxy.site.region).map(e => e.original)]
        ).doNext();
    }
}


export class SprawlingRampart extends ActionModifier<Edifice, CampaignDefenseAction> {
    modifiedAction = CampaignDefenseAction;
    mustUse = true;

    applyBefore(): void {
        for (const targetProxy of this.action.campaignResultProxy.targets) {
            if (targetProxy instanceof Site && targetProxy.ruler === this.sourceProxy.ruler)
                this.action.campaignResult.defPool++;
        }
    }
}

export class BanditRampart extends DefenderBattlePlan<Edifice> {
    applyBefore(): void {
        if (this.source.site && this.action.campaignResult.targets.has(this.source.site))
            this.action.campaignResult.atkPool -= 2;
    }
}