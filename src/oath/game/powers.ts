import { CampaignAtttackAction, CampaignDefenseAction, InvalidActionResolution, ModifiableAction, OathAction, PeoplesFavorDiscardAction, PeoplesFavorWakeAction, RestAction, SearchAction, SearchPlayAction, TakeFavorFromBankAction, ChooseResourceToTakeAction, TradeAction, TravelAction, UsePowerAction, WakeAction, TakeResourceFromPlayerAction, PiedPiperAction, CampaignEndAction, ConspiracyAction, ActAsIfAtSiteAction, AskForRerollAction } from "./actions";
import { Conspiracy, Denizen, OwnableCard, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { BannerName, OathResource, OathSuit, RegionName } from "./enums";
import { Banner, DarkestSecret, PeoplesFavor, ResourceCost } from "./resources";
import { CursedCauldronResolutionEffect, GamblingHallEffect, MoveResourcesToTargetEffect, OathEffect, PayCostToTargetEffect, PlayDenizenAtSiteEffect, PlayVisionEffect, PlayWorldCardEffect, PutResourcesOnTargetEffect, PutWarbandsFromBagEffect, RegionDiscardEffect, RollDiceEffect, SetNewOathkeeperEffect, TakeOwnableObjectEffect, TakeResourcesFromBankEffect, TakeWarbandsIntoBagEffect, TravelEffect } from "./effects";
import { OathPlayer, OwnableObject, Reliquary, isOwnable } from "./player";
import { OathGameObject } from "./gameObject";
import { AbstractConstructor } from "./utils";
import { DefenseDie } from "./dice";


//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export abstract class OathPower<T extends OathGameObject> extends OathGameObject {
    abstract name: string;
    source: T;
    cost: ResourceCost = new ResourceCost();

    constructor(source: T) {
        super(source.game);
        this.source = source;
    }
}

export abstract class WhenPlayed<T extends WorldCard> extends OathPower<T> {
    modifiedEffect = PlayWorldCardEffect;

    abstract whenPlayed(effect: PlayWorldCardEffect): void;
}

export abstract class CapacityModifier<T extends WorldCard> extends OathPower<T> {
    canUse(player: OathPlayer, site?: Site): boolean {
        return true;
    }
    
    // Updates the information to calculate capacity in the group the source is in/being played to
    // First return is the update to capacity (min of all values), second is a set of cards that don't count towards capacity
    updateCapacityInformation(source: Set<WorldCard>): [number, Iterable<WorldCard>] { return [Infinity, []]; }

    ignoreCapacity(card: WorldCard, facedown: boolean = card.facedown): boolean { return false; }
}

export abstract class ActionPower<T extends OathGameObject> extends OathPower<T> {
    action: OathAction;

    constructor(source: T, action: OathAction) {
        super(source);
        this.action = action;
    }

    abstract canUse(): boolean;
}

export abstract class ActivePower<T extends OwnableCard> extends ActionPower<T> {
    action: UsePowerAction;

    canUse(): boolean {
        return this.source.accessibleBy(this.action.player) && this.source.empty;
    }

    abstract usePower(action: UsePowerAction): void;
}

export abstract class ActionModifier<T extends OathGameObject> extends ActionPower<T> {
    modifiedAction: AbstractConstructor<ModifiableAction>;
    action: ModifiableAction;
    mustUse = false;

    canUse(): boolean {
        return true;
    }

    applyImmediately(modifiers: ActionModifier<any>[]) { }  // Applied right after all the possible modifiers are collected
    applyBefore(): boolean { return true; }                 // Applied before the action is added to the list. If returns false, it will not be added
    applyAtStart(): void { }                                // Applied when the action starts and selects are setup (before choices are made)
    applyDuring(): void { }                                 // Applied right before the execution of the action
    applyAfter(): void { }                                  // Applied after the execution of the action
}

export abstract class EnemyActionModifier<T extends OwnableCard> extends ActionModifier<T> {
    mustUse = true;

    canUse(): boolean {
        return this.source.ruler === undefined || this.source.ruler.enemyWith(this.action.player);
    }
}

export abstract class AccessedActionModifier<T extends OwnableCard> extends ActionModifier<T> {
    canUse(): boolean {
        return this.source.accessibleBy(this.action.player) && this.source.empty;
    }
}

export abstract class WakePower<T extends OwnableCard> extends AccessedActionModifier<T> {
    modifiedAction = WakeAction;
    action: WakeAction;
    mustUse = true;
}

export abstract class RestPower<T extends OwnableCard> extends AccessedActionModifier<T> {
    modifiedAction = RestAction;
    action: RestAction;
    mustUse = true;
}

export abstract class BattlePlan<T extends OwnableCard> extends ActionModifier<T> {
    canUse(): boolean {
        return this.action.player.rules(this.source);
    }
}

export abstract class AttackerBattlePlan<T extends OwnableCard> extends BattlePlan<T> {
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;
}

export abstract class DefenderBattlePlan<T extends OwnableCard> extends BattlePlan<T> {
    modifiedAction = CampaignDefenseAction;
    action: CampaignDefenseAction;
}

export abstract class EffectModifier<T extends OathGameObject> extends OathPower<T> {
    modifiedEffect: AbstractConstructor<OathEffect<any>>;
    effect: OathEffect<any>;

    constructor(source: T, effect: OathEffect<any>) {
        super(source);
        this.effect = effect;
    }

    canUse(): boolean {
        return true;
    }

    applyDuring(): void { }             // Applied right before the resolution of the effect
    applyAfter(result: any): void { }   // Applied after the resolution of the effect
}

export abstract class EnemyEffectModifier<T extends OwnableCard> extends EffectModifier<T> {
    mustUse = true;

    canUse(): boolean {
        return this.source.ruler === undefined || this.source.ruler.enemyWith(this.effect.player);
    }
}

export abstract class AccessedEffectModifier<T extends OwnableCard> extends EffectModifier<T> {
    canUse(): boolean {
        return this.source.accessibleBy(this.effect.player);
    }
}


//////////////////////////////////////////////////
//                  DENIZENS                    //
//////////////////////////////////////////////////
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

    applyDuring(): void {
        this.action.campaignResult.atkPool++;
    }
}
export class LongbowArchersDefense extends DefenderBattlePlan<Denizen> {
    name = "Longbow Archers";

    applyDuring(): void {
        this.action.campaignResult.atkPool--;
    }
}


export class ShieldWall extends DefenderBattlePlan<Denizen> {
    name = "Shield Wall";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyDuring(): void {
        this.action.campaignResult.defPool += 2;
        this.action.campaignResult.defenderKillsEntireForce = true;
    }
}


export class Curfew extends EnemyActionModifier<Denizen> {
    name = "Curfew";
    modifiedAction = TradeAction;
    action: TradeAction;
    mustUse = true;

    applyDuring(): void {
        if (this.action.player.site?.ruler === this.source.ruler) {
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
        if (this.effect.site.ruler === this.source.ruler) {
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

    applyDuring(): void {
        if (this.action.player.site?.ruler === this.source.ruler) {
            if (!new PayCostToTargetEffect(this.action.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
                throw new InvalidActionResolution("Cannot pay the Forced Labor.");
        }
    }
}


export class RoyalTax extends WhenPlayed<Denizen> {
    name = "Royal Tax";

    whenPlayed(effect: PlayWorldCardEffect): void {
        for (const player of Object.values(effect.game.players)) {
            if (player.site.ruler === effect.player)
                new MoveResourcesToTargetEffect(effect.game, effect.player, OathResource.Favor, 2, effect.player, player).do();
        }
    }
}


export class VowOfObedience extends ActionModifier<Denizen> {
    name = "Vow of Obedience";
    modifiedAction = SearchPlayAction;
    action: SearchPlayAction;
    mustUse = true;

    applyDuring(): void {
        if (!this.action.facedown && this.action.card instanceof Vision)
            throw new InvalidActionResolution("Playing a Vision faceup is disobedience.");
    }
}
export class VowOfObedienceRest extends RestPower<Denizen> {
    name = "Vow of Obedience";

    applyBefore(): boolean {
        new TakeFavorFromBankAction(this.action.player, 1).doNext();
        return true;
    }
}


// ------------------ ARCANE ------------------- //
export class GleamingArmorAttack extends EnemyActionModifier<Denizen> {
    name = "Gleaming Armor";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;
    mustUse = true;

    applyImmediately(modifiers: ActionModifier<any>[]): void {
        for (const modifier of modifiers) 
            if (modifier instanceof AttackerBattlePlan)
                modifier.cost.add(new ResourceCost([[OathResource.Secret, 1]]));
    }
}
export class GleamingArmorDefense extends EnemyActionModifier<Denizen> {
    name = "Gleaming Armor";
    modifiedAction = CampaignDefenseAction;
    action: CampaignDefenseAction;
    mustUse = true;

    applyImmediately(modifiers: ActionModifier<any>[]): void {
        for (const modifier of modifiers) 
            if (modifier instanceof DefenderBattlePlan)
                modifier.cost.add(new ResourceCost([[OathResource.Secret, 1]]));
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

    whenPlayed(effect: PlayWorldCardEffect): void {
        new RegionDiscardEffect(effect.player, [OathSuit.Hearth, OathSuit.Order]).do();
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

    applyDuring(): void {
        if (this.action.card.suit === OathSuit.Order || this.action.card.suit === OathSuit.Beast)
            this.source.suit = this.action.card.suit;
    }
}


export class Jinx extends EffectModifier<Denizen> {
    name = "Jinx";
    modifiedEffect = RollDiceEffect;
    effect: RollDiceEffect;

    canUse(): boolean {
        return this.effect.player !== undefined && this.effect.player.rules(this.source);
    }

    applyAfter(result: number[]): void {
        if (!this.effect.player) return;
        new AskForRerollAction(this.effect.player, result, this.effect.die).doNext();
    }
}


// ------------------ HEARTH ------------------- //
export class HeartsAndMinds extends DefenderBattlePlan<Denizen> {
    name = "Hearts and Minds";
    cost = new ResourceCost([[OathResource.Favor, 3]]);

    applyBefore(): boolean {
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

    applyDuring(): void {
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
        new TakeResourceFromPlayerAction(action.player, OathResource.Favor, 1).doNext();
    }
}


export class FabledFeast extends WhenPlayed<Denizen> {
    name = "FabledFeast";

    whenPlayed(effect: PlayWorldCardEffect): void {
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
    name = "Marriage"
    modifiedAction = ModifiableAction;
    action: ModifiableAction;
    mustUse = true;

    applyDuring(): void {
        const originalFn = this.action.player.original.adviserSuitCount
        this.action.player.adviserSuitCount = (suit: OathSuit) => {
            return originalFn(suit) + (suit === OathSuit.Hearth ? 1 : 0);
        }
    }
}
export class MarriageEffectModifier extends AccessedEffectModifier<Denizen> {
    name = "Marriage"
    modifiedEffect = OathEffect;
    effect: OathEffect<any>;
    mustUse = true;

    applyDuring(): void {
        if (!this.effect.player) return;
        const originalFn = this.effect.player.original.adviserSuitCount;
        this.effect.player.adviserSuitCount = (suit: OathSuit) => {
            return originalFn(suit) + (suit === OathSuit.Hearth ? 1 : 0);
        }
    }
}


// ------------------ NOMAD ------------------- //
export class WayStation extends ActionModifier<Denizen> {
    name = "Way Station";
    modifiedAction = TravelAction;
    action: TravelAction;

    applyDuring(): void {
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
    
    applyDuring(): void {
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


export class SpellBreaker extends EnemyActionModifier<Denizen> {
    name = "Spell Breaker";
    modifiedAction = ModifiableAction;

    applyBefore(): boolean {
        for (const modifier of this.action.modifiers)
            if (modifier.cost.totalResources.get(OathResource.Secret))
                throw new InvalidActionResolution("Cannot use powers that cost Secrets under the Spell Breaker");

        return true;
    }
}
export class SpellBreakerActive extends EnemyActionModifier<Denizen> {
    name = "Spell Breaker";
    modifiedAction = UsePowerAction;
    action: UsePowerAction;

    applyDuring(): void {
        if (this.action.power.cost.totalResources.get(OathResource.Secret))
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
        return [2, [...source].filter(e => e !== this.source && !e.facedown && e instanceof Denizen && e.suit === OathSuit.Nomad)];
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

    whenPlayed(effect: PlayWorldCardEffect): void {
        if (!this.source.site) return;
        
        if (this.source.site.ruler?.site !== this.source.site)
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

    applyDuring(): void {
        new PutResourcesOnTargetEffect(this.action.game, this.action.player, OathResource.Secret, 1).do();
    }
}

export class SilverTongue extends RestPower<Denizen> {
    name = "Silver Tongue";

    applyBefore(): boolean {
        const suits: Set<OathSuit> = new Set();
        for (const denizen of this.action.player.site.denizens) suits.add(denizen.suit);
        new TakeFavorFromBankAction(this.action.player, 1, suits).doNext();
        return true;
    }
}


export class SleightOfHand extends ActivePower<Denizen> {
    name = "Sleight of Hand";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(action: UsePowerAction): void {
        new TakeResourceFromPlayerAction(action.player, OathResource.Secret, 1).doNext()
    }
}


export class Naysayers extends RestPower<Denizen> {
    name = "Naysayers";

    applyDuring(): void {
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
    name = "Bracken"
    modifiedAction = SearchAction;
    action: SearchAction;

    applyDuring(): void {
        // TODO: Action to change the discard options
    }
}


export class InsectSwarmAttack extends EnemyActionModifier<Denizen> {
    name = "Insect Swarm";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;
    mustUse = true;

    applyImmediately(modifiers: ActionModifier<any>[]): void {
        for (const modifier of modifiers) 
            if (modifier instanceof AttackerBattlePlan)
                modifier.cost.add(new ResourceCost([], [[OathResource.Favor, 1]]));
    }
}
export class InsectSwarmDefense extends EnemyActionModifier<Denizen> {
    name = "Insect Swarm";
    modifiedAction = CampaignDefenseAction;
    action: CampaignDefenseAction;
    mustUse = true;

    applyImmediately(modifiers: ActionModifier<any>[]): void {
        for (const modifier of modifiers) 
            if (modifier instanceof DefenderBattlePlan)
                modifier.cost.add(new ResourceCost([], [[OathResource.Favor, 1]]));
    }
}


export class ThreateningRoar extends WhenPlayed<Denizen> {
    name = "Threatening Roar";

    whenPlayed(effect: PlayWorldCardEffect): void {
        new RegionDiscardEffect(effect.player, [OathSuit.Beast, OathSuit.Nomad]).do();
    }
}


export class VowOfPoverty extends AccessedActionModifier<Denizen> {
    name = "Vow of Poverty";
    modifiedAction = TradeAction;
    action: TradeAction;
    mustUse = true;

    applyDuring(): void {
        this.action.getting.set(OathResource.Favor, -Infinity);
    }
}
export class VowOfPovertyRest extends RestPower<Denizen> {
    name = "Vow of Poverty";

    applyBefore(): boolean {
        new TakeFavorFromBankAction(this.action.player, 2).doNext();
        return true;
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
    name = "Small Friends"
    modifiedAction = TradeAction;
    action: TradeAction;

    applyBefore(): boolean {
        new ActAsIfAtSiteAction(this.action.player).doNext();
        return true;
    }
}



//////////////////////////////////////////////////
//                   VISIONS                    //
//////////////////////////////////////////////////
export class VisionPower extends WakePower<Vision> {
    name = "Vision Check";

    applyBefore(): boolean {
        const candidates = this.source.oath.getCandidates();
        if (candidates.size === 1 && candidates.has(this.action.player)) {
            // TODO: YOU WIN!
            return false;
        }

        return true;
    }
}


export class ConspiracyPower extends WhenPlayed<Conspiracy> {
    name = "Conspiracy";

    whenPlayed(effect: PlayWorldCardEffect): void {
        const targets: OathPlayer[] = [];
        for (const player of Object.values(effect.game.players)) {
            if (player.site === effect.player.site) {
                let totalAdviserSuitCount = 0;
                for (const adviser of player.advisers)
                    if (!adviser.facedown && adviser instanceof Denizen)
                        totalAdviserSuitCount += effect.player.adviserSuitCount(adviser.suit);
                
                if (totalAdviserSuitCount >= 2)
                    targets.push(player);
            }
        }

        new ConspiracyAction(effect.player, targets).doNext();
    }
}


//////////////////////////////////////////////////
//                    SITES                     //
//////////////////////////////////////////////////
export abstract class HomelandSitePower extends EffectModifier<Site> {
    modifiedEffect = PlayWorldCardEffect;
    effect: PlayWorldCardEffect;
    abstract suit: OathSuit;

    applyAfter(result: void): void {
        // TODO: "and if you have not discarded a <suit> card here during this turn"
        if (this.effect.site?.original === this.source.original && this.effect.card instanceof Denizen && this.effect.card.suit === this.suit)
            this.giveReward(this.effect.player);
    }

    abstract giveReward(player: OathPlayer): void;
}

export class Wastes extends HomelandSitePower {
    name = "Wastes";
    suit = OathSuit.Discord;

    giveReward(player: OathPlayer): void {
        for (const relic of this.source.relics) return new TakeOwnableObjectEffect(player.game, player, relic).do();
    }
}

export class StandingStones extends HomelandSitePower {
    name = "Standing Stones";
    suit = OathSuit.Arcane;

    giveReward(player: OathPlayer): void {
        new PutResourcesOnTargetEffect(player.game, player, OathResource.Secret, 1).do();
    }
}

export class AncientCity extends HomelandSitePower {
    name = "Ancient City";
    suit = OathSuit.Order;

    giveReward(player: OathPlayer): void {
        new PutWarbandsFromBagEffect(player, 2).do();
    }
}

export class FertileValley extends HomelandSitePower {
    name = "Fertile Valley";
    suit = OathSuit.Hearth;

    giveReward(player: OathPlayer): void {
        new TakeResourcesFromBankEffect(player.game, player, player.game.favorBanks.get(this.suit), 1).do();
    }
}

export class Steppe extends HomelandSitePower {
    name = "Steppe";
    suit = OathSuit.Nomad;

    giveReward(player: OathPlayer): void {
        new PutResourcesOnTargetEffect(player.game, player, OathResource.Secret, 1).do();
    }
}

export class DeepWoods extends HomelandSitePower {
    name = "Deep Woods";
    suit = OathSuit.Beast;

    giveReward(player: OathPlayer): void {
        for (const relic of this.source.relics) return new TakeOwnableObjectEffect(player.game, player, relic).do();
    }
}


export abstract class SiteActionModifier extends ActionModifier<Site> {
    canUse(): boolean {
        return this.action.player.site === this.source;
    }
}

export class CoastalSite extends SiteActionModifier {
    name = "Coastal Site";
    modifiedAction = TravelAction;
    action: TravelAction;
    mustUse = true;

    applyDuring(): void {
        if (this.action.site.facedown) return;

        for (const power of this.action.site.powers) {
            if (power === CoastalSite) {
                this.action.supplyCost = 1;
                return;
            }
        }
    }
}

export class CharmingValley extends SiteActionModifier {
    name = "Charming Valley";
    modifiedAction = TravelAction;
    action: TravelAction;
    mustUse = true;

    applyDuring(): void {
        this.action.supplyCostModifier += 1;
    }
}

export class ResourceSite extends SiteActionModifier {
    name = "Resource Site";
    modifiedAction = WakeAction;
    action: WakeAction;

    applyBefore(): boolean {
        new ChooseResourceToTakeAction(this.action.player, this.source).doNext();
        return true;
    }
}



//////////////////////////////////////////////////
//                   RELICS                     //
//////////////////////////////////////////////////
export class CupOfPlenty extends AccessedActionModifier<Relic> {
    name = "Cup of Plenty"
    modifiedAction = TradeAction;
    action: TradeAction;

    applyDuring(): void {
        if (this.action.player.adviserSuitCount(this.action.card.suit) > 0) this.action.noSupplyCost = true;
    }
}


function circletOfCommandCheckOwnable(source: Relic, target: OwnableObject, by: OathPlayer | undefined) {
    if (!source.ruler) return;
    if (!by) return;
    if (target.owner !== source.ruler) return;

    if (target !== source)
        throw new InvalidActionResolution(`Cannot target or take objects from ${source.ruler.name} while protected by the Circlet of Command.`);
}
export class CircletOfCommand extends EnemyEffectModifier<Relic> {
    name = "Circlet of Command";
    modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect

    applyDuring(): void {
        circletOfCommandCheckOwnable(this.source, this.effect.target, this.effect.player);
    }
}
export class CircletOfCommandCampaign extends EnemyActionModifier<Relic> {
    name = "Circlet of Command";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;
    
    applyDuring(): void {
        for (const target of this.action.campaignResult.targets) {
            if (isOwnable(target)) circletOfCommandCheckOwnable(this.source, target, this.action.player);
            if (target === this.source.ruler) this.action.campaignResult.defPool += 1;
        }
    }
}


export class DragonskinWardrum extends AccessedEffectModifier<Relic> {
    name = "Dragonskin Wardrum"
    modifiedEffect = TravelEffect;
    effect: TravelEffect;

    applyAfter(result: void): void {
        new PutWarbandsFromBagEffect(this.effect.player, 1).do();
    }
}


export class BookOfRecords extends AccessedEffectModifier<Relic> {
    name = "Book of Records";
    modifiedEffect = PlayDenizenAtSiteEffect;
    effect: PlayDenizenAtSiteEffect;

    applyDuring(): void {
        this.effect.getting.set(OathResource.Secret, this.effect.getting.get(OathResource.Favor) || 0);
        this.effect.getting.delete(OathResource.Favor);
    }
}


export class CursedCauldronAttack extends AttackerBattlePlan<Relic> {
    name = "Cursed Cauldron";

    applyDuring(): void {
        if (!this.source.ruler) return;
        this.action.campaignResult.endEffects.push(new CursedCauldronResolutionEffect(this.source.ruler, this.action.campaignResult));
    }
}

export class CursedCauldronDefense extends DefenderBattlePlan<Relic> {
    name = "Cursed Cauldron";

    applyDuring(): void {
        if (!this.source.ruler) return;
        this.action.campaignResult.endEffects.push(new CursedCauldronResolutionEffect(this.source.ruler, this.action.campaignResult));
    }
}



//////////////////////////////////////////////////
//                   BANNERS                    //
//////////////////////////////////////////////////
export abstract class BannerActionModifier<T extends Banner> extends ActionModifier<T> {
    canUse(): boolean {
        return super.canUse() && this.action.player === this.source.owner;
    }
}

export class PeoplesFavorSearch extends BannerActionModifier<PeoplesFavor> {
    name = "People's Favor";
    modifiedAction = SearchPlayAction;
    action: SearchPlayAction;
    mustUse = true;  // Not strictly true, but it involves a choice either way, so it's better to always include it

    applyBefore(): boolean {
        new PeoplesFavorDiscardAction(this.action.player, this.action.discardOptions).doNext();
        return true;
    }

    applyAtStart(): void {
        for (const site of this.action.player.site.region.sites) {
            this.action.selects.site.choices.set(site.name, site);
        }
    }
}
export class PeoplesFavorWake extends BannerActionModifier<PeoplesFavor> {
    name = "People's Favor";
    modifiedAction = WakeAction;
    action: WakeAction;
    mustUse = true;

    applyBefore(): boolean {
        if (this.source.owner) {
            new PeoplesFavorWakeAction(this.source.owner, this.source).doNext();
            if (this.source.isMob) new PeoplesFavorWakeAction(this.source.owner, this.source).doNext();
        }

        return true;
    }
}


export class DarkestSecretPower extends BannerActionModifier<DarkestSecret> {
    name = "Darkest Secret";
    modifiedAction = SearchAction;
    action: SearchAction;
    mustUse = true;

    applyDuring(): void {
        this.action.supplyCost = 2;
    }
}



//////////////////////////////////////////////////
//                 RELIQUARY                    //
//////////////////////////////////////////////////
export abstract class ReliquaryModifier extends ActionModifier<Reliquary> {
    mustUse = true;

    canUse(): boolean {
        return super.canUse() && this.action.player === this.action.game.chancellor;
    }
}

export class Brutal extends ReliquaryModifier {
    name = "Brutal";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;

    applyDuring() {
        this.action.campaignResult.attackerKillsEntireForce = true;
        this.action.campaignResult.defenderKillsEntireForce = true;
    }
}

export class Greedy extends ReliquaryModifier {
    name = "Greedy";
    modifiedAction = SearchAction;
    action: SearchAction;

    applyDuring(): void {
        if (this.action.actualSupplyCost > 2) throw new InvalidActionResolution("Cannot do a Greedy Search for more than 2 Supply.");
        this.action.amount += 2;
    }
}

export class Careless extends ReliquaryModifier {
    name = "Careless";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyDuring(): void {
        this.action.getting.set(OathResource.Secret, Math.max(0, (this.action.getting.get(OathResource.Secret) || 0) - 1));
        this.action.getting.set(OathResource.Favor, (this.action.getting.get(OathResource.Favor) || 0) + 1);
    }
}

export class Decadent extends ReliquaryModifier {
    name = "Decadent";
    modifiedAction = TravelAction;
    action: TravelAction;

    applyDuring(): void {
        if (this.action.site.inRegion(RegionName.Cradle) && !this.action.player.site.inRegion(RegionName.Cradle))
            this.action.noSupplyCost = true;
        
        if (this.action.site.inRegion(RegionName.Hinterland))
            this.action.supplyCostModifier += 1;
    }
}