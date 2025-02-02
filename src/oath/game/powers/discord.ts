import type { CampaignDefenseAction } from "../actions";
import { MakeDecisionAction, ChooseCardsAction, ChooseRegionAction, TakeFavorFromBankAction, TakeResourceFromPlayerAction, ChooseSuitsAction, SearchPlayOrDiscardAction, MusterAction, TravelAction, CampaignAction, KillWarbandsOnTargetAction, CampaignAttackAction, CampaignEndAction, TakeReliquaryRelicAction, ChooseNumberAction, StartBindingExchangeAction, FestivalDistrictOfferAction, RecoverAction } from "../actions";
import { CampaignEndCallback , cannotPayError, InvalidActionResolution } from "../actions/utils";
import { OathAction } from "../actions/base";
import type { PeoplesFavor } from "../model/banks";
import { FavorBank } from "../model/banks";
import type { Region } from "../model/map";
import type { Edifice, OathCard, WorldCard } from "../model/cards";
import { Denizen, Relic, Site, Vision } from "../model/cards";
import { D6, DefenseDie } from "../dice";
import { TakeOwnableObjectEffect, PutResourcesOnTargetEffect, SetNewOathkeeperEffect, RollDiceEffect, DiscardCardEffect, BecomeCitizenEffect, TransferResourcesEffect, PeekAtCardEffect, WinGameEffect, DrawFromDeckEffect, MoveWorldCardToAdvisersEffect, ParentToTargetEffect } from "../actions/effects";
import { BannerKey, OathSuit } from "../enums";
import type { OathPlayer } from "../model/player";
import { ExileBoard } from "../model/player";
import { Favor, Secret } from "../model/resources";
import { ResourceCost } from "../costs";
import { WhenPlayed, CapacityModifier, ActivePower, RestPower, AttackerBattlePlan, DefenderBattlePlan, ActionModifier, Accessed, WakePower, EnemyActionModifier, EnemyAttackerCampaignModifier, EnemyDefenderCampaignModifier } from ".";
import { minInGroup, NumberMap } from "../utils";
import type { WithPowers } from "../model/interfaces";


export class MercenariesAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool += 3;
        this.action.campaignResult.onDefenseWin(new CampaignEndCallback(() => new DiscardCardEffect(this.actionManager, this.player, this.source).doNext(), this.source.name));
    }
}
export class MercenariesDefense extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool -= 3;
        this.action.campaignResult.onAttackWin(new CampaignEndCallback(() => new DiscardCardEffect(this.actionManager, this.player, this.source).doNext(), this.source.name));
    }
}

export class CrackedSageAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]], [[Favor, 1]]);

    applyBefore(): void {
        if (!this.action.campaignResult.defender) return;
        for (const adviser of this.action.campaignResult.defender.advisers) {
            if (!(adviser instanceof Denizen) || adviser.suit !== OathSuit.Arcane) continue;
            this.action.campaignResult.atkPool += 4;
            break;
        }
    }
}
export class CrackedSageDefense extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]], [[Favor, 1]]);

    applyBefore(): void {
        for (const adviser of this.action.campaignResult.attacker.advisers) {
            if (!(adviser instanceof Denizen) || adviser.suit !== OathSuit.Arcane) continue;
            this.action.campaignResult.atkPool -= 4;
            break;
        }
    }
}

export class DisgracedCaptain extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]], [[Favor, 1]]);

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (!(target instanceof Site)) continue;
            for (const denizenProxy of this.action.maskProxyManager.get(target).denizens) {
                if (denizenProxy.suit !== OathSuit.Order) continue;
                this.action.campaignResult.atkPool += 4;
                break;
            }
        }
    }
}

export class BookBurning extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, new CampaignEndCallback(() => {
            const defender = this.action.campaignResult.defender;
            if (!defender) return;
            new TransferResourcesEffect(this.actionManager, defender, new ResourceCost([], [[Secret, defender.byClass(Secret).length - 1]]), undefined).doNext()
        }, this.source.name));
    }
}

export class Slander extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, new CampaignEndCallback(() => {
            const defender = this.action.campaignResult.defender;
            if (!defender) return;
            new TransferResourcesEffect(this.actionManager, defender, new ResourceCost([], [[Favor, Infinity]]), undefined).doNext();
        }, this.source.name));
    }
}

export class SecondWind extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]], [[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, new CampaignEndCallback(() => {
            new MakeDecisionAction(
                this.actionManager, this.action.player, "Take a Travel action?",
                () => {
                    const travelAction = new TravelAction(this.actionManager, this.action.player);
                    travelAction.supplyCost.multiplier = 0;
                    travelAction.doNext();
                }
            ).doNext();

            new MakeDecisionAction(
                this.actionManager, this.action.player, "Take a Campaign action?",
                () => {
                    const campaignAction = new CampaignAction(this.actionManager, this.action.player);
                    campaignAction.supplyCost.multiplier = 0;
                    campaignAction.doNext();
                }
            ).doNext();
        }, this.source.name));
    }
}

export class Zealots extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyAtEnd(): void {
        if (this.action.campaignResult.totalAtkForce < this.action.campaignResult.totalDefForce)
            this.action.campaignResult.sacrificeValue = 3;
    }
}

export class RelicThief extends EnemyActionModifier<Denizen, TakeOwnableObjectEffect> {
    modifiedAction = TakeOwnableObjectEffect;

    applyAfter(): void {
        // TODO: Trigger when multiple things are taken
        const rulerProxy = this.sourceProxy.ruler;
        if (!rulerProxy) return;
        if (this.action.target instanceof Relic && this.action.executorProxy?.site.region === rulerProxy.site.region) {
            new MakeDecisionAction(
                this.actionManager, rulerProxy.original, "Try to steal " + this.action.target.name + "?",
                () => {
                    new TransferResourcesEffect(this.actionManager, rulerProxy.original, new ResourceCost([[Favor, 1], [Secret, 1]]), this.source).doNext(success => {
                        if (!success) throw cannotPayError(this.selfCostContext.cost);
                        new RollDiceEffect(this.actionManager, rulerProxy.original, new DefenseDie(), 1).doNext(result => {
                            if (result.value === 0) new TakeOwnableObjectEffect(this.actionManager, rulerProxy.original, this.action.target).doNext();
                        });
                    });
                }
            ).doNext();
        }
    }
}

export class KeyToTheCity extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        if (!this.source.site || !this.sourceProxy.site) return;
        if (this.sourceProxy.site.ruler?.site === this.sourceProxy.site) return;

        for (const player of this.game.players)
            new ParentToTargetEffect(this.actionManager, player, this.source.site.getWarbands(player.board.key), player.bag).doNext();

        new ParentToTargetEffect(this.actionManager, this.action.executor, this.action.executorProxy.leader.original.bag.get(1), this.source.site).doNext();
    }
}

export class OnlyTwoAdvisers extends CapacityModifier<Denizen> {
    get name() { return "Only Two Advisers"; }

    canUse(player: OathPlayer, site?: Site): boolean {
        return player === this.source.ruler && !site;
    }

    updateCapacityInformation(targetProxy: Set<WorldCard>): [number, Iterable<WorldCard>] {
        return [2, []];
    }
}

export class Assassin extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        const cards = new Set<WorldCard>();
        for (const playerProxy of this.gameProxy.players) {
            if (playerProxy === this.action.playerProxy || playerProxy.site !== this.action.playerProxy.site) continue;
            for (const adviserProxy of playerProxy.advisers)
                if (!adviserProxy.original.facedown && !(adviserProxy instanceof Denizen && adviserProxy.activelyLocked))
                    cards.add(adviserProxy.original);
        }

        new ChooseCardsAction(
            this.actionManager, this.action.player, "Discard an adviser", [cards], 
            (cards: WorldCard[]) => { if (cards[0]) new DiscardCardEffect(this.actionManager, this.action.player, cards[0]).doNext(); }
        ).doNext();
    }
}

export class Insomnia extends RestPower<Denizen> {
    applyAfter(): void {
        new PutResourcesOnTargetEffect(this.actionManager, this.player, Secret, 1).doNext();
    }
}

export class SilverTongue extends RestPower<Denizen> {
    applyAfter(): void {
        const suits: Set<OathSuit> = new Set();
        for (const denizenProxy of this.playerProxy.site.denizens) suits.add(denizenProxy.suit);
        new TakeFavorFromBankAction(this.actionManager, this.player, 1, suits).doNext();
    }
}

export class SleightOfHand extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        const players = this.gameProxy.players.filter(e => e.site === this.action.playerProxy.site).map(e => e.original);
        new TakeResourceFromPlayerAction(this.actionManager, this.action.player, Secret, 1, players).doNext();
    }
}

export class Naysayers extends RestPower<Denizen> {
    applyAfter(): void {
        if (!this.game.oathkeeper.isImperial)
            new TransferResourcesEffect(this.actionManager, this.player, new ResourceCost([[Favor, 1]]), this.player, this.game.chancellor).doNext();
    }
}

export class ChaosCult extends EnemyActionModifier<Denizen, SetNewOathkeeperEffect> {
    modifiedAction = SetNewOathkeeperEffect;

    applyAfter(): void {
        if (!this.source.ruler) return
        new TransferResourcesEffect(this.actionManager, this.source.ruler, new ResourceCost([[Favor, 1]]), this.source.ruler, this.action.executor).doNext();
    }
}

export class GamblingHall extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 2]]);

    usePower(): void {
        new RollDiceEffect(this.actionManager, this.action.player, new DefenseDie(), 4).doNext(result => {
            new TakeFavorFromBankAction(this.actionManager, this.action.player, result.value).doNext();
        });
    }
}

export class Scryer extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new ChooseRegionAction(
            this.actionManager, this.action.player, "Peek at a discard pile",
            (region: Region | undefined) => { if (region) for (const card of region.discard.children) new PeekAtCardEffect(this.actionManager, this.action.player, card).doNext(); }
        ).doNext();
    }
}

export class Charlatan extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        const banner = this.game.banners.get(BannerKey.DarkestSecret);
        if (banner) new TransferResourcesEffect(this.actionManager, this.action.executor, new ResourceCost([], [[Secret, banner.amount - 1]]), undefined, banner).doNext();
    }
}

export class Dissent extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerKey.PeoplesFavor);
        for (const playerProxy of this.gameProxy.players)
            if (peoplesFavorProxy?.owner !== playerProxy)
                new TransferResourcesEffect(this.actionManager, playerProxy.original, new ResourceCost([[Favor, playerProxy.ruledSuits]]), this.source).doNext();
    }
}

export class Riots extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerKey.PeoplesFavor) as PeoplesFavor;
        if (!peoplesFavorProxy?.isMob) return;

        const suitCounts = new NumberMap<OathSuit>();
        for (const siteProxy of this.gameProxy.map.sites())
            for (const denizenProxy of siteProxy.denizens)
                suitCounts.set(denizenProxy.suit, suitCounts.get(denizenProxy.suit) + 1);
        
        let max = 0;
        const suits = new Set<OathSuit>();
        for (const [suit, number] of suitCounts) {
            if (number >= max) {
                if (number > max) suits.clear();
                suits.add(suit);
                max = number;
            }
        }

        new ChooseSuitsAction(
            this.actionManager, this.action.executor, "Discard all other cards at site of the suit with the most",
            (suits: OathSuit[]) => {
                if (suits[0] === undefined) return;
                for (const siteProxy of this.gameProxy.map.sites())
                    for (const denizenProxy of siteProxy.denizens)
                        if (denizenProxy.suit === suits[0] && denizenProxy !== this.sourceProxy)
                            new DiscardCardEffect(this.actionManager, this.action.executor, denizenProxy.original).doNext();
            },
            [suits]
        ).doNext();
    }
}

export class Blackmail extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        const relics = new Set<Relic>();
        for (const playerProxy of this.gameProxy.players) {
            if (playerProxy === this.action.executorProxy || playerProxy.site === this.action.executorProxy.site) continue;
            for (const relicProxy of playerProxy.relics) relics.add(relicProxy.original);
        }

        new ChooseCardsAction(
            this.actionManager, this.action.executor, "Steal a relic unless its owner gives you 3 favor", [relics],
            (cards: Relic[]) => {
                const relic = cards[0];
                if (!relic?.owner) return;
                
                if (relic.owner.byClass(Favor).length < 3)
                    new TakeOwnableObjectEffect(this.actionManager, this.action.executor, relic).doNext();
                else
                    new MakeDecisionAction(
                        this.actionManager, relic.owner, "Let " + this.action.executor.name + " take " + relic.name + ", or give them 3 favor?",
                        () => new TakeOwnableObjectEffect(this.actionManager, this.action.executor, relic).doNext(),
                        () => new TransferResourcesEffect(this.actionManager, relic.owner!, new ResourceCost([[Favor, 3]]), this.action.executor).doNext(),
                        ["Give the relic", "Give 3 favor"]
                    ).doNext();
            }
        ).doNext();
    }
}

export class ASmallFavor extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        new ParentToTargetEffect(this.actionManager, this.action.executor, this.action.executorProxy.leader.original.bag.get(4)).doNext();
    }
}

export class BanditChiefWhenPlayed extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        for (const site of this.game.map.sites())
            new KillWarbandsOnTargetAction(this.actionManager, this.action.executor, site, 1).doNext();
    }
}
export class BanditChief extends ActionModifier<Denizen, OathAction> {
    modifiedAction = OathAction;
    mustUse = true;

    applyWhenApplied(): boolean {
        for (const siteProxy of this.gameProxy.map.sites())
            siteProxy.bandits += 2;

        return true;
    }
}

export class FalseProphet extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        if (this.action.executorProxy?.isImperial) return;

        const visions = new Set<Vision>();
        for (const player of this.game.players)
            if (player.board instanceof ExileBoard && player.board.vision)  // RAW, it doesn't say "another player has revealed"
                visions.add(player.board.vision);

        new ChooseCardsAction(
            this.actionManager, this.action.executor, "Place a warband on a revealed Vision", [visions],
            (cards: OathCard[]) => { if (cards[0]) new ParentToTargetEffect(this.actionManager, this.action.executor, this.action.executorProxy.leader.original.bag.get(1), cards[0]).doNext() }
        ).doNext();
    }
}
export class FalseProphetWake extends WakePower<Denizen> {
    applyWhenApplied(): boolean {
        if (this.action.playerProxy?.isImperial) return true;

        for (const player of this.game.players) {
            if (player.board instanceof ExileBoard && player.board.vision && player.board.vision.getWarbandsAmount(this.action.player.board.key) > 0) {
                const candidates = player.board.vision.oath.getOathkeeperCandidates();
                if (candidates.size === 1 && candidates.has(this.action.player)) {
                    new WinGameEffect(this.actionManager, this.action.player).doNext();
                    return false;
                }
            }
        }

        return true;
    }
}
export class FalseProphetDiscard extends ActionModifier<Denizen, DiscardCardEffect<Vision>> {
    modifiedAction = DiscardCardEffect;
    mustUse = true;

    applyAfter(): void {
        new DrawFromDeckEffect(this.actionManager, this.action.executor, this.action.discardOptions.discard, 1, this.action.discardOptions.onBottom).doNext(cards => {
            const card = cards[0];
            if (!(card instanceof Vision)) return;
            new SearchPlayOrDiscardAction(this.actionManager, this.action.executor, card).doNext();
        })
    }
}

export class RoyalAmbitions extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        if (!(this.action.playerProxy.board instanceof ExileBoard)) return;
        if (this.action.executorProxy.ruledSites > this.gameProxy.chancellor.ruledSites)
            new MakeDecisionAction(this.actionManager, this.action.executor, "Become a Citizen?", () => {
                new BecomeCitizenEffect(this.actionManager, this.action.executor).doNext(); 
                new TakeReliquaryRelicAction(this.actionManager, this.action.executor).doNext();
            }).doNext();
    }
}

export class SaltTheEarth extends CapacityModifier<Denizen> {
    canUse(player: OathPlayer, site?: Site): boolean {
        return site === this.source.site;
    }

    updateCapacityInformation(targetProxy: Set<WorldCard>): [number, Iterable<WorldCard>] {
        return [0, [this.sourceProxy]];  // Also takes care of discarding and checking for locked cards
    }
}

export class Downtrodden extends Accessed(ActionModifier<Denizen, MusterAction>) {
    modifiedAction = MusterAction;

    applyBefore(): void {
        const minSuits = minInGroup(this.game.byClass(FavorBank), "amount").map(e => e.key);
        if (minSuits.length === 1 && minSuits[0] === this.action.cardProxy.suit)
            this.action.getting += 2;
    }
}

export class BoilingLake extends EnemyActionModifier<Denizen, TravelAction> {
    modifiedAction = TravelAction;

    applyBefore(): void {
        if (this.action.siteProxy == this.sourceProxy.site)
            new KillWarbandsOnTargetAction(this.actionManager, this.action.player, this.action.player, 2).doNext();
    }
}

export class Gossip extends EnemyActionModifier<Denizen, SearchPlayOrDiscardAction> {
    modifiedAction = SearchPlayOrDiscardAction;

    applyAtStart(): void {
        this.action.selects.choice.filterChoices(e => e !== false);
    }
}

export class BeastTamerAttack extends EnemyAttackerCampaignModifier<Denizen> {
    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, CampaignAttackAction>>): Iterable<ActionModifier<WithPowers, CampaignAttackAction>> {
        for (const modifier of modifiers)
            if (
                modifier instanceof AttackerBattlePlan && modifier.sourceProxy instanceof Denizen && 
                (modifier.sourceProxy.suit === OathSuit.Beast || modifier.sourceProxy.suit === OathSuit.Nomad)
            )
                throw new InvalidActionResolution("Cannot use Beast or Nomad battle plans against the Beast Tamer");
        
        return [];
    }
}
export class BeastTamerDefense extends EnemyDefenderCampaignModifier<Denizen> {
    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, CampaignDefenseAction>>): Iterable<ActionModifier<WithPowers, CampaignDefenseAction>> {
        for (const modifier of modifiers)
            if (
                modifier instanceof DefenderBattlePlan && modifier.sourceProxy instanceof Denizen && 
                (modifier.sourceProxy.suit === OathSuit.Beast || modifier.sourceProxy.suit === OathSuit.Nomad)
            )
                throw new InvalidActionResolution("Cannot use Beast or Nomad battle plans against the Beast Tamer");

        return [];
    }
}

export class Enchantress extends ActivePower<Denizen> {
    cost = new ResourceCost([], [[Secret, 1]]);

    usePower(): void {
        const cards = new Set<WorldCard>();
        for (const playerProxy of this.gameProxy.players) {
            if (playerProxy === this.action.playerProxy || playerProxy.site !== this.action.playerProxy.site) continue;
            for (const adviserProxy of playerProxy.advisers)
                if (!adviserProxy.original.facedown && !(adviserProxy instanceof Denizen && adviserProxy.activelyLocked))
                    cards.add(adviserProxy.original);
        }

        new ChooseCardsAction(
            this.actionManager, this.action.player, "Swap with an adviser", [cards], 
            (cards: WorldCard[]) => {
                if (!cards[0]) return;
                const otherPlayer = cards[0].owner as OathPlayer;
                new MoveWorldCardToAdvisersEffect(this.actionManager, otherPlayer, this.source).doNext();
                new MoveWorldCardToAdvisersEffect(this.actionManager, this.action.player, cards[0]).doNext();
            }
        ).doNext();
    }
}

export class SneakAttack extends EnemyActionModifier<Denizen, CampaignEndAction> {
    modifiedAction = CampaignEndAction;

    applyBefore(): void {
        const ruler = this.sourceProxy.ruler?.original;
        if (!ruler) return;

        new MakeDecisionAction(
            this.actionManager, ruler, "Campaign against " + this.action.player.name + "?",
            () => { new CampaignAttackAction(this.actionManager, ruler, this.action.player).doNext(); }
        ).doNext();
    }
}

export class VowOfRenewal extends ActionModifier<Denizen, TransferResourcesEffect> {
    modifiedAction = TransferResourcesEffect;
    mustUse = true;

    applyAtEnd(): void {
        if (!this.sourceProxy.ruler) return;
        const amount = this.action.cost.burntResources.get(Favor);
        if (!amount) return;
        new PutResourcesOnTargetEffect(this.actionManager, this.sourceProxy.ruler.original, Favor, amount).doNext();
    }
}
export class VowOfRenewalRecover extends Accessed(ActionModifier<Denizen, RecoverAction>) {
    modifiedAction = RecoverAction;
    mustUse = true;

    applyAtStart(): void {
        this.action.selects.targetProxy.filterChoices(e => e !== this.gameProxy.banners.get(BannerKey.PeoplesFavor));
    }
}


export class FestivalDistrict extends ActivePower<Denizen> {
    usePower(): void {
        new StartBindingExchangeAction(this.actionManager, this.action.player, FestivalDistrictOfferAction).doNext();
    }
}

export class SqualidDistrict extends ActionModifier<Edifice, RollDiceEffect<D6>> {
    modifiedAction = RollDiceEffect;
    mustUse = true;

    canUse(): boolean {
        return !!this.sourceProxy.ruler && this.action.result.die instanceof D6;
    }

    applyAfter(): void {
        const result = this.action.result;
        new ChooseNumberAction(
            this.actionManager, this.sourceProxy.ruler!.original, "Add to " + result.value, [1, 0, -1],
            (value: number) => result.rolls = [[result.value + value]],
        ).doNext();
    }
}