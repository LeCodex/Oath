import { TradeAction, InvalidActionResolution, SearchAction, SearchPlayAction, TakeFavorFromBankAction, CampaignAtttackAction, CampaignDefenseAction, UsePowerAction, AskForRerollAction, TravelAction, TakeResourceFromPlayerAction, CampaignEndAction, ModifiableAction, PiedPiperAction, ActAsIfAtSiteAction } from "../actions";
import { Denizen, Site, WorldCard, Vision, Relic } from "../cards/cards";
import { DefenseDie } from "../dice";
import { PayCostToTargetEffect, TravelEffect, PlayWorldCardEffect, MoveResourcesToTargetEffect, RegionDiscardEffect, PutResourcesOnTargetEffect, RollDiceEffect, TakeWarbandsIntoBagEffect, TakeResourcesFromBankEffect, PlayVisionEffect, OathEffect, TakeOwnableObjectEffect, PayPowerCost, PutWarbandsFromBagEffect, SetNewOathkeeperEffect, GamblingHallEffect, ApplyWhenPlayedEffect } from "../effects";
import { OathResource, OathSuit, BannerName } from "../enums";
import { OathPlayer, OwnableObject, isOwnable } from "../player";
import { ResourceCost } from "../resources";
import { CapacityModifier, AttackerBattlePlan, DefenderBattlePlan, EnemyActionModifier, EnemyEffectModifier, WhenPlayed, AccessedActionModifier, RestPower, ActionModifier, ActivePower, EffectModifier, AccessedEffectModifier } from "./powers";


// ------------------ GENERAL ------------------- //
export class IgnoresCapacity extends CapacityModifier<Denizen> {
    name = "Ignores Capacity";

    canUse(player: OathPlayer, site?: Site): boolean {
        return player === this.source.ruler;
    }

    ignoreCapacity(card: WorldCard, facedown?: boolean): boolean {
        return !facedown && card === this.source;
    }
}


// ------------------ ORDER ------------------- //
export class LongbowArchersAttack extends AttackerBattlePlan<Denizen> {
    name = "Longbow Archers";

    applyBefore(): void {
        this.action.campaignResult.atkPool++;
    }
}

export class LongbowArchersDefense extends DefenderBattlePlan<Denizen> {
    name = "Longbow Archers";

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

    applyBefore(): void {
        if (this.action.player.site?.ruler?.original === this.source.ruler?.original) {
            if (!new PayCostToTargetEffect(this.action.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
                throw new InvalidActionResolution("Cannot pay the Curfew.");
        }
    }
}

export class TollRoads extends EnemyEffectModifier<Denizen> {
    name = "Toll Roads";
    modifiedEffect = TravelEffect;
    effect: TravelEffect;

    applyDuring(): void {
        if (this.effect.site.ruler?.original === this.source.ruler?.original) {
            if (!new PayCostToTargetEffect(this.effect.game, this.effect.player, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
                throw new InvalidActionResolution("Cannot pay the Toll Roads.");
        }
    }
}

export class ForcedLabor extends EnemyActionModifier<Denizen> {
    name = "Forced Labor";
    modifiedAction = SearchAction;
    action: SearchAction;
    mustUse = true;

    applyBefore(): void {
        if (this.action.player.site?.ruler?.original === this.source.ruler?.original) {
            if (!new PayCostToTargetEffect(this.action.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
                throw new InvalidActionResolution("Cannot pay the Forced Labor.");
        }
    }
}


export class RoyalTax extends WhenPlayed<Denizen> {
    name = "Royal Tax";

    whenPlayed(effect: ApplyWhenPlayedEffect): void {
        for (const player of Object.values(effect.game.players)) {
            if (player.site.ruler?.original === effect.player.leader.original)
                new MoveResourcesToTargetEffect(effect.game, effect.player, OathResource.Favor, 2, effect.player, player).do();
        }
    }
}


export class VowOfObedience extends AccessedActionModifier<Denizen> {
    name = "Vow of Obedience";
    modifiedAction = SearchPlayAction;
    action: SearchPlayAction;
    mustUse = true;

    applyBefore(): void {
        if (!this.action.facedown && this.action.card instanceof Vision)
            throw new InvalidActionResolution("Playing a Vision faceup is disobedience.");
    }
}
export class VowOfObedienceRest extends RestPower<Denizen> {
    name = "Vow of Obedience";

    applyBefore(): void {
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
        return this.action.campaignResult.defender?.original === this.source.ruler?.original;
    }

    applyImmediately(modifiers: ActionModifier<any>[]): Iterable<ActionModifier<any>> {
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
        return this.action.campaignResult.attacker.original === this.source.ruler?.original;
    }

    applyImmediately(modifiers: ActionModifier<any>[]): Iterable<ActionModifier<any>> {
        for (const modifier of modifiers)
            if (modifier instanceof DefenderBattlePlan)
                modifier.cost.add(new ResourceCost([[OathResource.Secret, 1]]));

        return [];
    }
}


export class SpiritSnare extends ActivePower<Denizen> {
    name = "Spirit Snare";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(action: UsePowerAction): void {
        new TakeFavorFromBankAction(action.player, 1).doNext();
    }
}


export class Dazzle extends WhenPlayed<Denizen> {
    name = "Dazzle";

    whenPlayed(effect: ApplyWhenPlayedEffect): void {
        new RegionDiscardEffect(effect.player, [OathSuit.Hearth, OathSuit.Order], this.source).do();
    }
}


export class Tutor extends ActivePower<Denizen> {
    name = "Tutor";
    cost = new ResourceCost([[OathResource.Favor, 1], [OathResource.Secret, 1]]);

    usePower(action: UsePowerAction): void {
        new PutResourcesOnTargetEffect(this.action.game, action.player, OathResource.Secret, 1).do();
    }
}


export class Alchemist extends ActivePower<Denizen> {
    name = "Alchemist";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Secret, 1]]);

    usePower(action: UsePowerAction): void {
        for (let i = 0; i < 4; i++) new TakeFavorFromBankAction(action.player, 1).doNext();
    }
}


export class ActingTroupe extends AccessedActionModifier<Denizen> {
    name = "Acting Troupe";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyBefore(): void {
        if (this.action.card.suit === OathSuit.Order || this.action.card.suit === OathSuit.Beast)
            this.source.suit = this.action.card.suit;
    }
}


export class Jinx extends EffectModifier<Denizen> {
    name = "Jinx";
    modifiedEffect = RollDiceEffect;
    effect: RollDiceEffect;
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    canUse(): boolean {
        return this.effect.player !== undefined && this.effect.player.rules(this.source) && !(!this.source.empty && this.game.currentPlayer.original === this.effect.player.original);
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

    applyImmediately(modifiers: ActionModifier<any>[]): Iterable<ActionModifier<any>> {
        return modifiers.filter(e => e.source instanceof Site);
    }

    applyBefore(): void {
        if (this.action.player.site.original !== this.source.site?.original && this.action.site.original !== this.source.site?.original)
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

        if (this.action.game.banners.get(BannerName.PeoplesFavor)?.owner !== this.action.player)
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
        if (this.action.player.getWarbands(this.action.player.leader) > 0) {
            new TakeWarbandsIntoBagEffect(this.action.player, 1).do();
            this.action.noSupplyCost = true;
        }
    }
}


export class CharmingFriend extends ActivePower<Denizen> {
    name = "Charming Friend";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(action: UsePowerAction): void {
        new TakeResourceFromPlayerAction(action.player, OathResource.Favor, 1, Object.values(this.game.players).filter(e => e.site === action.player.site)).doNext();
    }
}


export class FabledFeast extends WhenPlayed<Denizen> {
    name = "FabledFeast";

    whenPlayed(effect: ApplyWhenPlayedEffect): void {
        new TakeResourcesFromBankEffect(effect.game, effect.player, effect.game.favorBanks.get(OathSuit.Hearth), effect.player.ruledSuitCount(OathSuit.Hearth)).do();
    }
}


export class BookBinders extends EnemyEffectModifier<Denizen> {
    name = "Book Binders";
    modifiedEffect = PlayVisionEffect;
    effect: PlayVisionEffect;

    applyAfter(result: void): void {
        if (!this.source.ruler) return;
        new TakeFavorFromBankAction(this.source.ruler, 2).doNext();
    }
}

export class SaddleMakers extends EnemyEffectModifier<Denizen> {
    name = "Saddle Makers";
    modifiedEffect = PlayWorldCardEffect;
    effect: PlayWorldCardEffect;

    applyAfter(result: void): void {
        if (!this.source.ruler) return;
        if (this.effect.facedown || !(this.effect.card instanceof Denizen)) return;

        if (this.effect.card.suit === OathSuit.Nomad || this.effect.card.suit === OathSuit.Order)
            new TakeResourcesFromBankEffect(this.effect.game, this.source.ruler, this.effect.game.favorBanks.get(this.effect.card.suit), 2).do();
    }
}

export class Herald extends EnemyActionModifier<Denizen> {
    name = "Herald";
    modifiedAction = CampaignEndAction;
    action: CampaignEndAction;
    mustUse = true;

    applyAfter(): void {
        if (!this.source.ruler) return;
        if (!this.action.campaignResult.defender) return;
        new TakeFavorFromBankAction(this.source.ruler, 1).doNext();
    }
}


export class MarriageActionModifier extends AccessedActionModifier<Denizen> {
    name = "Marriage";
    modifiedAction = ModifiableAction;
    action: ModifiableAction;
    mustUse = true;

    applyBefore(): void {
        const original = this.action.player.original;
        const originalFn = original.adviserSuitCount.bind(original);
        this.action.player.adviserSuitCount = (suit: OathSuit) => {
            return originalFn(suit) + (suit === OathSuit.Hearth ? 1 : 0);
        };
    }
}

export class MarriageEffectModifier extends AccessedEffectModifier<Denizen> {
    name = "Marriage";
    modifiedEffect = OathEffect;
    effect: OathEffect<any>;
    mustUse = true;

    applyDuring(): void {
        if (!this.effect.player) return;
        const original = this.effect.player.original;
        const originalFn = original.adviserSuitCount.bind(original);
        this.effect.player.adviserSuitCount = (suit: OathSuit) => {
            return originalFn(suit) + (suit === OathSuit.Hearth ? 1 : 0);
        };
    }
}


// ------------------ NOMAD ------------------- //
export class WayStation extends ActionModifier<Denizen> {
    name = "Way Station";
    modifiedAction = TravelAction;
    action: TravelAction;

    applyBefore(): void {
        if (!this.source.site) return;
        if (this.action.site === this.source.site) {
            if (this.source.ruler !== this.action.player && !new PayCostToTargetEffect(this.action.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
                return;

            this.action.noSupplyCost = true;
        }
    }
}


function lostTongueCheckOwnable(source: Denizen, target: OwnableObject, by: OathPlayer | undefined) {
    if (!source.ruler) return;
    if (!by) return;
    if (target.owner !== source.ruler) return;

    if (by.ruledSuitCount(OathSuit.Nomad) < 1)
        throw new InvalidActionResolution(`Cannot target or take objects from ${source.ruler.name} without understanding the Lost Tongue.`);
}

export class LostTongue extends EnemyEffectModifier<Denizen> {
    name = "Lost Tongue";
    modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect;

    applyDuring(): void {
        lostTongueCheckOwnable(this.source, this.effect.target, this.effect.player);
    }
}

export class LostTongueCampaign extends EnemyActionModifier<Denizen> {
    name = "Lost Tongue";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets)
            if (isOwnable(target)) lostTongueCheckOwnable(this.source, target, this.action.player);
    }
}


export class Elders extends ActivePower<Denizen> {
    name = "Elders";
    cost = new ResourceCost([[OathResource.Favor, 2]]);

    usePower(action: UsePowerAction): void {
        new PutResourcesOnTargetEffect(this.action.game, action.player, OathResource.Secret, 1).do();
    }
}


export class SpellBreaker extends EnemyEffectModifier<Denizen> {
    name = "Spell Breaker";
    modifiedEffect = PayPowerCost;
    effect: PayPowerCost;

    applyDuring(): void {
        if (this.effect.power.cost.totalResources.get(OathResource.Secret))
            throw new InvalidActionResolution("Cannot use powers that cost Secrets under the Spell Breaker");
    }
}


export class FamilyWagon extends CapacityModifier<Denizen> {
    name = "Family Wagon";

    canUse(player: OathPlayer, site?: Site): boolean {
        return player === this.source.ruler && !site;
    }

    updateCapacityInformation(source: Set<WorldCard>): [number, Iterable<WorldCard>] {
        // NOTE: This is technically different from the way Family Wagon is worded. The way *this* works
        // is by setting the capacity to 2, and making all *other* Nomad cards not count towards the limit (effectively
        // making you have 1 spot for a non Nomad card, and infinite ones for Nomad cards, while allowing you
        // to replace Family Wagon if you want to)
        return [2, [...source].filter(e => e !== this.source && e instanceof Denizen && e.suit === OathSuit.Nomad)];
    }
}


// ------------------ DISCORD ------------------- //
export class RelicThief extends EnemyEffectModifier<Denizen> {
    name = "Relic Thief";
    modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect;

    applyAfter(result: void): void {
        if (!this.source.ruler) return;
        if (this.effect.target instanceof Relic && this.effect.player?.site.region === this.source.ruler.site.region) {
            // Roll dice and do stuff, probably after an action to pay the cost
        }
    }
}


export class KeyToTheCity extends WhenPlayed<Denizen> {
    name = "Key to the City";

    whenPlayed(effect: ApplyWhenPlayedEffect): void {
        if (!this.source.site) return;
        if (this.source.site.ruler?.site === this.source.site) return;

        for (const [player, amount] of this.source.site.warbands)
            new TakeWarbandsIntoBagEffect(player, amount, this.source.site).do();

        new PutWarbandsFromBagEffect(effect.player, 1, this.source.site).do();
    }
}


export class OnlyTwoAdvisers extends CapacityModifier<Denizen> {
    name = "Only Two Advisers";

    canUse(player: OathPlayer, site?: Site): boolean {
        return player === this.source.ruler && !site;
    }

    updateCapacityInformation(source: Set<WorldCard>): [number, Iterable<WorldCard>] {
        return [2, []];
    }
}

export class Assassin extends ActivePower<Denizen> {
    name = "Assassin";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(action: UsePowerAction): void {
        // Action to choose a player to discard from
    }
}

export class Insomnia extends RestPower<Denizen> {
    name = "Insomnia";

    applyBefore(): void {
        new PutResourcesOnTargetEffect(this.action.game, this.action.player, OathResource.Secret, 1).do();
    }
}

export class SilverTongue extends RestPower<Denizen> {
    name = "Silver Tongue";

    applyBefore(): void {
        const suits: Set<OathSuit> = new Set();
        for (const denizen of this.action.player.site.denizens) suits.add(denizen.suit);
        new TakeFavorFromBankAction(this.action.player, 1, suits).doNext();
    }
}


export class SleightOfHand extends ActivePower<Denizen> {
    name = "Sleight of Hand";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(action: UsePowerAction): void {
        new TakeResourceFromPlayerAction(action.player, OathResource.Secret, 1, Object.values(this.game.players).filter(e => e.site === action.player.site)).doNext();
    }
}


export class Naysayers extends RestPower<Denizen> {
    name = "Naysayers";

    applyBefore(): void {
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

    usePower(action: UsePowerAction): void {
        const faces = new RollDiceEffect(action.game, action.player, DefenseDie, 4).do();
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
        return this.action.campaignResult.defender?.original === this.source.ruler?.original;
    }

    applyImmediately(modifiers: ActionModifier<any>[]): Iterable<ActionModifier<any>> {
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
        return this.action.campaignResult.attacker.original === this.source.ruler?.original;
    }

    applyImmediately(modifiers: ActionModifier<any>[]): Iterable<ActionModifier<any>> {
        for (const modifier of modifiers)
            if (modifier instanceof DefenderBattlePlan)
                modifier.cost.add(new ResourceCost([], [[OathResource.Favor, 1]]));

        return [];
    }
}


export class ThreateningRoar extends WhenPlayed<Denizen> {
    name = "Threatening Roar";

    whenPlayed(effect: ApplyWhenPlayedEffect): void {
        new RegionDiscardEffect(effect.player, [OathSuit.Beast, OathSuit.Nomad], this.source).do();
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

    applyBefore(): void {
        new TakeFavorFromBankAction(this.action.player, 2).doNext();
    }
}


export class PiedPiperActive extends ActivePower<Denizen> {
    name = "Pied Piper";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(action: UsePowerAction): void {
        new PiedPiperAction(action.player, this.source).doNext();
    }
}


export class SmallFriends extends AccessedActionModifier<Denizen> {
    name = "Small Friends";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyBefore(): void {
        const sites = new Set<Site>();
        for (const site of this.game.board.sites())
            for (const denizen of site.denizens)
                if (denizen.suit === OathSuit.Beast)
                    sites.add(site);

        // FIXME: This doesn't work, why?
        new ActAsIfAtSiteAction(this.action.player, sites).doNext();
    }
}
