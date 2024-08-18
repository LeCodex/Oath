import { TradeAction, TakeResourceFromPlayerAction, TakeFavorFromBankAction, CampaignEndAction, ModifiableAction, MakeDecisionAction, CampaignAttackAction, InvalidActionResolution, RecoverAction, ChooseSuitsAction, ChooseCardsAction } from "../../actions/actions";
import { Denizen, Edifice, Relic, WorldCard } from "../../cards/cards";
import { TakeWarbandsIntoBagEffect, TakeResourcesFromBankEffect, PlayVisionEffect, PlayWorldCardEffect, OathEffect, PeekAtCardEffect, DiscardCardEffect, PutWarbandsFromBagEffect, BecomeCitizenEffect, SetPeoplesFavorMobState, PutResourcesIntoBankEffect, GainSupplyEffect, MoveBankResourcesEffect, DrawFromDeckEffect, TakeOwnableObjectEffect } from "../../effects";
import { OathResource, BannerName, OathSuit, ALL_OATH_SUITS } from "../../enums";
import { ResourceCost } from "../../resources";
import { maxInGroup, minInGroup } from "../../utils";
import { DefenderBattlePlan, AccessedActionModifier, ActivePower, WhenPlayed, EnemyEffectModifier, EnemyActionModifier, AccessedEffectModifier, AttackerBattlePlan, ActionModifier, EffectModifier } from "../powers";


export class TravelingDoctorAttack extends AttackerBattlePlan<Denizen> {
    name = "Traveling Doctor";

    applyBefore(): void {
        this.action.campaignResult.attackerKillsNoWarbands = true;
        this.action.campaignResult.onSuccessful(false, () => new DiscardCardEffect(this.activator, this.source).do());
    }
}
export class TravelingDoctorDefense extends DefenderBattlePlan<Denizen> {
    name = "Traveling Doctor";

    applyBefore(): void {
        this.action.campaignResult.defenderKillsNoWarbands = true;
        this.action.campaignResult.onSuccessful(true, () => new DiscardCardEffect(this.activator, this.source).do());
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
    cost = new ResourceCost([[OathResource.Favor, 2]]);

    applyBefore(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerName.PeoplesFavor);
        if (peoplesFavorProxy?.owner?.original === this.action.campaignResult.defender) return;
        this.action.campaignResult.atkPool += 3;
        this.action.campaignResult.ignoreSkulls = true;
    }
}
export class TheGreatLevyDefense extends DefenderBattlePlan<Denizen> {
    name = "The Great Levy";
    cost = new ResourceCost([[OathResource.Favor, 2]]);

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
                new PutWarbandsFromBagEffect(this.activator.leader, this.action.campaignResult.attackerLoss, this.source.site).do();
        });
    }
}
export class HospitalDefense extends DefenderBattlePlan<Denizen> {
    name = "Hospital";

    applyBefore(): void {
        this.action.campaignResult.atEnd(() => {
            if (this.sourceProxy.site?.ruler === this.activatorProxy.leader)
                new PutWarbandsFromBagEffect(this.activator.leader, this.action.campaignResult.defenderLoss, this.source.site).do();
        });
    }
}

export class HeartsAndMinds extends DefenderBattlePlan<Denizen> {
    name = "Hearts and Minds";
    cost = new ResourceCost([[OathResource.Favor, 3]]);

    applyWhenApplied(): boolean {
        // TODO: Put this in an effect
        this.action.campaignResult.successful = false;
        this.action.next.doNext();

        if (this.action.gameProxy.banners.get(BannerName.PeoplesFavor)?.owner !== this.activatorProxy)
            this.action.campaignResult.discardAtEnd(this.source);

        return false;
    }
}

export class ExtraProvisions extends DefenderBattlePlan<Denizen> {
    name = "Extra Provisions";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.defPool += 1;
    }
}

export class AwaitedReturn extends AccessedActionModifier<Denizen> {
    name = "Awaited Return";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyBefore(): void {
        // NOTE: I am enforcing that you can only sacrifice warbands of your leader's color
        // while *technically* this restriction doesn't exist but making it an action seems overkill
        if (new TakeWarbandsIntoBagEffect(this.activator.leader, 1).do() > 0)
            this.action.noSupplyCost = true;
    }
}

export class CharmingFriend extends ActivePower<Denizen> {
    name = "Charming Friend";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        const players = Object.values(this.gameProxy.players).filter(e => e.site === this.action.playerProxy.site).map(e => e.original);
        new TakeResourceFromPlayerAction(this.action.player, OathResource.Favor, 1, players).doNext();
    }
}

export class FabledFeast extends WhenPlayed<Denizen> {
    name = "Fabled Feast";

    whenPlayed(): void {
        new TakeResourcesFromBankEffect(this.game, this.effect.player, this.game.favorBanks.get(OathSuit.Hearth), this.effect.playerProxy.suitRuledCount(OathSuit.Hearth)).do();
    }
}

export class SaladDays extends WhenPlayed<Denizen> {
    name = "Salad Days";

    whenPlayed(): void {
        new ChooseSuitsAction(
            this.effect.player, "Take 1 favor from three different banks",
            (suits: OathSuit[]) => { for (const suit of suits) new TakeResourcesFromBankEffect(this.game, this.effect.player, this.game.favorBanks.get(suit), 1).do(); },
            undefined,
            [[3]]
        ).doNext();
    }
}

export class FamilyHeirloom extends WhenPlayed<Denizen> {
    name = "Family Heirloom";

    whenPlayed(): void {
        const relic = new DrawFromDeckEffect(this.effect.player, this.game.relicDeck, 1).do()[0];
        if (!relic) return;
        
        new MakeDecisionAction(
            this.effect.player, "Keep the relic?",
            () => new TakeOwnableObjectEffect(this.game, this.effect.player, relic).do(),
            () => relic.putOnBottom(this.effect.player)
        ).doNext();
    }
}

export class BookBinders extends EnemyEffectModifier<Denizen> {
    name = "Book Binders";
    modifiedEffect = PlayVisionEffect;
    effect: PlayVisionEffect;

    applyAfter(result: void): void {
        if (!this.sourceProxy.ruler?.original) return;
        new TakeFavorFromBankAction(this.sourceProxy.ruler?.original, 2).doNext();
    }
}

export class SaddleMakers extends EnemyEffectModifier<Denizen> {
    name = "Saddle Makers";
    modifiedEffect = PlayWorldCardEffect;
    effect: PlayWorldCardEffect;

    applyAfter(result: void): void {
        if (!this.sourceProxy.ruler?.original) return;
        if (this.effect.facedown || !(this.effect.card instanceof Denizen)) return;

        const cardProxy = this.effect.maskProxyManager.get(this.effect.card);
        if (cardProxy.suit === OathSuit.Nomad || cardProxy.suit === OathSuit.Order)
            new TakeResourcesFromBankEffect(this.effect.game, this.sourceProxy.ruler?.original, this.effect.game.favorBanks.get(cardProxy.suit), 2).do();
    }
}

export class Herald extends EnemyActionModifier<Denizen> {
    name = "Herald";
    modifiedAction = CampaignEndAction;
    action: CampaignEndAction;
    mustUse = true;

    applyAfter(): void {
        if (!this.sourceProxy.ruler?.original) return;
        if (!this.action.campaignResult.defender) return;
        new TakeFavorFromBankAction(this.sourceProxy.ruler?.original, 1).doNext();
    }
}

export class MarriageActionModifier extends ActionModifier<Denizen> {
    name = "Marriage";
    modifiedAction = ModifiableAction;
    action: ModifiableAction;
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
export class MarriageEffect extends EffectModifier<Denizen> {
    name = "Marriage";
    modifiedEffect = OathEffect;
    effect: OathEffect<any>;
    mustUse = true;

    applyWhenApplied(): void {
        const rulerProxy = this.sourceProxy.ruler;
        if (!rulerProxy) return;
        const originalFn = rulerProxy.suitAdviserCount.bind(rulerProxy);
        rulerProxy.suitAdviserCount = (suit: OathSuit) => {
            return originalFn(suit) + (suit === OathSuit.Hearth ? 1 : 0);
        };
    }
}

export class TavernSongs extends ActivePower<Denizen> {
    name = "Tavern Songs";

    usePower(): void {
        for (let i = 0; i < 3; i++) {
            const card = this.action.player.site.region.discard.cards[i];
            if (card) new PeekAtCardEffect(this.action.player, card).do();
        }
    }
}

export class BallotBox extends ActivePower<Denizen> {
    name = "Ballot Box";

    usePower(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerName.PeoplesFavor);
        if (peoplesFavorProxy?.owner !== this.action.playerProxy) return;
        new MakeDecisionAction(this.action.player, "Become a Citizen?", () => new BecomeCitizenEffect(this.action.player).do());
    }
}

export class Storyteller extends ActivePower<Denizen> {
    name = "Storyteller";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        new PutResourcesIntoBankEffect(this.game, undefined, this.game.banners.get(BannerName.DarkestSecret), 1).do();
    }
}

export class WaysideInn extends ActivePower<Denizen> {
    name = "Wayside Inn";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        new GainSupplyEffect(this.action.player, 2).do();
    }
}

export class MemoryOfHome extends ActivePower<Denizen> {
    name = "Memory Of Home";
    cost = new ResourceCost([], [[OathResource.Secret, 1]]);

    usePower(): void {
        new ChooseSuitsAction(
            this.action.player, "Move all favor from one bank to the Hearth bank",
            (suits: OathSuit[]) => {
                if (!suits.length) return;
                const from = this.game.favorBanks.get(suits[0]);
                const to = this.game.favorBanks.get(OathSuit.Hearth);
                if (!from || !to) return;
                new MoveBankResourcesEffect(this.game, this.action.player, from, to, Infinity).do();
            }
        ).doNext();
    }
}

export class ArmedMob extends ActivePower<Denizen> {
    name = "Armed Mob";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerName.DarkestSecret);
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerName.PeoplesFavor);
        if (!darkestSecretProxy?.owner) return;
        if (darkestSecretProxy.owner === peoplesFavorProxy?.owner) return;

        const cards = new Set<WorldCard>();
        for (const adviserProxy of darkestSecretProxy.owner.advisers)
            if (!adviserProxy.original.facedown && !(adviserProxy instanceof Denizen && adviserProxy.activelyLocked))
                cards.add(adviserProxy.original);

        new ChooseCardsAction(
            this.action.player, "Discard an adviser", [cards], 
            (cards: WorldCard[]) => { if (cards.length) new DiscardCardEffect(this.action.player, cards[0]).do(); }
        ).doNext();
    }
}

export class ARoundOfAle extends ActivePower<Denizen> {
    name = "A Round of Ale";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        this.action.player.returnResources();
        new TakeResourcesFromBankEffect(this.game, this.action.player, this.game.favorBanks.get(OathSuit.Hearth), 1, this.source).do();
    }
}

export class Levelers extends ActivePower<Denizen> {
    name = "Levelers";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        const maxSuits = new Set(maxInGroup(ALL_OATH_SUITS, e => this.game.favorBanks.get(e)?.amount || 0));
        const minSuits = new Set(minInGroup(ALL_OATH_SUITS, e => this.game.favorBanks.get(e)?.amount || Infinity));

        new ChooseSuitsAction(
            this.action.player, "Move 2 favor from a bank with the most favor to a bank with the least",
            (maxTargets: OathSuit[], minTargets: OathSuit[]) => {
                if (!minTargets.length || !maxTargets.length) return;
                const from = this.game.favorBanks.get(maxTargets[0]);
                const to = this.game.favorBanks.get(minTargets[0]);
                if (!from || !to) return;
                new MoveBankResourcesEffect(this.game, this.action.player, from, to, 2).do();
            },
            [maxSuits, minSuits]
        ).doNext();
    }
}

export class RelicBreaker extends ActivePower<Denizen> {
    name = "Relic Breaker";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        new ChooseCardsAction(
            this.action.player, "Discard a relic to gain 3 warbands", [[...this.action.playerProxy.site.relics].map(e => e.original)],
            (cards: Relic[]) => {
                if (!cards.length) return;
                cards[0].putOnBottom(this.action.player);
                new PutWarbandsFromBagEffect(this.action.playerProxy.leader.original, 3, this.action.player).do();
            }
        ).doNext();
    }
}


export class HallOfDebate extends ActionModifier<Edifice> {
    name = "Hall of Debate";
    modifiedAction = CampaignAttackAction;
    action: CampaignAttackAction;

    applyBefore(): void {
        const peoplesFavor = this.game.banners.get(BannerName.PeoplesFavor);
        if (peoplesFavor && this.action.campaignResult.targets.has(peoplesFavor))
            throw new InvalidActionResolution("Cannot target the People's Favor in campaigns with the Hall of Debate");
    }
}

export class HallOfMockery extends ActionModifier<Edifice> {
    name = "Hall of Mockery";
    modifiedAction = RecoverAction;
    action: RecoverAction;

    applyAfter(): void {
        if (this.action.targetProxy === this.gameProxy.banners.get(BannerName.PeoplesFavor))
            new SetPeoplesFavorMobState(this.game, undefined, true).do();
    }
}
