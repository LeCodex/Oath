import { TradeAction, TakeResourceFromPlayerAction, TakeFavorFromBankAction, CampaignEndAction, MakeDecisionAction, CampaignAttackAction, ChooseSuitsAction, ChooseCardsAction, MusterAction, SearchPlayOrDiscardAction, MayDiscardACardAction, SearchAction, SearchChooseAction, KillWarbandsOnTargetAction, TinkersFairOfferAction, StartBindingExchangeAction, DeedWriterOfferAction } from "../actions";
import { CampaignEndCallback , InvalidActionResolution } from "../actions/utils";
import { OathAction } from "../actions/base";
import type { Edifice, Relic, WorldCard } from "../model/cards";
import { Denizen } from "../model/cards";
import { PlayVisionEffect, PlayWorldCardEffect, PeekAtCardEffect, DiscardCardEffect, BecomeCitizenEffect, SetPeoplesFavorMobState, GainSupplyEffect, DrawFromDeckEffect, TakeOwnableObjectEffect, MoveDenizenToSiteEffect, ParentToTargetEffect, PutResourcesOnTargetEffect, RecoverTargetEffect, ReturnAllResourcesEffect } from "../actions/effects";
import { BannerKey, OathSuit, ALL_OATH_SUITS, PowerLayers } from "../enums";
import type { WithPowers } from "../model/interfaces";
import { Favor, Secret } from "../model/resources";
import type { SupplyCostContext } from "../costs";
import { ResourceCost } from "../costs";
import { maxInGroup, minInGroup } from "../utils";
import { DefenderBattlePlan, Accessed, ActivePower, WhenPlayed, EnemyActionModifier, AttackerBattlePlan, ActionModifier, EnemyDefenderCampaignModifier, NoSupplyCostActionModifier, SupplyCostModifier } from ".";
import { ExileBoard } from "../model/player";
import { AttackDieSymbol } from "../dice";
import { DiscardOptions } from "../model/decks";


export class TravelingDoctorAttack extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.attackerKillsNoWarbands = true;
        this.action.campaignResult.onDefenseWin(new CampaignEndCallback(
            () => new DiscardCardEffect(this.actionManager, this.player, this.source).doNext(),
            this.source.name
        ));
    }
}
export class TravelingDoctorDefense extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.defenderKillsNoWarbands = true;
        this.action.campaignResult.onAttackWin(new CampaignEndCallback(
            () => new DiscardCardEffect(this.actionManager, this.player, this.source).doNext(),
            this.source.name
        ));
    }
}

export class VillageConstableAttack extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerKey.PeoplesFavor);
        if (peoplesFavorProxy?.owner?.original === this.action.campaignResult.defender) return;
        this.action.campaignResult.atkPool += 2;
    }
}
export class VillageConstableDefense extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerKey.PeoplesFavor);
        if (peoplesFavorProxy?.owner?.original === this.action.campaignResult.attacker) return;
        this.action.campaignResult.atkPool -= 2;
    }
}

export class TheGreatLevyAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 2]]);

    applyBefore(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerKey.PeoplesFavor);
        if (peoplesFavorProxy?.owner?.original === this.action.campaignResult.defender) return;
        this.action.campaignResult.atkPool += 3;
        this.action.campaignResult.atkRoll.ignore.add(AttackDieSymbol.Skull);
    }
}
export class TheGreatLevyDefense extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 2]]);

    applyBefore(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerKey.PeoplesFavor);
        if (peoplesFavorProxy?.owner?.original === this.action.campaignResult.attacker) return;
        this.action.campaignResult.atkPool -= 3;
    }
}

export class HospitalAttack extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.atEnd(new CampaignEndCallback(() => {
            if (this.sourceProxy.site?.ruler === this.playerProxy.leader)
                new ParentToTargetEffect(this.actionManager, this.player.leader, this.playerProxy.leader.original.bag.get(this.action.campaignResult.attackerLoss), this.source.site).doNext();
        }, this.source.name, false));
    }
}
export class HospitalDefense extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.atEnd(new CampaignEndCallback(() => {
            if (this.player && this.playerProxy && this.sourceProxy.site?.ruler === this.playerProxy.leader)
                new ParentToTargetEffect(this.actionManager, this.player.leader, this.playerProxy.leader.original.bag.get(this.action.campaignResult.defenderLoss), this.source.site).doNext();
        }, this.source.name, false));
    }
}

export class HeartsAndMinds extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 3]]);

    applyWhenApplied(): boolean {
        this.action.campaignResult.successful = false;
        this.action.next.doNext();

        if (this.gameProxy.banners.get(BannerKey.PeoplesFavor)?.owner !== this.playerProxy)
            this.action.campaignResult.discardAtEnd(this.source);

        return false;
    }
}

export class ExtraProvisions extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.defPool += 1;
    }
}

export class AwaitedReturn extends Accessed(ActionModifier<Denizen, TradeAction>) {
    modifiedAction = TradeAction;

    applyBefore(): void {
        if (this.player.warbands.length) {
            new KillWarbandsOnTargetAction(this.actionManager, this.player, this.player, 1).doNext();
        }
    }
}
export class AwaitedReturnCost extends NoSupplyCostActionModifier(AwaitedReturn) { }

export class RowdyPub extends Accessed(ActionModifier<Denizen, MusterAction>) {
    modifiedAction = MusterAction;
    mustUse = true;  // Nicer to have it automatically apply

    applyBefore(): void {
        if (this.action.cardProxy === this.sourceProxy)
            this.action.getting++;
    }
}

export class CropRotation extends Accessed(ActionModifier<Denizen, SearchPlayOrDiscardAction>) {
    modifiedAction = SearchPlayOrDiscardAction;
    mustUse = true;  // Nicer to have it automatically apply

    applyBefore(): void {
        if (this.action.siteProxy)
            new MayDiscardACardAction(this.actionManager, this.player, this.action.discardOptions, this.action.siteProxy.denizens).doNext();
    }
}

export class NewsFromAfar extends Accessed(SupplyCostModifier<Denizen>) {
    cost = new ResourceCost([[Favor, 2]]);

    canUse(context: SupplyCostContext): boolean {
        return super.canUse(context) && context.origin instanceof TradeAction;
    }

    apply(context: SupplyCostContext): void {
        context.cost.multiplier = 0;
    }
}

export class CharmingFriend extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const players = this.gameProxy.players.filter((e) => e.site === this.action.playerProxy.site).map((e) => e.original);
        new TakeResourceFromPlayerAction(this.actionManager, this.action.player, Favor, 1, players).doNext();
    }
}

export class FabledFeast extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        const bank = this.game.favorBank(OathSuit.Hearth);
        if (bank) new ParentToTargetEffect(this.actionManager, this.action.player, bank.get(this.action.playerProxy.suitRuledCount(OathSuit.Hearth))).doNext();
    }
}

export class SaladDays extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        new ChooseSuitsAction(
            this.actionManager, this.action.player, "Take 1 favor from three different banks",
            (suits: OathSuit[]) => { 
                for (const suit of suits) {
                    const bank = this.game.favorBank(suit);
                    if (bank) new ParentToTargetEffect(this.actionManager, this.action.player, bank.get(1)).doNext(); 
                }
            },
            undefined,
            [[3]]
        ).doNext();
    }
}

export class FamilyHeirloom extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        new DrawFromDeckEffect(this.actionManager, this.action.player, this.game.relicDeck, 1).doNext((cards) => {
            const relic = cards[0];
            if (!relic) return;
            
            new MakeDecisionAction(
                this.actionManager, this.action.player, "Keep the relic?",
                () => new TakeOwnableObjectEffect(this.actionManager, this.action.player, relic).doNext(),
                () => new DiscardCardEffect(this.actionManager, this.action.player, relic, new DiscardOptions(this.game.relicDeck, true)).doNext()
            ).doNext();
        });
    }
}

export class VowOfPeace extends Accessed(ActionModifier<Denizen, CampaignAttackAction>) {
    modifiedAction = CampaignAttackAction;
    mustUse = true;

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, CampaignAttackAction>>): Iterable<ActionModifier<WithPowers, CampaignAttackAction>> {
        throw new InvalidActionResolution("Cannot campaign under the Vow of Peace");
    }
}
export class VowOfPeaceDefense extends EnemyDefenderCampaignModifier<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.sacrificeValue = 0;
    }
}

export class BookBinders extends EnemyActionModifier<Denizen, PlayVisionEffect> {
    modifiedAction = PlayVisionEffect;

    applyAfter(): void {
        if (!this.sourceProxy.ruler?.original) return;
        new TakeFavorFromBankAction(this.actionManager, this.sourceProxy.ruler?.original, 2).doNext();
    }
}

export class SaddleMakers extends EnemyActionModifier<Denizen, PlayWorldCardEffect> {
    modifiedAction = PlayWorldCardEffect;

    applyAfter(): void {
        if (!this.sourceProxy.ruler?.original) return;
        if (this.action.facedown || !(this.action.card instanceof Denizen)) return;

        const cardProxy = this.action.maskProxyManager.get(this.action.card);
        if (cardProxy.suit === OathSuit.Nomad || cardProxy.suit === OathSuit.Order) {
            const bank = this.game.favorBank(cardProxy.suit);
            if (bank) new ParentToTargetEffect(this.actionManager, this.sourceProxy.ruler?.original, bank.get(2)).doNext();
        }
    }
}

export class Herald extends EnemyActionModifier<Denizen, CampaignEndAction> {
    modifiedAction = CampaignEndAction;
    mustUse = true;

    applyAfter(): void {
        if (!this.sourceProxy.ruler?.original) return;
        if (!this.action.campaignResult.defender) return;
        new TakeFavorFromBankAction(this.actionManager, this.sourceProxy.ruler?.original, 1).doNext();
    }
}

export class Marriage extends ActionModifier<Denizen, OathAction> {
    modifiedAction = OathAction;
    mustUse = true;

    applyWhenApplied(): boolean {
        const rulerProxy = this.sourceProxy.ruler;
        if (!rulerProxy) return true;
        const originalFn = rulerProxy.suitAdviserCount.bind(rulerProxy);
        rulerProxy.suitAdviserCount = (suit: OathSuit) => {
            return originalFn(suit) + (suit === OathSuit.Hearth ? 1 : 0);
        };

        return true;
    }
}

export class LandWarden extends Accessed(ActionModifier<Denizen, SearchChooseAction>) {
    modifiedAction = SearchChooseAction;
    cost = new ResourceCost([[Favor, 1]]);

    applyWhenApplied(): boolean {
        this.action.playingAmount++;
        return true;
    }

    applyAtEnd(): void {
        if (this.action.playing.length > 1) {
            for (const playing of this.action.playing) if (playing instanceof Denizen && playing.site) return;
            throw new InvalidActionResolution("Must play a card to a site with Land Warden");
        }
    }
}

export class WelcomingParty extends Accessed(ActionModifier<Denizen, SearchChooseAction>) {
    modifiedAction = SearchChooseAction;

    applyAfter(): void {
        for (const playAction of this.action.playActions)
            if (playAction.cardProxy instanceof Denizen)
                this.powerManager.futureActionsModifiable.get(playAction)?.applyModifiers([new WelcomingPartyPlay(this.powerManager, this.source, this.player, playAction)]);
    }
}
export class WelcomingPartyPlay extends ActionModifier<Denizen, SearchPlayOrDiscardAction> {
    modifiedAction = SearchPlayOrDiscardAction;

    applyAfter(): void {
        if (this.action.facedown) return;
        const bank = this.game.favorBank(OathSuit.Hearth);
        if (bank) new ParentToTargetEffect(this.actionManager, this.player, bank.get(1)).doNext();
    }
}

export class Homesteaders extends ActivePower<Denizen> {
    usePower(): void {
        new ChooseCardsAction(
            this.actionManager, this.action.player, "Move a faceup adviser to your site",
            [[...this.action.playerProxy.advisers].filter((e) => e instanceof Denizen && !e.facedown).map((e) => e.original)],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                new MoveDenizenToSiteEffect(this.actionManager, this.action.player, cards[0], this.action.playerProxy.site.original).doNext()
            }
        ).doNext();
    }
}

export class TavernSongs extends ActivePower<Denizen> {
    usePower(): void {
        for (let i = 0; i < 3; i++) {
            const card = this.action.player.site.region?.discard.children[i];
            if (card) new PeekAtCardEffect(this.actionManager, this.action.player, card).doNext();
        }
    }
}

export class BallotBox extends ActivePower<Denizen> {
    usePower(): void {
        if (!(this.action.playerProxy.board instanceof ExileBoard)) return;
        
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerKey.PeoplesFavor);
        if (peoplesFavorProxy?.owner !== this.action.playerProxy) return;
        new MakeDecisionAction(
            this.actionManager, this.action.player, "Become a Citizen?",
            () => new BecomeCitizenEffect(this.actionManager, this.action.player).doNext()
        );
    }
}

export class Storyteller extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.actionManager, this.action.player, Secret, 1, this.game.banners.get(BannerKey.DarkestSecret)).doNext();
    }
}

export class WaysideInn extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new GainSupplyEffect(this.actionManager, this.action.player, 2).doNext();
    }
}

export class MemoryOfHome extends ActivePower<Denizen> {
    cost = new ResourceCost([], [[Secret, 1]]);

    usePower(): void {
        new ChooseSuitsAction(
            this.actionManager, this.action.player, "Move all favor from one bank to the Hearth bank",
            (suits: OathSuit[]) => {
                if (suits[0] === undefined) return;
                const from = this.game.favorBank(suits[0]);
                const to = this.game.favorBank(OathSuit.Hearth);
                if (!from || !to) return;
                new ParentToTargetEffect(this.actionManager, this.action.player, from.get(Infinity), to).doNext();
            }
        ).doNext();
    }
}

export class ArmedMob extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerKey.DarkestSecret);
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerKey.PeoplesFavor);
        if (!darkestSecretProxy?.owner || darkestSecretProxy.owner === peoplesFavorProxy?.owner) return;

        const cards = new Set<WorldCard>();
        for (const adviserProxy of darkestSecretProxy.owner.advisers)
            if (!adviserProxy.original.facedown && !(adviserProxy instanceof Denizen && adviserProxy.activelyLocked))
                cards.add(adviserProxy.original);

        new ChooseCardsAction(
            this.actionManager, this.action.player, "Discard an adviser", [cards], 
            (cards: WorldCard[]) => { if (cards[0]) new DiscardCardEffect(this.actionManager, this.action.player, cards[0]).doNext(); }
        ).doNext();
    }
}

export class ARoundOfAle extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new ReturnAllResourcesEffect(this.actionManager, [this.source]).doNext();
    }
}

export class Levelers extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const maxSuits = new Set(maxInGroup(ALL_OATH_SUITS, (e) => this.game.favorBank(e)?.amount ?? 0));
        const minSuits = new Set(minInGroup(ALL_OATH_SUITS, (e) => this.game.favorBank(e)?.amount ?? Infinity));

        new ChooseSuitsAction(
            this.actionManager, this.action.player, "Move 2 favor from a bank with the most favor to a bank with the least",
            (maxTargets: OathSuit[], minTargets: OathSuit[]) => {
                if (!minTargets[0] || !maxTargets[0]) return;
                const from = this.game.favorBank(maxTargets[0]);
                const to = this.game.favorBank(minTargets[0]);
                if (!from || !to) return;
                new ParentToTargetEffect(this.actionManager, this.action.player, from.get(2), to).doNext();
            },
            [maxSuits, minSuits]
        ).doNext();
    }
}

export class RelicBreaker extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new ChooseCardsAction(
            this.actionManager, this.action.player, "Discard a relic to gain 3 warbands", [[...this.action.playerProxy.site.relics].map((e) => e.original)],
            (cards: Relic[]) => {
                if (!cards[0]) return;
                new DiscardCardEffect(this.actionManager, this.action.player, cards[0], new DiscardOptions(this.game.relicDeck, true)).doNext();
                new ParentToTargetEffect(this.actionManager, this.action.player, this.action.playerProxy.leader.original.bag.get(3), this.action.player.board).doNext();
            }
        ).doNext();
    }
}

export class TinkersFair extends ActivePower<Denizen> {
    usePower(): void {
        new StartBindingExchangeAction(this.actionManager, this.action.player, TinkersFairOfferAction).doNext();
    }
}

export class DeedWriter extends ActivePower<Denizen> {
    usePower(): void {
        new StartBindingExchangeAction(this.actionManager, this.action.player, DeedWriterOfferAction).doNext();
    }
}


export class HallOfDebate extends ActionModifier<Edifice, CampaignAttackAction> {
    modifiedAction = CampaignAttackAction;
    mustUse = true;
    order = PowerLayers.FILTERS_CHOICES;

    applyAtStart(): void {
        this.action.selects.targetProxies.filterChoices((e) => e !== this.game.banners.get(BannerKey.PeoplesFavor));
    }
}

export class HallOfMockery extends ActionModifier<Edifice, RecoverTargetEffect> {
    modifiedAction = RecoverTargetEffect;
    mustUse = true;

    applyAfter(): void {
        if (this.action.target === this.gameProxy.banners.get(BannerKey.PeoplesFavor)?.original)
            new SetPeoplesFavorMobState(this.actionManager, undefined, true).doNext();
    }
}
