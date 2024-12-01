import { TradeAction, TakeResourceFromPlayerAction, TakeFavorFromBankAction, CampaignEndAction, MakeDecisionAction, CampaignAttackAction, RecoverAction, ChooseSuitsAction, ChooseCardsAction, MusterAction, SearchPlayOrDiscardAction, MayDiscardACardAction, SearchAction, SearchChooseAction, KillWarbandsOnTargetAction } from "../../actions/actions";
import { ModifiableAction, InvalidActionResolution } from "../../actions/base";
import { Denizen, Edifice, Relic, WorldCard } from "../../cards/cards";
import { DieSymbol } from "../../dice";
import { PlayVisionEffect, PlayWorldCardEffect, PeekAtCardEffect, DiscardCardEffect, BecomeCitizenEffect, SetPeoplesFavorMobState, GainSupplyEffect, DrawFromDeckEffect, TakeOwnableObjectEffect, MoveDenizenToSiteEffect, ParentToTargetEffect, PutResourcesOnTargetEffect } from "../../actions/effects";
import { BannerName, OathSuit, ALL_OATH_SUITS } from "../../enums";
import { WithPowers } from "../../interfaces";
import { Favor, ResourceCost, Secret } from "../../resources";
import { maxInGroup, minInGroup } from "../../utils";
import { DefenderBattlePlan, AccessedActionModifier, ActivePower, WhenPlayed, EnemyActionModifier, AttackerBattlePlan, ActionModifier, EnemyDefenderCampaignModifier } from "../powers";


export class TravelingDoctorAttack extends AttackerBattlePlan<Denizen> {
    name = "Traveling Doctor";

    applyBefore(): void {
        this.action.campaignResult.attackerKillsNoWarbands = true;
        this.action.campaignResult.onAttackWin(() => new DiscardCardEffect(this.activator, this.source).doNext());
    }
}
export class TravelingDoctorDefense extends DefenderBattlePlan<Denizen> {
    name = "Traveling Doctor";

    applyBefore(): void {
        this.action.campaignResult.defenderKillsNoWarbands = true;
        this.action.campaignResult.onDefenseWin(() => new DiscardCardEffect(this.activator, this.source).doNext());
    }
}

export class VillageConstableAttack extends AttackerBattlePlan<Denizen> {
    name = "Village Constable";

    applyBefore(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerName.PeoplesFavor);
        if (peoplesFavorProxy?.owner?.original === this.action.campaignResult.defender) return;
        this.action.campaignResult.atkPool += 2;
    }
}
export class VillageConstableDefense extends DefenderBattlePlan<Denizen> {
    name = "Village Constable";

    applyBefore(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerName.PeoplesFavor);
        if (peoplesFavorProxy?.owner?.original === this.action.campaignResult.attacker) return;
        this.action.campaignResult.atkPool -= 2;
    }
}

export class TheGreatLevyAttack extends AttackerBattlePlan<Denizen> {
    name = "The Great Levy";
    cost = new ResourceCost([[Favor, 2]]);

    applyBefore(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerName.PeoplesFavor);
        if (peoplesFavorProxy?.owner?.original === this.action.campaignResult.defender) return;
        this.action.campaignResult.atkPool += 3;
        this.action.campaignResult.atkRoll.ignore.add(DieSymbol.Skull);
    }
}
export class TheGreatLevyDefense extends DefenderBattlePlan<Denizen> {
    name = "The Great Levy";
    cost = new ResourceCost([[Favor, 2]]);

    applyBefore(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerName.PeoplesFavor);
        if (peoplesFavorProxy?.owner?.original === this.action.campaignResult.attacker) return;
        this.action.campaignResult.atkPool -= 3;
    }
}

export class HospitalAttack extends AttackerBattlePlan<Denizen> {
    name = "Hospital";

    applyBefore(): void {
        this.action.campaignResult.atEnd(() => {
            if (this.sourceProxy.site?.ruler === this.activatorProxy.leader)
                new ParentToTargetEffect(this.game, this.activator.leader, this.activatorProxy.leader.original.bag.get(this.action.campaignResult.attackerLoss), this.source.site).doNext();
        });
    }
}
export class HospitalDefense extends DefenderBattlePlan<Denizen> {
    name = "Hospital";

    applyBefore(): void {
        this.action.campaignResult.atEnd(() => {
            if (this.sourceProxy.site?.ruler === this.activatorProxy.leader)
                new ParentToTargetEffect(this.game, this.activator.leader, this.activatorProxy.leader.original.bag.get(this.action.campaignResult.defenderLoss), this.source.site).doNext();
        });
    }
}

export class HeartsAndMinds extends DefenderBattlePlan<Denizen> {
    name = "Hearts and Minds";
    cost = new ResourceCost([[Favor, 3]]);

    applyWhenApplied(): boolean {
        // TODO: Put this in an effect
        this.action.campaignResult.successful = false;
        this.action.next.doNext();

        if (this.gameProxy.banners.get(BannerName.PeoplesFavor)?.owner !== this.activatorProxy)
            this.action.campaignResult.discardAtEnd(this.source);

        return false;
    }
}

export class ExtraProvisions extends DefenderBattlePlan<Denizen> {
    name = "Extra Provisions";
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.defPool += 1;
    }
}

export class AwaitedReturn extends AccessedActionModifier<Denizen, TradeAction> {
    name = "Awaited Return";
    modifiedAction = TradeAction;

    applyBefore(): void {
        if (this.activator.warbands.length) {
            new KillWarbandsOnTargetAction(this.activator, this.activator, 1).doNext();
            this.action.noSupplyCost = true;
        }
    }
}

export class RowdyPub extends AccessedActionModifier<Denizen, MusterAction> {
    name = "Rowdy Pub";
    modifiedAction = MusterAction;
    mustUse = true;  // Nicer to have it automatically apply

    applyBefore(): void {
        if (this.action.cardProxy === this.sourceProxy)
            this.action.getting++;
    }
}

export class CropRotation extends AccessedActionModifier<Denizen, SearchPlayOrDiscardAction> {
    name = "Crop Rotation";
    modifiedAction = SearchPlayOrDiscardAction;
    mustUse = true;  // Nicer to have it automatically apply

    applyBefore(): void {
        if (this.action.siteProxy)
            new MayDiscardACardAction(this.activator, this.action.discardOptions, this.action.siteProxy.denizens).doNext();
    }
}

export class NewsFromAfar extends AccessedActionModifier<Denizen, SearchAction> {
    name = "News From Afar";
    modifiedAction = SearchAction;
    cost = new ResourceCost([[Favor, 2]]);

    applyBefore(): void {
        this.action.noSupplyCost = true;
    }
}

export class CharmingFriend extends ActivePower<Denizen> {
    name = "Charming Friend";
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const players = this.gameProxy.players.filter(e => e.site === this.action.playerProxy.site).map(e => e.original);
        new TakeResourceFromPlayerAction(this.action.player, Favor, 1, players).doNext();
    }
}

export class FabledFeast extends WhenPlayed<Denizen> {
    name = "Fabled Feast";

    whenPlayed(): void {
        const bank = this.game.favorBank(OathSuit.Hearth);
        if (bank) new ParentToTargetEffect(this.game, this.action.executor, bank.get(this.action.executorProxy.suitRuledCount(OathSuit.Hearth))).doNext();
    }
}

export class SaladDays extends WhenPlayed<Denizen> {
    name = "Salad Days";

    whenPlayed(): void {
        new ChooseSuitsAction(
            this.action.executor, "Take 1 favor from three different banks",
            (suits: OathSuit[]) => { 
                for (const suit of suits) {
                    const bank = this.game.favorBank(OathSuit.Hearth);
                    if (bank) new ParentToTargetEffect(this.game, this.action.executor, bank.get(1)).doNext(); 
                }
            },
            undefined,
            [[3]]
        ).doNext();
    }
}

export class FamilyHeirloom extends WhenPlayed<Denizen> {
    name = "Family Heirloom";

    whenPlayed(): void {
        new DrawFromDeckEffect(this.action.executor, this.game.relicDeck, 1).doNext(cards => {
            const relic = cards[0];
            if (!relic) return;
            
            new MakeDecisionAction(
                this.action.executor, "Keep the relic?",
                () => new TakeOwnableObjectEffect(this.game, this.action.executor, relic).doNext(),
                () => relic.putOnBottom(this.action.executor)
            ).doNext();
        });
    }
}

export class VowOfPeace extends AccessedActionModifier<Denizen, CampaignAttackAction> {
    name = "Vow of Peace";
    modifiedAction = CampaignAttackAction;
    mustUse = true;

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, CampaignAttackAction>>): Iterable<ActionModifier<WithPowers, CampaignAttackAction>> {
        throw new InvalidActionResolution("Cannot campaign under the Vow of Peace");
    }
}
export class VowOfPeaceDefense extends EnemyDefenderCampaignModifier<Denizen> {
    name = "Vow of Peace";

    applyBefore(): void {
        this.action.campaignResult.sacrificeValue = 0;
    }
}

export class BookBinders extends EnemyActionModifier<Denizen, PlayVisionEffect> {
    name = "Book Binders";
    modifiedAction = PlayVisionEffect;

    applyAfter(): void {
        if (!this.sourceProxy.ruler?.original) return;
        new TakeFavorFromBankAction(this.sourceProxy.ruler?.original, 2).doNext();
    }
}

export class SaddleMakers extends EnemyActionModifier<Denizen, PlayWorldCardEffect> {
    name = "Saddle Makers";
    modifiedAction = PlayWorldCardEffect;

    applyAfter(): void {
        if (!this.sourceProxy.ruler?.original) return;
        if (this.action.facedown || !(this.action.card instanceof Denizen)) return;

        const cardProxy = this.action.maskProxyManager.get(this.action.card);
        if (cardProxy.suit === OathSuit.Nomad || cardProxy.suit === OathSuit.Order) {
            const bank = this.game.favorBank(cardProxy.suit);
            if (bank) new ParentToTargetEffect(this.action.game, this.sourceProxy.ruler?.original, bank.get(2)).doNext();
        }
    }
}

export class Herald extends EnemyActionModifier<Denizen, CampaignEndAction> {
    name = "Herald";
    modifiedAction = CampaignEndAction;
    mustUse = true;

    applyAfter(): void {
        if (!this.sourceProxy.ruler?.original) return;
        if (!this.action.campaignResult.defender) return;
        new TakeFavorFromBankAction(this.sourceProxy.ruler?.original, 1).doNext();
    }
}

export class Marriage extends ActionModifier<Denizen, ModifiableAction> {
    name = "Marriage";
    modifiedAction = ModifiableAction;
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

export class LandWarden extends AccessedActionModifier<Denizen, SearchChooseAction> {
    name = "Land Warden";
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

export class WelcomingParty extends AccessedActionModifier<Denizen, SearchChooseAction> {
    name = "Welcoming Party";
    modifiedAction = SearchChooseAction;

    applyAfter(): void {
        for (const playAction of this.action.playActions)
            playAction.applyModifiers([new WelcomingPartyPlay(this.source, playAction, this.activator)]);
    }
}
export class WelcomingPartyPlay extends ActionModifier<Denizen, SearchPlayOrDiscardAction> {
    name = "Welcoming Party";
    modifiedAction = SearchPlayOrDiscardAction;

    applyAfter(): void {
        const bank = this.game.favorBank(OathSuit.Hearth)
        if (bank) new ParentToTargetEffect(this.game, this.activator, bank.get(1)).doNext();
    }
}

export class Homesteaders extends ActivePower<Denizen> {
    name = "Homesteaders";

    usePower(): void {
        new ChooseCardsAction(
            this.action.player, "Move a faceup adviser to your site",
            [[...this.action.playerProxy.advisers].filter(e => e instanceof Denizen && !e.facedown).map(e => e.original)],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                new MoveDenizenToSiteEffect(this.game, this.action.player, cards[0], this.action.playerProxy.site.original).doNext()
            }
        ).doNext();
    }
}

export class TavernSongs extends ActivePower<Denizen> {
    name = "Tavern Songs";

    usePower(): void {
        for (let i = 0; i < 3; i++) {
            const card = this.action.player.site.region?.discard.children[i];
            if (card) new PeekAtCardEffect(this.action.player, card).doNext();
        }
    }
}

export class BallotBox extends ActivePower<Denizen> {
    name = "Ballot Box";

    usePower(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerName.PeoplesFavor);
        if (peoplesFavorProxy?.owner !== this.action.playerProxy) return;
        new MakeDecisionAction(this.action.player, "Become a Citizen?", () => new BecomeCitizenEffect(this.action.player).doNext());
    }
}

export class Storyteller extends ActivePower<Denizen> {
    name = "Storyteller";
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.player, Secret, 1, this.game.banners.get(BannerName.DarkestSecret)).doNext();
    }
}

export class WaysideInn extends ActivePower<Denizen> {
    name = "Wayside Inn";
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new GainSupplyEffect(this.action.player, 2).doNext();
    }
}

export class MemoryOfHome extends ActivePower<Denizen> {
    name = "Memory of Home";
    cost = new ResourceCost([], [[Secret, 1]]);

    usePower(): void {
        new ChooseSuitsAction(
            this.action.player, "Move all favor from one bank to the Hearth bank",
            (suits: OathSuit[]) => {
                if (!suits[0]) return;
                const from = this.game.favorBank(suits[0]);
                const to = this.game.favorBank(OathSuit.Hearth);
                if (!from || !to) return;
                new ParentToTargetEffect(this.game, this.action.player, from.get(Infinity), to).doNext();
            }
        ).doNext();
    }
}

export class ArmedMob extends ActivePower<Denizen> {
    name = "Armed Mob";
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerName.DarkestSecret);
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerName.PeoplesFavor);
        if (!darkestSecretProxy?.owner || darkestSecretProxy.owner === peoplesFavorProxy?.owner) return;

        const cards = new Set<WorldCard>();
        for (const adviserProxy of darkestSecretProxy.owner.advisers)
            if (!adviserProxy.original.facedown && !(adviserProxy instanceof Denizen && adviserProxy.activelyLocked))
                cards.add(adviserProxy.original);

        new ChooseCardsAction(
            this.action.player, "Discard an adviser", [cards], 
            (cards: WorldCard[]) => { if (cards[0]) new DiscardCardEffect(this.action.player, cards[0]).doNext(); }
        ).doNext();
    }
}

export class ARoundOfAle extends ActivePower<Denizen> {
    name = "A Round of Ale";
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        this.action.player.returnResources();
        const bank = this.game.favorBank(OathSuit.Hearth);
        if (bank) new ParentToTargetEffect(this.game, this.action.player, bank.get(1), this.source).doNext();
    }
}

export class Levelers extends ActivePower<Denizen> {
    name = "Levelers";
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const maxSuits = new Set(maxInGroup(ALL_OATH_SUITS, e => this.game.favorBank(e)?.amount ?? 0));
        const minSuits = new Set(minInGroup(ALL_OATH_SUITS, e => this.game.favorBank(e)?.amount ?? Infinity));

        new ChooseSuitsAction(
            this.action.player, "Move 2 favor from a bank with the most favor to a bank with the least",
            (maxTargets: OathSuit[], minTargets: OathSuit[]) => {
                if (!minTargets[0] || !maxTargets[0]) return;
                const from = this.game.favorBank(maxTargets[0]);
                const to = this.game.favorBank(minTargets[0]);
                if (!from || !to) return;
                new ParentToTargetEffect(this.game, this.action.player, from.get(2), to).doNext();
            },
            [maxSuits, minSuits]
        ).doNext();
    }
}

export class RelicBreaker extends ActivePower<Denizen> {
    name = "Relic Breaker";
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new ChooseCardsAction(
            this.action.player, "Discard a relic to gain 3 warbands", [[...this.action.playerProxy.site.relics].map(e => e.original)],
            (cards: Relic[]) => {
                if (!cards[0]) return;
                cards[0].putOnBottom(this.action.player);
                new ParentToTargetEffect(this.game, this.action.player, this.action.playerProxy.leader.original.bag.get(3)).doNext();
            }
        ).doNext();
    }
}


export class HallOfDebate extends ActionModifier<Edifice, CampaignAttackAction> {
    name = "Hall of Debate";
    modifiedAction = CampaignAttackAction;
    mustUse = true;

    applyBefore(): void {
        const peoplesFavor = this.game.banners.get(BannerName.PeoplesFavor);
        if (peoplesFavor && this.action.campaignResult.targets.has(peoplesFavor))
            throw new InvalidActionResolution("Cannot target the People's Favor in campaigns with the Hall of Debate");
    }
}

export class HallOfMockery extends ActionModifier<Edifice, RecoverAction> {
    name = "Hall of Mockery";
    modifiedAction = RecoverAction;
    mustUse = true;

    applyAfter(): void {
        if (this.action.targetProxy === this.gameProxy.banners.get(BannerName.PeoplesFavor))
            new SetPeoplesFavorMobState(this.game, undefined, true).doNext();
    }
}
