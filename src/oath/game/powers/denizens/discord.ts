import { MakeDecisionAction, ChooseCardsAction, ChooseRegionAction, InvalidActionResolution, TakeFavorFromBankAction, TakeResourceFromPlayerAction, ChooseSuitsAction, ModifiableAction, SearchPlayOrDiscardAction, MusterAction, TravelAction, CampaignAction, KillWarbandsOnTargetAction, CampaignDefenseAction, CampaignAttackAction, CampaignEndAction, RecoverAction } from "../../actions/actions";
import { PeoplesFavor } from "../../banks";
import { Region } from "../../board";
import { Denizen, OathCard, Relic, Site, Vision, WorldCard } from "../../cards/cards";
import { D6, DefenseDie } from "../../dice";
import { TakeOwnableObjectEffect, TakeWarbandsIntoBagEffect, PutWarbandsFromBagEffect, PutResourcesOnTargetEffect, MoveResourcesToTargetEffect, SetNewOathkeeperEffect, RollDiceEffect, GamblingHallEffect, TakeResourcesFromBankEffect, DiscardCardEffect, BecomeCitizenEffect, PayCostToTargetEffect, PeekAtCardEffect, OathEffect, WinGameEffect, DrawFromDeckEffect, MoveAdviserEffect, MoveWorldCardToAdvisersEffect } from "../../effects";
import { BannerName, OathResource, OathSuit } from "../../enums";
import { Exile, OathPlayer } from "../../player";
import { ResourceCost } from "../../resources";
import { EnemyEffectModifier, WhenPlayed, CapacityModifier, ActivePower, RestPower, AttackerBattlePlan, DefenderBattlePlan, EffectModifier, ActionModifier, AccessedActionModifier, WakePower, EnemyActionModifier } from "../powers";
import { minInGroup } from "../../utils";


export class MercenariesAttack extends AttackerBattlePlan<Denizen> {
    name = "Mercenaries";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool += 3;
        this.action.campaignResult.onSuccessful(false, () => new DiscardCardEffect(this.activator, this.source).do());
    }
}
export class MercenariesDefense extends DefenderBattlePlan<Denizen> {
    name = "Mercenaries";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool -= 3;
        this.action.campaignResult.onSuccessful(true, () => new DiscardCardEffect(this.activator, this.source).do());
    }
}

export class CrackedSageAttack extends AttackerBattlePlan<Denizen> {
    name = "Disgraced Captain";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Favor, 1]]);

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
    name = "Disgraced Captain";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Favor, 1]]);

    applyBefore(): void {
        for (const adviser of this.action.campaignResult.attacker.advisers) {
            if (!(adviser instanceof Denizen) || adviser.suit !== OathSuit.Arcane) continue;
            this.action.campaignResult.atkPool -= 4;
            break;
        }
    }
}

export class DisgracedCaptain extends AttackerBattlePlan<Denizen> {
    name = "Disgraced Captain";
    cost = new ResourceCost([[OathResource.Favor, 1]], [[OathResource.Favor, 1]]);

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
    name = "Book Burning";

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, () => {
            const defender = this.action.campaignResult.defender;
            if (!defender) return;
            new MoveResourcesToTargetEffect(this.game, defender, OathResource.Secret, defender.getResources(OathResource.Secret) - 1, undefined).do()
        });
    }
}

export class Slander extends AttackerBattlePlan<Denizen> {
    name = "Slander";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, () => {
            const defender = this.action.campaignResult.defender;
            if (!defender) return;
            new MoveResourcesToTargetEffect(this.game, defender, OathResource.Favor, Infinity, undefined).do();
        });
    }
}

export class SecondWind extends AttackerBattlePlan<Denizen> {
    name = "Second Wind";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, () => {
            new MakeDecisionAction(
                this.action.player, "Take a Travel action?",
                () => {
                    const travelAction = new TravelAction(this.action.player);
                    travelAction._noSupplyCost = true;
                    travelAction.doNext();
                }
            ).doNext();

            new MakeDecisionAction(
                this.action.player, "Take a Campaign action?",
                () => {
                    const campaignAction = new CampaignAction(this.action.player);
                    campaignAction._noSupplyCost = true;
                    campaignAction.doNext();
                }
            ).doNext();
        });
    }
}

export class Zealots extends AttackerBattlePlan<Denizen> {
    name = "Zealots";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyAtEnd(): void {
        if (this.action.campaignResult.totalAtkForce < this.action.campaignResult.totalDefForce)
            this.action.campaignResult.sacrificeValue = 3;
    }
}

export class RelicThief extends EnemyEffectModifier<Denizen> {
    name = "Relic Thief";
    modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect;

    applyAfter(result: void): void {
        // TODO: Trigger when multiple things are taken
        const rulerProxy = this.sourceProxy.ruler;
        if (!rulerProxy) return;
        if (this.effect.target instanceof Relic && this.effect.playerProxy?.site.region === rulerProxy.site.region) {
            new MakeDecisionAction(
                rulerProxy.original, "Try to steal " + this.effect.target.name + "?",
                () => {
                    if (!new PayCostToTargetEffect(this.game, rulerProxy.original, new ResourceCost([[OathResource.Favor, 1], [OathResource.Secret, 1]]), this.source).do())
                        throw new InvalidActionResolution("Couldn't pay resource cost");

                    const result = new RollDiceEffect(this.game, rulerProxy.original, DefenseDie, 1).do();
                    // TODO: Handle result
                }
            )
        }
    }
}

export class KeyToTheCity extends WhenPlayed<Denizen> {
    name = "Key to the City";

    whenPlayed(): void {
        if (!this.source.site || !this.sourceProxy.site) return;
        if (this.sourceProxy.site.ruler?.site === this.sourceProxy.site) return;

        for (const [player, amount] of this.source.site.warbands)
            new TakeWarbandsIntoBagEffect(player, amount, this.source.site).do();

        new PutWarbandsFromBagEffect(this.effect.playerProxy.leader.original, 1, this.source.site).do();
    }
}

export class OnlyTwoAdvisers extends CapacityModifier<Denizen> {
    name = "Only Two Advisers";

    canUse(player: OathPlayer, site?: Site): boolean {
        return player === this.source.ruler && !site;
    }

    updateCapacityInformation(targetProxy: Set<WorldCard>): [number, Iterable<WorldCard>] {
        return [2, []];
    }
}

export class Assassin extends ActivePower<Denizen> {
    name = "Assassin";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        const cards = new Set<WorldCard>();
        for (const playerProxy of Object.values(this.gameProxy.players)) {
            if (playerProxy === this.action.playerProxy || playerProxy.site !== this.action.playerProxy.site) continue;
            for (const adviserProxy of playerProxy.advisers)
                if (!adviserProxy.original.facedown && !(adviserProxy instanceof Denizen && adviserProxy.activelyLocked))
                    cards.add(adviserProxy.original);
        }

        new ChooseCardsAction(
            this.action.player, "Discard an adviser", [cards], 
            (cards: WorldCard[]) => { if (cards.length) new DiscardCardEffect(this.action.player, cards[0]).do(); }
        ).doNext();
    }
}

export class Insomnia extends RestPower<Denizen> {
    name = "Insomnia";

    applyAfter(): void {
        new PutResourcesOnTargetEffect(this.action.game, this.activator, OathResource.Secret, 1).do();
    }
}

export class SilverTongue extends RestPower<Denizen> {
    name = "Silver Tongue";

    applyAfter(): void {
        const suits: Set<OathSuit> = new Set();
        for (const denizenProxy of this.activatorProxy.site.denizens) suits.add(denizenProxy.suit);
        new TakeFavorFromBankAction(this.activator, 1, suits).doNext();
    }
}

export class SleightOfHand extends ActivePower<Denizen> {
    name = "Sleight of Hand";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        const players = Object.values(this.gameProxy.players).filter(e => e.site === this.action.playerProxy.site).map(e => e.original);
        new TakeResourceFromPlayerAction(this.action.player, OathResource.Secret, 1, players).doNext();
    }
}

export class Naysayers extends RestPower<Denizen> {
    name = "Naysayers";

    applyAfter(): void {
        if (!this.action.game.oathkeeper.isImperial)
            new MoveResourcesToTargetEffect(this.action.game, this.activator, OathResource.Favor, 1, this.activator, this.action.game.chancellor).do();
    }
}

export class ChaosCult extends EnemyEffectModifier<Denizen> {
    name = "Chaos Cult";
    modifiedEffect = SetNewOathkeeperEffect;
    effect: SetNewOathkeeperEffect;

    applyAfter(result: void): void {
        new MoveResourcesToTargetEffect(this.effect.game, this.source.ruler, OathResource.Favor, 1, this.source.ruler, this.effect.player).do();
    }
}

export class GamblingHall extends ActivePower<Denizen> {
    name = "Gambling Hall";
    cost = new ResourceCost([[OathResource.Favor, 2]]);

    usePower(): void {
        const faces = new RollDiceEffect(this.action.game, this.action.player, DefenseDie, 4).do();
        new GamblingHallEffect(this.action.player, faces).doNext();
    }
}

export class Scryer extends ActivePower<Denizen> {
    name = "Scryer";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        new ChooseRegionAction(
            this.action.player, "Peek at a discard pile",
            (region: Region | undefined) => { if (region) for (const card of region.discard.cards) new PeekAtCardEffect(this.action.player, card).do(); }
        ).doNext();
    }
}

export class Charlatan extends WhenPlayed<Denizen> {
    name = "Charlatan";

    whenPlayed(): void {
        new TakeResourcesFromBankEffect(this.game, this.effect.player, this.game.banners.get(BannerName.DarkestSecret), Infinity, undefined);
    }
}

export class Dissent extends WhenPlayed<Denizen> {
    name = "Dissent";

    whenPlayed(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerName.PeoplesFavor);
        for (const playerProxy of Object.values(this.gameProxy.players))
            if (peoplesFavorProxy?.owner !== playerProxy)
                new MoveResourcesToTargetEffect(this.game, playerProxy.original, OathResource.Favor, playerProxy.ruledSuits, this.source);
    }
}

export class Riots extends WhenPlayed<Denizen> {
    name = "Riots";

    whenPlayed(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerName.PeoplesFavor) as PeoplesFavor;
        if (!peoplesFavorProxy?.isMob) return;

        const suitCounts = new Map<OathSuit, number>();
        for (const siteProxy of this.gameProxy.board.sites())
            for (const denizenProxy of siteProxy.denizens)
                suitCounts.set(denizenProxy.suit, (suitCounts.get(denizenProxy.suit) || 0) + 1);
        
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
            this.effect.player, "Discard all other cards at site of the suit with the most",
            (suits: OathSuit[]) => {
                if (!suits.length) return;
                for (const siteProxy of this.gameProxy.board.sites())
                    for (const denizenProxy of siteProxy.denizens)
                        if (denizenProxy.suit === suits[0] && denizenProxy !== this.sourceProxy)
                            new DiscardCardEffect(this.effect.player, denizenProxy.original).do();
            },
            [suits]
        ).doNext();
    }
}

export class Blackmail extends WhenPlayed<Denizen> {
    name = "Blackmail";

    whenPlayed(): void {
        const relics = new Set<Relic>();
        for (const playerProxy of Object.values(this.gameProxy.players)) {
            if (playerProxy === this.effect.playerProxy || playerProxy.site === this.effect.playerProxy.site) continue;
            for (const relicProxy of playerProxy.relics) relics.add(relicProxy.original);
        }

        new ChooseCardsAction(
            this.effect.player, "Steal a relic unless its owner gives you 3 favor", [relics],
            (cards: Relic[]) => {
                const relic = cards[0];
                if (!relic?.owner) return;
                
                if (relic.owner.getResources(OathResource.Favor) < 3)
                    new TakeOwnableObjectEffect(this.game, this.effect.player, relic).do();
                else
                    new MakeDecisionAction(
                        relic.owner, "Let " + this.effect.player.name + " take " + relic.name + ", or give them 3 favor?",
                        () => new TakeOwnableObjectEffect(this.game, this.effect.player, relic).do(),
                        () => new MoveResourcesToTargetEffect(this.game, relic.owner, OathResource.Favor, 3, this.effect.player).do(),
                        ["Give the relic", "Give 3 favor"]
                    ).doNext();
            }
        ).doNext();
    }
}

export class ASmallFavor extends WhenPlayed<Denizen> {
    name = "ASmallFavor";

    whenPlayed(): void {
        new PutWarbandsFromBagEffect(this.effect.playerProxy.leader.original, 4).do();
    }
}

export class BanditChief extends WhenPlayed<Denizen> {
    name = "Bandit Chief";

    whenPlayed(): void {
        for (const site of this.game.board.sites())
            new KillWarbandsOnTargetAction(this.effect.player, site, 1).doNext();
    }
}
export class BanditChiefAction extends ActionModifier<Denizen> {
    name = "Bandit Chief";
    modifiedAction = ModifiableAction;
    action: ModifiableAction;
    mustUse = true;

    applyWhenApplied(): boolean {
        for (const siteProxy of this.gameProxy.board.sites())
            siteProxy.bandits += 2;

        return true;
    }
}
export class BanditChiefEffect extends EffectModifier<Denizen> {
    name = "Bandit Chief";
    modifiedEffect = OathEffect;
    effect: OathEffect<any>;

    applyWhenApplied(): boolean {
        for (const siteProxy of this.gameProxy.board.sites())
            siteProxy.bandits += 2;
        
        return true;
    }
}

export class FalseProphet extends WhenPlayed<Denizen> {
    name = "False Prophet";

    whenPlayed(): void {
        if (this.effect.playerProxy?.isImperial) return;

        const visions = new Set<Vision>();
        for (const player of Object.values(this.game.players))
            if (player instanceof Exile && player.vision)  // RAW, it doesn't say "another player has revealed"
                visions.add(player.vision);

        new ChooseCardsAction(
            this.effect.player, "Place a warband on a revealed Vision", [visions],
            (cards: OathCard[]) => { if (cards.length) new PutWarbandsFromBagEffect(this.effect.player, 1, cards[0]).do() }
        ).doNext();
    }
}
export class FalseProphetWake extends WakePower<Denizen> {
    name = "False Prophet";

    applyWhenApplied(): boolean {
        if (this.action.playerProxy?.isImperial) return true;

        for (const player of Object.values(this.game.players)) {
            if (player instanceof Exile && player.vision && player.vision.getWarbands(this.action.player) > 0) {
                const candidates = player.vision.oath.getOathkeeperCandidates();
                if (candidates.size === 1 && candidates.has(this.action.player)) {
                    new WinGameEffect(this.action.player).do();
                    return false;
                }
            }
        }

        return true;
    }
}
export class FalseProphetDiscard extends EffectModifier<Denizen> {
    name = "False Prophet";
    modifiedEffect = DiscardCardEffect;
    effect: DiscardCardEffect<Vision>;

    applyAfter(result: void): void {
        const card = new DrawFromDeckEffect(this.effect.player, this.effect.discardOptions.discard, 1, this.effect.discardOptions.onBottom).do()[0];
        if (!card || !(card instanceof Vision)) return;
        new SearchPlayOrDiscardAction(this.effect.player, card).doNext();
    }
}

export class RoyalAmbitions extends WhenPlayed<Denizen> {
    name = "Royal Ambitions";

    whenPlayed(): void {
        if (this.effect.playerProxy.ruledSites > this.gameProxy.chancellor.ruledSites)
            new MakeDecisionAction(this.effect.player, "Become a Citizen?", () => {
                // TODO: Take a reliquary relic
                new BecomeCitizenEffect(this.effect.player).do(); 
            }).doNext();
    }
}

export class SaltTheEarth extends CapacityModifier<Denizen> {
    name = "Salt the Earth";

    canUse(player: OathPlayer, site?: Site): boolean {
        return site === this.source.site;
    }

    updateCapacityInformation(targetProxy: Set<WorldCard>): [number, Iterable<WorldCard>] {
        return [0, [this.sourceProxy]];  // Also takes care of discarding and checking for locked cards
    }
}

export class Downtrodden extends AccessedActionModifier<Denizen> {
    name = "Downtrodden";
    modifiedAction = MusterAction;
    action: MusterAction;

    applyBefore(): void {
        let minSuits = minInGroup(this.game.favorBanks, ([_, v]) => v.amount).map(([k, _]) => k);
        if (minSuits.length === 1 && minSuits[0] === this.action.cardProxy.suit)
            this.action.amount += 2;
    }
}

export class BoilingLake extends EnemyActionModifier<Denizen> {
    name = "Boiling Lake";
    modifiedAction = TravelAction;
    action: TravelAction;

    applyBefore(): void {
        new KillWarbandsOnTargetAction(this.action.player, this.action.player, 2).doNext();
    }
}

export class Gossip extends EnemyActionModifier<Denizen> {
    name = "Gossip";
    modifiedAction = SearchPlayOrDiscardAction;
    action: SearchPlayOrDiscardAction;

    applyBefore(): void {
        if (this.action.facedown)
            throw new InvalidActionResolution("Cannot play cards facedown under the Gossip");
    }
}

export class BeastTamerAttack extends EnemyActionModifier<Denizen> {
    name = "Beast Tamer";
    modifiedAction = CampaignAttackAction;
    action: CampaignAttackAction;

    applyBefore(): void {
        for (const modifier of this.action.modifiers)
            if (
                modifier instanceof DefenderBattlePlan && modifier.sourceProxy instanceof Denizen && 
                (modifier.sourceProxy.suit === OathSuit.Beast || modifier.sourceProxy.suit === OathSuit.Nomad)
            )
                throw new InvalidActionResolution("Cannot use Beast or Nomad defender battle plans");
    }
}
export class BeastTamerDefense extends EnemyActionModifier<Denizen> {
    name = "Beast Tamer";
    modifiedAction = CampaignDefenseAction;
    action: CampaignDefenseAction;

    applyBefore(): void {
        for (const modifier of this.action.modifiers)
            if (
                modifier instanceof DefenderBattlePlan && modifier.sourceProxy instanceof Denizen && 
                (modifier.sourceProxy.suit === OathSuit.Beast || modifier.sourceProxy.suit === OathSuit.Nomad)
            )
                throw new InvalidActionResolution("Cannot use Beast or Nomad defender battle plans");
    }
}

export class Enchantress extends ActivePower<Denizen> {
    name = "Enchantress";
    cost = new ResourceCost([], [[OathResource.Secret, 1]]);

    usePower(): void {
        const cards = new Set<WorldCard>();
        for (const playerProxy of Object.values(this.gameProxy.players)) {
            if (playerProxy === this.action.playerProxy || playerProxy.site !== this.action.playerProxy.site) continue;
            for (const adviserProxy of playerProxy.advisers)
                if (!adviserProxy.original.facedown && !(adviserProxy instanceof Denizen && adviserProxy.activelyLocked))
                    cards.add(adviserProxy.original);
        }

        new ChooseCardsAction(
            this.action.player, "Swap with an adviser", [cards], 
            (cards: WorldCard[]) => {
                if (cards.length) return;
                const otherPlayer = cards[0].owner as OathPlayer;
                const enchantress = new MoveAdviserEffect(this.game, this.action.player, this.source).do();
                const otherCard = new MoveAdviserEffect(this.game, this.action.player, cards[0]).do();
                new MoveWorldCardToAdvisersEffect(this.game, otherPlayer, enchantress).do();
                new MoveWorldCardToAdvisersEffect(this.game, this.action.player, otherCard).do();
            }
        ).doNext();
    }
}

export class SneakAttack extends ActionModifier<Denizen> {
    name = "Sneak Attack";
    modifiedAction = CampaignEndAction;
    action: CampaignEndAction;

    applyBefore(): void {
        const ruler = this.sourceProxy.ruler?.original;
        if (!ruler || ruler === this.action.player) return;

        new MakeDecisionAction(
            ruler, "Campaign against " + this.action.player.name + "?",
            () => { new CampaignAttackAction(ruler, this.action.player).doNext(); }
        )
    }
}

export class VowOfRenewal extends EffectModifier<Denizen> {
    name = "Vow of Renewal";
    modifiedEffect = MoveResourcesToTargetEffect;
    effect: MoveResourcesToTargetEffect;

    applyAfter(): void {
        if (this.effect.resource === OathResource.Favor && !this.effect.target && this.sourceProxy.ruler)
            new PutResourcesOnTargetEffect(this.game, this.sourceProxy.ruler.original, OathResource.Favor, this.effect.amount).do();
    }
}
export class VowOfRenewalRecover extends AccessedActionModifier<Denizen> {
    name = "Vow of Renewal";
    modifiedAction = RecoverAction;
    action: RecoverAction;

    applyBefore(): void {
        if (this.action.targetProxy === this.gameProxy.banners.get(BannerName.PeoplesFavor))
            throw new InvalidActionResolution("Cannot recover the People's Favor with the Vow of Renewal");
    }
}


export class SqualidDistrict extends EffectModifier<Denizen> {
    name = "Squalid District";
    modifiedEffect = RollDiceEffect;
    effect: RollDiceEffect;

    canUse(): boolean {
        return !!this.effect.playerProxy && this.effect.playerProxy === this.sourceProxy.ruler;
    }

    applyAfter(result: number[]): void {
        const player = this.effect.player;
        if (!player) return;
        if (this.effect.die !== D6) return;

        new MakeDecisionAction(player, "Add +1 or -1 to " + result[0] + "?", () => result[0]++, () => result[0]--, ["+1", "-1"]).doNext();
    }
}