import { CampaignAtttackAction, CampaignDefenseAction, InvalidActionResolution, ModifiableAction, OathAction, PeoplesFavorDiscardAction, PeoplesFavorWakeAction, RestAction, SearchAction, SearchPlayAction, TakeFavorFromBankAction, ChooseResourceToTakeAction, TradeAction, TravelAction, UsePowerAction, WakeAction, TakeResourceFromPlayerAction, PiedPiperAction, CampaignAction, CampaignEndAction, ConspiracyAction } from "./actions";
import { Conspiracy, Denizen, OwnableCard, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { BannerName, OathResource, OathSuit, RegionName } from "./enums";
import { Banner, DarkestSecret, PeoplesFavor, ResourceCost } from "./resources";
import { AddActionToStackEffect, MoveResourcesToTargetEffect, OathEffect, PayCostToTargetEffect, PlayDenizenAtSiteEffect, PlayVisionEffect, PlayWorldCardEffect, PutResourcesOnTargetEffect, PutWarbandsFromBagEffect, RegionDiscardEffect, RollDiceEffect, SetNewOathkeeperEffect, TakeOwnableObjectEffect, TakeResourcesFromBankEffect, TakeWarbandsIntoBagEffect, TravelEffect } from "./effects";
import { OathPlayer, OathPlayerData, OwnableObject, Reliquary, isOwnable } from "./player";
import { OathGameObject } from "./game";


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
    static modifiedEffect = PlayWorldCardEffect;

    abstract whenPlayed(effect: PlayWorldCardEffect): void;
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
        return this.source.accessibleBy(this.action.data) && this.source.empty;
    }

    abstract usePower(data: OathPlayerData): void;
}

export abstract class ActionModifier<T extends OathGameObject> extends ActionPower<T> {
    static modifiedAction: AbstractConstructor<ModifiableAction>;
    action: ModifiableAction;
    mustUse = false;

    canUse(): boolean {
        return true;
    }

    applyImmediately(modifiers: ActionModifier<any>[]) { }  // Applied right after all the possible modifiers are collected
    applyBefore(): boolean { return true; }                 // Applied before the action's choices are made. If returns false, the execution will be interrupted
    applyDuring(): void { }                                 // Applied right before the execution of the action
    applyAfter(): void { }                                  // Applied after the execution of the action
}

export abstract class EnemyActionModifier<T extends OwnableCard> extends ActionModifier<T> {
    canUse(): boolean {
        return this.source.ruler === undefined || this.source.ruler.enemyWith(this.action.player);
    }
}

export abstract class AccessedActionModifier<T extends OwnableCard> extends ActionModifier<T> {
    canUse(): boolean {
        return this.source.accessibleBy(this.action.data) && this.source.empty;
    }
}

export abstract class WakePower<T extends OwnableCard> extends AccessedActionModifier<T> {
    static modifiedAction = WakeAction;
    action: WakeAction;
    mustUse = true;
}

export abstract class RestPower<T extends OwnableCard> extends AccessedActionModifier<T> {
    static modifiedAction = RestAction;
    action: RestAction;
    mustUse = true;
}

export abstract class BattlePlan<T extends OwnableCard> extends ActionModifier<T> {
    canUse(): boolean {
        return this.action.player.rules(this.source);
    }
}

export abstract class AttackerBattlePlan<T extends OwnableCard> extends BattlePlan<T> {
    static modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;
}

export abstract class DefenderBattlePlan<T extends OwnableCard> extends BattlePlan<T> {
    static modifiedAction = CampaignDefenseAction;
    action: CampaignDefenseAction;
}

export abstract class SearchPlayActionModifier<T extends WorldCard> extends ActionModifier<T> {
    static modifiedAction = SearchPlayAction;
    action: SearchPlayAction;

    applyOnPlay(): void {  }    // Applied right before the card is played
}

export abstract class EffectModifier<T extends OathGameObject> extends OathPower<T> {
    static modifiedEffect: AbstractConstructor<OathEffect<any>>;
    effect: OathEffect<any>

    constructor(source: T, effect: OathEffect<any>) {
        super(source);
        this.effect = effect;
    }

    canUse(): boolean {
        return true;
    }

    applyDuring(): void { }     // Applied right before the resolution of the effect
    applyAfter(): void { }      // Applied after the resolution of the effect
}

export abstract class EnemyEffectModifier<T extends OwnableCard> extends EffectModifier<T> {
    canUse(): boolean {
        return this.source.ruler === undefined || this.source.ruler.enemyWith(this.effect.player);
    }
}

export abstract class AccessedEffectModifier<T extends OwnableCard> extends EffectModifier<T> {
    canUse(): boolean {
        return this.source.accessibleBy(this.effect.data);
    }
}


//////////////////////////////////////////////////
//                  DENIZENS                    //
//////////////////////////////////////////////////
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
    static modifiedAction = TradeAction;
    action: TradeAction;
    mustUse = true;

    applyDuring(): void {
        if (this.action.data.site?.ruler === this.source.ruler) {
            if (!new PayCostToTargetEffect(this.game, this.action.data, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
                throw new InvalidActionResolution("Cannot pay the Curfew.");
        }
    }
}

export class TollRoads extends EnemyEffectModifier<Denizen> {
    name = "Toll Roads";
    static modifiedEffect = TravelEffect;
    effect: TravelEffect;

    applyDuring(): void {
        if (this.effect.site.ruler === this.source.ruler) {
            if (!new PayCostToTargetEffect(this.game, this.effect.data, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
                throw new InvalidActionResolution("Cannot pay the Toll Roads.");
        }
    }
}

export class ForcedLabor extends EnemyActionModifier<Denizen> {
    name = "Forced Labor";
    static modifiedAction = SearchAction;
    action: SearchAction;
    mustUse = true;

    applyDuring(): void {
        if (this.action.data.site?.ruler === this.source.ruler) {
            if (!new PayCostToTargetEffect(this.game, this.action.data, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
                throw new InvalidActionResolution("Cannot pay the Forced Labor.");
        }
    }
}


export class RoyalTax extends WhenPlayed<Denizen> {
    name = "Royal Tax";

    whenPlayed(effect: PlayWorldCardEffect): void {
        for (const player of this.game.players) {
            if (player.data.site.ruler === effect.player)
                new MoveResourcesToTargetEffect(this.game, effect.data, OathResource.Favor, 2, effect.player, player).do();
        }
    }
}


export class VowOfObedience extends SearchPlayActionModifier<Denizen> {
    name = "Vow of Obedience";
    mustUse = true;

    applyDuring(): void {
        if (!this.action.facedown && this.action.card instanceof Vision)
            throw new InvalidActionResolution("Playing a Vision faceup is disobedience.");
    }
}
export class VowOfObedienceRest extends RestPower<Denizen> {
    name = "Vow of Obedience";

    applyBefore(): boolean {
        new AddActionToStackEffect(new TakeFavorFromBankAction(this.action.data)).do();
        return true;
    }
}


// ------------------ ARCANE ------------------- //
export class GleamingArmorAttack extends EnemyActionModifier<Denizen> {
    name = "Gleaming Armor";
    static modifiedAction = CampaignAtttackAction;
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
    static modifiedAction = CampaignDefenseAction;
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

    usePower(data: OathPlayerData): void {
        new AddActionToStackEffect(new TakeFavorFromBankAction(data)).do();
    }
}


export class Dazzle extends WhenPlayed<Denizen> {
    name = "Dazzle";

    whenPlayed(effect: PlayWorldCardEffect): void {
        new RegionDiscardEffect(effect.data, [OathSuit.Hearth, OathSuit.Order]).do();
    }
}


export class Tutor extends ActivePower<Denizen> {
    name = "Tutor";
    cost = new ResourceCost([[OathResource.Favor, 1], [OathResource.Secret, 1]]);

    usePower(data: OathPlayerData): void {
        new PutResourcesOnTargetEffect(this.game, data, OathResource.Secret, 1).do();
    }
}


export class Alchemist extends ActivePower<Denizen> {
    name = "Alchemist";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Secret, 1]]);

    usePower(data: OathPlayerData): void {
        for (let i = 0; i < 4; i++) new AddActionToStackEffect(new TakeFavorFromBankAction(data)).do();
    }
}


export class ActingTroupe extends AccessedActionModifier<Denizen> {
    name = "Acting Troupe"
    static modifiedAction = TradeAction;
    action: TradeAction;

    applyDuring(): void {
        this.action.data.adviserSuitCount = (suit: OathSuit): number => {
            return this.action.data?.adviserSuitCount(suit) + (suit === OathSuit.Order || suit === OathSuit.Beast ? 1 : 0);
        }
    }
}


// ------------------ HEARTH ------------------- //
export class HeartsAndMinds extends DefenderBattlePlan<Denizen> {
    name = "Hearts and Minds";
    cost = new ResourceCost([[OathResource.Favor, 3]]);

    applyBefore(): boolean {
        this.action.campaignResult.successful = false;
        new AddActionToStackEffect(this.action.next).do();

        if (this.game.banners.get(BannerName.PeoplesFavor)?.owner !== this.action.player)
            this.action.campaignResult.discardAtEnd.add(this.source);

        return false;
    }
}


export class AwaitedReturn extends AccessedActionModifier<Denizen> {
    name = "Awaited Return";
    static modifiedAction = TradeAction;
    action: TradeAction;

    applyDuring(): void {
        if (this.action.player.ownWarbands > 0) {
            new TakeWarbandsIntoBagEffect(this.action.data, 1).do();
            this.action.noSupplyCost = true;
        }
    }
}


export class CharmingFriend extends ActivePower<Denizen> {
    name = "Charming Friend";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(data: OathPlayerData): void {
        new AddActionToStackEffect(new TakeResourceFromPlayerAction(data, OathResource.Favor, 1)).do();
    }
}


export class FabledFeast extends WhenPlayed<Denizen> {
    name = "FabledFeast";

    whenPlayed(effect: PlayWorldCardEffect): void {
        let total = 0;
        for (const site of this.game.board.sites())
            for (const denizen of site.denizens)
                if (denizen.ruler === effect.player) total++;

        for (const adviser of effect.data.advisers)
            if (adviser.ruler === effect.player) total++;

        new TakeResourcesFromBankEffect(this.game, effect.data, this.game.favorBanks.get(OathSuit.Hearth), total).do();
    }
}


export class BookBinders extends EnemyEffectModifier<Denizen> {
    name = "Book Binders";
    static modifiedEffect = PlayVisionEffect;
    effect: PlayVisionEffect;

    applyAfter(): void {
        if (!this.source.ruler) return;
        new AddActionToStackEffect(new TakeFavorFromBankAction(this.source.ruler.data, 2)).do();
    }
}

export class SaddleMakers extends EnemyEffectModifier<Denizen> {
    name = "Saddle Makers";
    static modifiedEffect = PlayWorldCardEffect;
    effect: PlayWorldCardEffect;

    applyAfter(): void {
        if (!this.source.ruler) return;
        if (this.effect.facedown || !(this.effect.card instanceof Denizen)) return;
        if (this.effect.card.suit !== OathSuit.Nomad && this.effect.card.suit !== OathSuit.Discord) return;
        new TakeResourcesFromBankEffect(this.game, this.source.ruler.data, this.game.favorBanks.get(this.effect.card.suit), 2).do();
    }
}

export class Herald extends EnemyActionModifier<Denizen> {
    name = "Herald";
    static modifiedAction = CampaignEndAction;
    action: CampaignEndAction;
    mustUse = true;

    applyAfter(): void {
        if (!this.source.ruler) return;
        if (!this.action.campaignResult.defender) return;
        new AddActionToStackEffect(new TakeFavorFromBankAction(this.source.ruler.data, 1)).do();
    }
}


export class MarriageAction extends AccessedActionModifier<Denizen> {
    name = "Marriage"
    static modifiedAction = ModifiableAction;
    action: ModifiableAction;
    mustUse = true;

    applyDuring(): void {
        this.action.data.adviserSuitCount = (suit: OathSuit): number => {
            return this.action.data?.adviserSuitCount(suit) + (suit === OathSuit.Hearth ? 1 : 0);
        }
    }
}
export class MarriageEffect extends AccessedEffectModifier<Denizen> {
    name = "Marriage"
    static modifiedEffect = OathEffect;
    effect: OathEffect<any>;
    mustUse = true;

    applyDuring(): void {
        if (!this.effect.data) return;
        this.effect.data.adviserSuitCount = (suit: OathSuit): number => {
            return (this.effect.data?.adviserSuitCount(suit) || 0) + (suit === OathSuit.Hearth ? 1 : 0);
        }
    }
}


// ------------------ NOMAD ------------------- //
export class WayStation extends ActionModifier<Denizen> {
    name = "Way Station";
    static modifiedAction = TravelAction;
    action: TravelAction;

    applyDuring(): void {
        if (!this.source.site) return;
        if (this.action.site === this.source.site) {
            if (this.source.ruler !== this.action.player && !new PayCostToTargetEffect(this.game, this.action.data, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
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
    static modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect;

    applyDuring(): void {
        lostTongueCheckOwnable(this.source, this.effect.target, this.effect.player);
    }
}
export class LostTongueCampaign extends EnemyActionModifier<Denizen> {
    name = "Lost Tongue";
    static modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;
    
    applyDuring(): void {
        for (const target of this.action.campaignResult.targets)
            if (isOwnable(target)) lostTongueCheckOwnable(this.source, target, this.action.player);
    }
}


export class Elders extends ActivePower<Denizen> {
    name = "Elders";
    cost = new ResourceCost([[OathResource.Favor, 2]]);

    usePower(data: OathPlayerData): void {
        new PutResourcesOnTargetEffect(this.game, data, OathResource.Secret, 1).do();
    }
}


export class SpellBreaker extends EnemyActionModifier<Denizen> {
    name = "Spell Breaker";
    static modifiedAction = ModifiableAction;

    applyBefore(): boolean {
        for (const modifier of this.action.parameters.modifiers)
            if (modifier.cost.totalResources.get(OathResource.Secret))
                throw new InvalidActionResolution("Cannot use powers that cost Secrets under the Spell Breaker");

        return true;
    }
}
export class SpellBreakerActive extends EnemyActionModifier<Denizen> {
    name = "Spell Breaker";
    static modifiedAction = UsePowerAction;
    action: UsePowerAction;

    applyDuring(): void {
        if (this.action.power.cost.totalResources.get(OathResource.Secret))
            throw new InvalidActionResolution("Cannot use powers that cost Secrets under the Spell Breaker");
    }
}


// ------------------ DISCORD ------------------- //
export class RelicThief extends EnemyEffectModifier<Denizen> {
    name = "Relic Thief";
    static modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect;

    applyAfter(): void {
        if (!this.source.ruler) return;
        if (this.effect.target instanceof Relic && this.effect.data?.site.region === this.source.ruler.data.site.region) {
            // Roll dice and do stuff, probably after an action to pay the cost
        }
    }
}


export class KeyToTheCity extends WhenPlayed<Denizen> {
    name = "Key to the City";

    whenPlayed(effect: PlayWorldCardEffect): void {
        if (!this.source.site) return;
        
        if (this.source.site.ruler?.data.site !== this.source.site)
            for (const [player, amount] of this.source.site.warbands)
                new TakeWarbandsIntoBagEffect(player.data, amount, this.source.site).do();

        new PutWarbandsFromBagEffect(effect.data, 1, this.source.site).do();
    }
}


export class OnlyTwoAdvisers extends SearchPlayActionModifier<Denizen> {
    name = "Only Two Advisers";
    mustUse = true;

    applyDuring(): void {
        if (!this.action.site) this.action.capacity = Math.min(this.action.capacity, 2);
    }

    applyOnPlay(): void {
        this.applyDuring();
    }
}

export class Assassin extends ActivePower<Denizen> {
    name = "Assassin";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(data: OathPlayerData): void {
        // Action to choose a player to discard from
    }
}

export class Insomnia extends RestPower<Denizen> {
    name = "Insomnia";

    applyDuring(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.data, OathResource.Secret, 1).do();
    }
}

export class SilverTongue extends RestPower<Denizen> {
    name = "Silver Tongue";

    applyBefore(): boolean {
        const suits: Set<OathSuit> = new Set();
        for (const denizen of this.action.data.site.denizens) suits.add(denizen.suit);
        new AddActionToStackEffect(new TakeFavorFromBankAction(this.action.data, 1, suits)).do();
        return true;
    }
}


export class SleightOfHand extends ActivePower<Denizen> {
    name = "Sleight of Hand";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(data: OathPlayerData): void {
        new AddActionToStackEffect(new TakeResourceFromPlayerAction(data, OathResource.Secret, 1)).do()
    }
}


export class Naysayers extends RestPower<Denizen> {
    name = "Naysayers";

    applyDuring(): void {
        if (!this.game.oathkeeper.isImperial)
            new MoveResourcesToTargetEffect(this.game, this.action.data, OathResource.Favor, 1, this.action.player, this.game.chancellor).do();
    }
}


export class ChaosCult extends EnemyEffectModifier<Denizen> {
    name = "Chaos Cult";
    static modifiedEffect = SetNewOathkeeperEffect;
    effect: SetNewOathkeeperEffect;

    applyAfter(): void {
        new MoveResourcesToTargetEffect(this.game, this.source.ruler?.data, OathResource.Favor, 1, this.source.ruler, this.effect.player).do();
    }
}


export class GamblingHall extends ActivePower<Denizen> {
    name = "Gambling Hall";
    cost = new ResourceCost([[OathResource.Favor, 2]]);

    usePower(data: OathPlayerData): void {
        // TODO: This doesn't work with Jinx, and I don't know how to solve it in a clean way
        const result = new RollDiceEffect(this.game, data, [0, 0, 1, 1, 2, -1], 4).do();
        
        // TODO: Factor this out, probably in a Die class
        let total = 0, mult = 1;
        for (const roll of result) {
            if (roll == -1)
                mult *= 2;
            else
                total += roll
        }
        const amount = total * mult;

        new AddActionToStackEffect(new TakeFavorFromBankAction(data, amount)).do();
    }
}


// ------------------ BEAST ------------------- //
export class Bracken extends AccessedActionModifier<Denizen> {
    name = "Bracken"
    static modifiedAction = SearchAction;
    action: SearchAction;

    applyDuring(): void {
        // Action to change the discard options
    }
}


export class InsectSwarmAttack extends EnemyActionModifier<Denizen> {
    name = "Insect Swarm";
    static modifiedAction = CampaignAtttackAction;
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
    static modifiedAction = CampaignDefenseAction;
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
        new RegionDiscardEffect(effect.data, [OathSuit.Beast, OathSuit.Nomad]).do();
    }
}


export class VowOfPoverty extends AccessedActionModifier<Denizen> {
    name = "Vow of Poverty";
    static modifiedAction = TradeAction;
    action: TradeAction;
    mustUse = true;

    applyDuring(): void {
        this.action.getting.delete(OathResource.Favor);
    }
}
export class VowOfPovertyRest extends RestPower<Denizen> {
    name = "Vow of Poverty";

    applyBefore(): boolean {
        new AddActionToStackEffect(new TakeFavorFromBankAction(this.action.data, 2)).do();
        return true;
    }
}


export class PiedPiper extends SearchPlayActionModifier<Denizen> {
    name = "Pied Piper";

    canUse(): boolean { return false; }

    applyOnPlay(): void {
        if (!this.action.site) this.action.capacity = Infinity;
    }
}
export class PiedPiperActive extends ActivePower<Denizen> {
    name = "Pied Piper";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(data: OathPlayerData): void {
        new AddActionToStackEffect(new PiedPiperAction(data, this.source)).do();
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
        for (const player of this.game.players) {
            if (player.data.site === effect.data.site) {
                let totalAdviserSuitCount = 0;
                for (const adviser of player.data.advisers)
                    if (!adviser.facedown && adviser instanceof Denizen)
                        totalAdviserSuitCount += effect.data.adviserSuitCount(adviser.suit);
                
                if (totalAdviserSuitCount >= 2)
                    targets.push(player);
            }
        }

        new AddActionToStackEffect(new ConspiracyAction(effect.data, targets)).do();
    }
}


//////////////////////////////////////////////////
//                    SITES                     //
//////////////////////////////////////////////////
export abstract class SiteActionModifier extends ActionModifier<Site> {
    canUse(): boolean {
        return this.action.data.site === this.source;
    }
}


export abstract class HomelandSitePower extends EffectModifier<Site> {
    static modifiedEffect = PlayWorldCardEffect;
    effect: PlayWorldCardEffect;
    abstract suit: OathSuit;

    applyAfter(): void {
        // TODO: "and if you have not discarded a <suit> card here during this turn"
        if (this.effect.site === this.source && this.effect.card instanceof Denizen && this.effect.card.suit === this.suit)
            this.giveReward(this.effect.data);
    }

    abstract giveReward(data: OathPlayerData): void;
}

export class Wastes extends HomelandSitePower {
    name = "Wastes";
    suit = OathSuit.Discord;

    giveReward(data: OathPlayerData): void {
        for (const relic of this.source.relics) return new TakeOwnableObjectEffect(this.game, data, relic).do();
    }
}

export class StandingStones extends HomelandSitePower {
    name = "Standing Stones";
    suit = OathSuit.Arcane;

    giveReward(data: OathPlayerData): void {
        new PutResourcesOnTargetEffect(this.game, data, OathResource.Secret, 1).do();
    }
}

export class AncientCity extends HomelandSitePower {
    name = "Ancient City";
    suit = OathSuit.Order;

    giveReward(data: OathPlayerData): void {
        new PutWarbandsFromBagEffect(data, 2).do();
    }
}

export class FertileValley extends HomelandSitePower {
    name = "Fertile Valley";
    suit = OathSuit.Hearth;

    giveReward(data: OathPlayerData): void {
        new TakeResourcesFromBankEffect(this.game, data, this.game.favorBanks.get(this.suit), 1).do();
    }
}

export class Steppe extends HomelandSitePower {
    name = "Steppe";
    suit = OathSuit.Nomad;

    giveReward(data: OathPlayerData): void {
        new PutResourcesOnTargetEffect(this.game, data, OathResource.Secret, 1).do();
    }
}

export class DeepWoods extends HomelandSitePower {
    name = "Deep Woods";
    suit = OathSuit.Beast;

    giveReward(data: OathPlayerData): void {
        for (const relic of this.source.relics) return new TakeOwnableObjectEffect(this.game, data, relic).do();
    }
}


export class CoastalSite extends SiteActionModifier {
    name = "Coastal Site";
    static modifiedAction = TravelAction;
    action: TravelAction;
    mustUse = true;

    applyDuring(): void {
        for (const power of this.action.site.powers) {
            if (power instanceof CoastalSite) {
                this.action.supplyCost = 1;
                return;
            }
        }
    }
}


export class CharmingValley extends SiteActionModifier {
    name = "Charming Valley";
    static modifiedAction = TravelAction;
    action: TravelAction;
    mustUse = true;

    applyDuring(): void {
        this.action.supplyCostModifier += 1;
    }
}


export class ResourceSite extends SiteActionModifier {
    name = "Resource Site";
    static modifiedAction = WakeAction;
    action: WakeAction;

    applyBefore(): boolean {
        new AddActionToStackEffect(new ChooseResourceToTakeAction(this.action.data, this.source)).do();
        return true;
    }
}



//////////////////////////////////////////////////
//                   RELICS                     //
//////////////////////////////////////////////////
export class CupOfPlenty extends AccessedActionModifier<Relic> {
    name = "Cup of Plenty"
    static modifiedAction = TradeAction;
    action: TradeAction;

    applyDuring(): void {
        if (this.action.data.adviserSuitCount(this.action.card.suit) > 0) this.action.noSupplyCost = true;
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
    static modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect

    applyDuring(): void {
        circletOfCommandCheckOwnable(this.source, this.effect.target, this.effect.player);
    }
}
export class CircletOfCommandCampaign extends EnemyActionModifier<Relic> {
    name = "Circlet of Command";
    static modifiedAction = CampaignAtttackAction;
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
    static modifiedEffect = TravelEffect;
    effect: TravelEffect;

    applyAfter(): void {
        new PutWarbandsFromBagEffect(this.effect.data, 1).do();
    }
}


export class BookOfRecords extends AccessedEffectModifier<Relic> {
    name = "Book of Records";
    static modifiedEffect = PlayDenizenAtSiteEffect;
    effect: PlayDenizenAtSiteEffect;

    applyDuring(): void {
        this.effect.getting.set(OathResource.Secret, this.effect.getting.get(OathResource.Favor) || 0);
        this.effect.getting.delete(OathResource.Favor);
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
    static modifiedAction = SearchPlayAction;
    action: SearchPlayAction;
    mustUse = true;  // Not strictly true, but it involves a choice either way, so it's better to always include it

    applyBefore(): boolean {
        for (const site of this.action.data.site.region.sites) {
            this.action.selects.site.choices.set(site.name, site);
        }

        new AddActionToStackEffect(new PeoplesFavorDiscardAction(this.action.data, this.action.discardOptions)).do();
        return true;
    }
}
export class PeoplesFavorWake extends BannerActionModifier<PeoplesFavor> {
    name = "People's Favor";
    static modifiedAction = WakeAction;
    action: WakeAction;
    mustUse = true;

    applyBefore(): boolean {
        if (this.source.owner) {
            new AddActionToStackEffect(new PeoplesFavorWakeAction(this.source.owner.data, this.source)).do();
            if (this.source.isMob) new AddActionToStackEffect(new PeoplesFavorWakeAction(this.source.owner.data, this.source)).do();
        }

        return true;
    }
}


export class DarkestSecretPower extends BannerActionModifier<DarkestSecret> {
    name = "Darkest Secret";
    static modifiedAction = SearchAction;
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
        return super.canUse() && this.action.player === this.game.chancellor;
    }
}

export class Brutal extends ReliquaryModifier {
    name = "Brutal";
    static modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;

    applyDuring() {
        this.action.campaignResult.attackerKillsEntireForce = true;
        this.action.campaignResult.defenderKillsEntireForce = true;
    }
}

export class Greedy extends ReliquaryModifier {
    name = "Greedy";
    static modifiedAction = SearchAction;
    action: SearchAction;

    applyDuring(): void {
        if (this.action.actualSupplyCost > 2) throw new InvalidActionResolution("Cannot do a Greedy Search for more than 2 Supply.");
        this.action.amount += 2;
    }
}

export class Careless extends ReliquaryModifier {
    name = "Careless";
    static modifiedAction = TradeAction;
    action: TradeAction;

    applyDuring(): void {
        this.action.getting.set(OathResource.Secret, Math.max(0, (this.action.getting.get(OathResource.Secret) || 0) - 1));
        this.action.getting.set(OathResource.Favor, (this.action.getting.get(OathResource.Favor) || 0) + 1);
    }
}

export class Decadent extends ReliquaryModifier {
    name = "Decadent";
    static modifiedAction = TravelAction;
    action: TravelAction;

    applyDuring(): void {
        if (this.action.site.inRegion(RegionName.Cradle) && !this.action.data.site.inRegion(RegionName.Cradle)) this.action.noSupplyCost = true;
        if (this.action.site.inRegion(RegionName.Hinterland)) this.action.supplyCostModifier += 1;
    }
}