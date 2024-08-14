import { InvalidActionResolution, ModifiableAction, TakeFavorFromBankAction, AskForRerollAction, TakeResourceFromPlayerAction, PiedPiperAction, ActAsIfAtSiteAction, TradeAction, SearchAction, SearchPlayAction, CampaignAtttackAction, CampaignDefenseAction, TravelAction, CampaignEndAction } from "../actions/actions";
import { Denizen, Site, WorldCard, Vision, Relic } from "../cards/cards";
import { DefenseDie } from "../dice";
import { PayCostToTargetEffect, PlayWorldCardEffect, MoveResourcesToTargetEffect, RegionDiscardEffect, PutResourcesOnTargetEffect, RollDiceEffect, TakeWarbandsIntoBagEffect, TakeResourcesFromBankEffect, PlayVisionEffect, OathEffect, TakeOwnableObjectEffect, PayPowerCost, PutWarbandsFromBagEffect, SetNewOathkeeperEffect, GamblingHallEffect, PeekAtCardEffect } from "../effects";
import { OathResource, OathSuit, BannerName } from "../enums";
import { OathPlayer, OwnableObject, isOwnable } from "../player";
import { ResourceCost } from "../resources";
import { CapacityModifier, AttackerBattlePlan, DefenderBattlePlan, EnemyActionModifier, EnemyEffectModifier, WhenPlayed, AccessedActionModifier, RestPower, ActionModifier, ActivePower, EffectModifier, AccessedEffectModifier, OathPower } from "./powers";


// ------------------ GENERAL ------------------- //
export class IgnoresCapacity extends CapacityModifier<Denizen> {
    name = "Ignores Capacity";

    canUse(player: OathPlayer, site?: Site): boolean {
        return player === this.source.ruler;
    }

    ignoreCapacity(cardProxy: WorldCard): boolean {
        return !cardProxy.facedown && cardProxy === this.sourceProxy;
    }
}


// ------------------ ORDER ------------------- //
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


export class ShieldWall extends DefenderBattlePlan<Denizen> {
    name = "Shield Wall";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.defPool += 2;
        this.action.campaignResult.defenderKillsEntireForce = true;
    }
}


export class Curfew extends EnemyActionModifier<Denizen> {
    name = "Curfew";
    modifiedAction = TradeAction;
    action: TradeAction;
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.action.playerProxy.site?.ruler === this.sourceProxy.ruler;
    }

    applyBefore(): void {
        if (!new PayCostToTargetEffect(this.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.sourceProxy.ruler?.original).do())
            throw new InvalidActionResolution("Cannot pay the Curfew.");
    }
}

export class TollRoads extends EnemyActionModifier<Denizen> {
    name = "Toll Roads";
    modifiedAction = TravelAction;
    action: TravelAction;

    applyBefore(): void {
        if (this.action.siteProxy.ruler === this.sourceProxy.ruler)
            if (!new PayCostToTargetEffect(this.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.sourceProxy.ruler?.original).do())
                throw new InvalidActionResolution("Cannot pay the Toll Roads.");
    }
}

export class ForcedLabor extends EnemyActionModifier<Denizen> {
    name = "Forced Labor";
    modifiedAction = SearchAction;
    action: SearchAction;
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.action.playerProxy.site?.ruler === this.sourceProxy.ruler;
    }

    applyBefore(): void {
        if (!new PayCostToTargetEffect(this.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.sourceProxy.ruler?.original).do())
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
        new TakeFavorFromBankAction(this.action.player, 1).doNext();
    }
}


// ------------------ ARCANE ------------------- //
export class GleamingArmorAttack extends ActionModifier<Denizen> {
    name = "Gleaming Armor";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;
    mustUse = true;

    canUse(): boolean {
        return this.action.campaignResult.defender === this.sourceProxy.ruler?.original;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        for (const modifier of modifiers)
            if (modifier instanceof AttackerBattlePlan)
                modifier.cost.add(new ResourceCost([[OathResource.Secret, 1]]));

        return [];
    }
}
export class GleamingArmorDefense extends ActionModifier<Denizen> {
    name = "Gleaming Armor";
    modifiedAction = CampaignDefenseAction;
    action: CampaignDefenseAction;
    mustUse = true;

    canUse(): boolean {
        return this.action.campaignResult.attacker === this.sourceProxy.ruler?.original;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        for (const modifier of modifiers)
            if (modifier instanceof DefenderBattlePlan)
                modifier.cost.add(new ResourceCost([[OathResource.Secret, 1]]));

        return [];
    }
}


export class SpiritSnare extends ActivePower<Denizen> {
    name = "Spirit Snare";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        new TakeFavorFromBankAction(this.action.player, 1).doNext();
    }
}


export class Dazzle extends WhenPlayed<Denizen> {
    name = "Dazzle";

    whenPlayed(): void {
        new RegionDiscardEffect(this.effect.player, [OathSuit.Hearth, OathSuit.Order], this.source).do();
    }
}


export class Tutor extends ActivePower<Denizen> {
    name = "Tutor";
    cost = new ResourceCost([[OathResource.Favor, 1], [OathResource.Secret, 1]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.action.game, this.action.player, OathResource.Secret, 1).do();
    }
}


export class Alchemist extends ActivePower<Denizen> {
    name = "Alchemist";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Secret, 1]]);

    usePower(): void {
        for (let i = 0; i < 4; i++) new TakeFavorFromBankAction(this.action.player, 1).doNext();
    }
}


export class ActingTroupe extends AccessedActionModifier<Denizen> {
    name = "Acting Troupe";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyBefore(): void {
        if (this.action.cardProxy.suit === OathSuit.Order || this.action.cardProxy.suit === OathSuit.Beast)
            this.sourceProxy.suit = this.action.cardProxy.suit;
    }
}


export class Jinx extends EffectModifier<Denizen> {
    name = "Jinx";
    modifiedEffect = RollDiceEffect;
    effect: RollDiceEffect;
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    canUse(): boolean {
        return !!this.effect.playerProxy && this.effect.playerProxy.rules(this.sourceProxy) && !(!this.sourceProxy.empty && this.gameProxy.currentPlayer === this.effect.playerProxy);
    }

    applyAfter(result: number[]): void {
        if (!this.effect.player) return;
        new AskForRerollAction(this.effect.player, result, this.effect.die, this).doNext();
    }
}

export class Portal extends AccessedActionModifier<Denizen> {
    name = "Portal";
    modifiedAction = TravelAction;
    action: TravelAction;
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        return [...modifiers].filter(e => e.source instanceof Site);
    }

    applyBefore(): void {
        if (this.action.playerProxy.site !== this.sourceProxy.site && this.action.siteProxy !== this.sourceProxy.site)
            throw new InvalidActionResolution("When using the Portal, you must travel to or from its site");

        this.action.noSupplyCost = true;
    }
}


// ------------------ HEARTH ------------------- //
export class HeartsAndMinds extends DefenderBattlePlan<Denizen> {
    name = "Hearts and Minds";
    cost = new ResourceCost([[OathResource.Favor, 3]]);

    applyWhenApplied(): boolean {
        // TODO: Put this in an effect
        this.action.campaignResult.successful = false;
        this.action.next.doNext();

        if (this.action.gameProxy.banners.get(BannerName.PeoplesFavor)?.owner !== this.action.playerProxy)
            this.action.campaignResult.discardAtEnd(this.source);

        return false;
    }
}


export class AwaitedReturn extends AccessedActionModifier<Denizen> {
    name = "Awaited Return";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyBefore(): void {
        // NOTE: I am enforcing that you can only sacrifice warbands of your leader's color
        // while *technically* this restriction doesn't exist but making it an action seems overkill
        if (new TakeWarbandsIntoBagEffect(this.action.player, 1).do() > 0)
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
    name = "FabledFeast";

    whenPlayed(): void {
        new TakeResourcesFromBankEffect(this.game, this.effect.player, this.game.favorBanks.get(OathSuit.Hearth), this.effect.playerProxy.ruledSuitCount(OathSuit.Hearth)).do();
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


export class MarriageActionModifier extends AccessedActionModifier<Denizen> {
    name = "Marriage";
    modifiedAction = ModifiableAction;
    action: ModifiableAction;
    mustUse = true;

    applyWhenApplied(): boolean {
        const originalFn = this.action.playerProxy.adviserSuitCount.bind(this.action.playerProxy);
        this.action.playerProxy.adviserSuitCount = (suit: OathSuit) => {
            return originalFn(suit) + (suit === OathSuit.Hearth ? 1 : 0);
        };
        return true;
    }
}

export class MarriageEffectModifier extends AccessedEffectModifier<Denizen> {
    name = "Marriage";
    modifiedEffect = OathEffect;
    effect: OathEffect<any>;
    mustUse = true;

    applyWhenApplied(): void {
        if (!this.effect.playerProxy) return;
        const originalFn = this.effect.playerProxy.adviserSuitCount.bind(this.effect.playerProxy);
        this.effect.playerProxy.adviserSuitCount = (suit: OathSuit) => {
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


// ------------------ NOMAD ------------------- //
export class WayStation extends ActionModifier<Denizen> {
    name = "Way Station";
    modifiedAction = TravelAction;
    action: TravelAction;

    applyBefore(): void {
        if (!this.sourceProxy.site) return;
        if (this.action.siteProxy === this.sourceProxy.site) {
            if (!this.action.playerProxy.rules(this.sourceProxy)) return;
            if (!new PayCostToTargetEffect(this.action.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.sourceProxy.ruler?.original).do()) return;
            this.action.noSupplyCost = true;
        }
    }
}


function lostTongueCheckOwnable(sourceProxy: Denizen, targetProxy: OwnableObject, playerProxy: OathPlayer | undefined) {
    if (!sourceProxy.ruler) return;
    if (!playerProxy) return;
    if (targetProxy.owner !== sourceProxy.ruler) return;

    if (playerProxy.ruledSuitCount(OathSuit.Nomad) < 1)
        throw new InvalidActionResolution(`Cannot target or take objects from ${sourceProxy.ruler.name} without understanding the Lost Tongue.`);
}

export class LostTongue extends EnemyEffectModifier<Denizen> {
    name = "Lost Tongue";
    modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect;

    applyBefore(): void {
        const targetProxy = this.effect.maskProxyManager.get(this.effect.target);
        lostTongueCheckOwnable(this.sourceProxy, targetProxy, this.effect.playerProxy);
    }
}

export class LostTongueCampaign extends EnemyActionModifier<Denizen> {
    name = "Lost Tongue";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (isOwnable(target)) {
                const targetProxy = this.action.maskProxyManager.get(target);
                lostTongueCheckOwnable(this.sourceProxy, targetProxy, this.action.playerProxy);
            }
        }
    }
}


export class Elders extends ActivePower<Denizen> {
    name = "Elders";
    cost = new ResourceCost([[OathResource.Favor, 2]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.action.game, this.action.player, OathResource.Secret, 1).do();
    }
}


export class SpellBreaker extends EnemyEffectModifier<Denizen> {
    name = "Spell Breaker";
    modifiedEffect = PayPowerCost;
    effect: PayPowerCost;

    applyBefore(): void {
        if (this.effect.power.cost.totalResources.get(OathResource.Secret))
            throw new InvalidActionResolution("Cannot use powers that cost Secrets under the Spell Breaker");
    }
}


export class FamilyWagon extends CapacityModifier<Denizen> {
    name = "Family Wagon";

    canUse(player: OathPlayer, site?: Site): boolean {
        return player === this.source.ruler && !site;
    }

    updateCapacityInformation(targetProxy: Set<WorldCard>): [number, Iterable<WorldCard>] {
        // NOTE: This is technically different from the way Family Wagon is worded. The way *this* works
        // is by setting the capacity to 2, and making all *other* Nomad cards not count towards the limit (effectively
        // making you have 1 spot for a non Nomad card, and infinite ones for Nomad cards, while allowing you
        // to replace Family Wagon if you want to)
        return [2, [...targetProxy].filter(e => e !== this.sourceProxy && e instanceof Denizen && e.suit === OathSuit.Nomad)];
    }

    ignoreCapacity(cardProxy: WorldCard): boolean {
        return cardProxy !== this.sourceProxy && cardProxy instanceof Denizen && cardProxy.suit === OathSuit.Nomad;
    }
}


// ------------------ DISCORD ------------------- //
export class RelicThief extends EnemyEffectModifier<Denizen> {
    name = "Relic Thief";
    modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect;

    applyAfter(result: void): void {
        if (!this.sourceProxy.ruler?.original) return;
        if (this.effect.target instanceof Relic && this.effect.playerProxy?.site.region === this.sourceProxy.ruler?.site.region) {
            // Roll dice and do stuff, probably after an action to pay the cost
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

        new PutWarbandsFromBagEffect(this.effect.player, 1, this.source.site).do();
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
        // Action to choose a player to discard from
    }
}

export class Insomnia extends RestPower<Denizen> {
    name = "Insomnia";

    applyAfter(): void {
        new PutResourcesOnTargetEffect(this.action.game, this.action.player, OathResource.Secret, 1).do();
    }
}

export class SilverTongue extends RestPower<Denizen> {
    name = "Silver Tongue";

    applyAfter(): void {
        const suits: Set<OathSuit> = new Set();
        for (const denizenProxy of this.action.playerProxy.site.denizens) suits.add(denizenProxy.suit);
        new TakeFavorFromBankAction(this.action.player, 1, suits).doNext();
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
            new MoveResourcesToTargetEffect(this.action.game, this.action.player, OathResource.Favor, 1, this.action.player, this.action.game.chancellor).do();
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


// ------------------ BEAST ------------------- //
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
