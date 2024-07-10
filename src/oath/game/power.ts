import { CampaignAtttackAction, CampaignDefenseAction, InvalidActionResolution, ModifiableAction, OathAction, PeoplesFavorDiscardAction, PeoplesFavorWakeAction, RestAction, SearchAction, SearchPlayAction, TakeFavorFromBankAction, ChooseResourceToTakeAction, TradeAction, TravelAction, UsePowerAction, WakeAction, TakeResourceFromPlayerAction, PiedPiperAction } from "./actions";
import { Denizen, OwnableCard, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { BannerName, OathResource, OathSuit, RegionName } from "./enums";
import { Banner, DarkestSecret, PeoplesFavor, ResourceCost } from "./resources";
import { AddActionToStackEffect, MoveResourcesToTargetEffect, OathEffect, PayCostToTargetEffect, PlayDenizenAtSiteEffect, PlayWorldCardEffect, PutResourcesOnTargetEffect, PutWarbandsFromBagEffect, RegionDiscardEffect, SetNewOathkeeperEffect, TakeOwnableObjectEffect, TakeResourcesFromBankEffect, TakeWarbandsIntoBagEffect, TravelEffect } from "./effects";
import { OathPlayer, OwnableObject, Reliquary, isOwnable } from "./player";
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
        return this.source.accessibleBy(this.action.player) && this.source.empty;
    }

    abstract usePower(player: OathPlayer): void;
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
        return this.source.accessibleBy(this.action.player) && this.source.empty;
    }
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
        return this.source.accessibleBy(this.effect.player);
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
        if (this.action.player.site?.ruler === this.source.ruler) {
            if (!new PayCostToTargetEffect(this.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
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
            if (!new PayCostToTargetEffect(this.game, this.effect.player, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
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
        if (this.action.player.site?.ruler === this.source.ruler) {
            if (!new PayCostToTargetEffect(this.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
                throw new InvalidActionResolution("Cannot pay the Forced Labor.");
        }
    }
}


export class RoyalTax extends WhenPlayed<Denizen> {
    name = "Royal Tax";

    whenPlayed(effect: PlayWorldCardEffect): void {
        for (const player of this.game.players) {
            if (player.site.ruler === effect.player)
                new MoveResourcesToTargetEffect(this.game, effect.player, OathResource.Favor, 2, effect.player, player).do();
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
export class VowOfObedienceRest extends AccessedActionModifier<Denizen> {
    name = "Vow of Obedience";
    static modifiedAction = RestAction;
    action: RestAction;

    applyBefore(): boolean {
        new AddActionToStackEffect(new TakeFavorFromBankAction(this.action.player)).do();
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

    usePower(player: OathPlayer): void {
        new AddActionToStackEffect(new TakeFavorFromBankAction(player)).do();
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

    usePower(player: OathPlayer): void {
        new PutResourcesOnTargetEffect(this.game, player, OathResource.Secret, 1).do();
    }
}


export class Alchemist extends ActivePower<Denizen> {
    name = "Alchemist";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Secret, 1]]);

    usePower(player: OathPlayer): void {
        for (let i = 0; i < 4; i++) new AddActionToStackEffect(new TakeFavorFromBankAction(player)).do();
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
            new TakeWarbandsIntoBagEffect(this.action.player, 1).do();
            this.action.noSupplyCost = true;
        }
    }
}


export class CharmingFriend extends ActivePower<Denizen> {
    name = "Charming Friend";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(player: OathPlayer): void {
        new AddActionToStackEffect(new TakeResourceFromPlayerAction(player, OathResource.Favor, 1)).do();
    }
}


export class FabledFeast extends WhenPlayed<Denizen> {
    name = "FabledFeast";

    whenPlayed(effect: PlayWorldCardEffect): void {
        let total = 0;
        for (const region of this.game.board.regions.values())
            for (const site of region.sites)
                for (const denizen of site.denizens)
                    if (denizen.ruler === effect.player) total++;

        for (const adviser of effect.player.advisers)
            if (adviser.ruler === effect.player) total++;

        new TakeResourcesFromBankEffect(this.game, effect.player, this.game.favorBanks.get(OathSuit.Hearth), total).do();
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
            if (this.source.ruler !== this.action.player && !new PayCostToTargetEffect(this.game, this.action.player, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
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

    usePower(player: OathPlayer): void {
        new PutResourcesOnTargetEffect(this.game, player, OathResource.Secret, 1).do();
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

    usePower(player: OathPlayer): void {
        // Action to choose a player to discard from
    }
}

export class Insomnia extends AccessedActionModifier<Denizen> {
    name = "Insomnia";
    static modifiedAction = RestAction;
    action: RestAction;

    applyDuring(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.player, OathResource.Secret, 1).do();
    }
}

export class SilverTongue extends AccessedActionModifier<Denizen> {
    name = "Silver Tongue";
    static modifiedAction = RestAction;
    action: RestAction;

    applyBefore(): boolean {
        const suits: Set<OathSuit> = new Set();
        for (const denizen of this.action.player.site.denizens) suits.add(denizen.suit);
        new AddActionToStackEffect(new TakeFavorFromBankAction(this.action.player, 1, suits)).do();
        return true;
    }
}


export class SleightOfHand extends ActivePower<Denizen> {
    name = "Sleight of Hand";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(player: OathPlayer): void {
        new AddActionToStackEffect(new TakeResourceFromPlayerAction(player, OathResource.Secret, 1)).do()
    }
}


export class Naysayers extends AccessedActionModifier<Denizen> {
    name = "Naysayers";
    static modifiedAction = RestAction;
    action: RestAction;

    applyDuring(): void {
        if (!this.game.oathkeeper.isImperial)
            new MoveResourcesToTargetEffect(this.game, this.action.player, OathResource.Favor, 1, this.action.player, this.game.chancellor).do();
    }
}


export class ChaosCult extends EnemyEffectModifier<Denizen> {
    name = "Chaos Cult";
    static modifiedEffect = SetNewOathkeeperEffect;
    effect: SetNewOathkeeperEffect;

    applyAfter(): void {
        new MoveResourcesToTargetEffect(this.game, this.source.ruler, OathResource.Favor, 1, this.source.ruler, this.effect.player).do();
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
        new RegionDiscardEffect(effect.player, [OathSuit.Beast, OathSuit.Nomad]).do();
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
export class VowOfPovertyRest extends AccessedActionModifier<Denizen> {
    name = "Vow of Poverty";
    static modifiedAction = RestAction;
    action: RestAction;

    applyBefore(): boolean {
        new AddActionToStackEffect(new TakeFavorFromBankAction(this.action.player, 2)).do();
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

    usePower(player: OathPlayer): void {
        new AddActionToStackEffect(new PiedPiperAction(player, this.source)).do();
    }
}



//////////////////////////////////////////////////
//                    SITES                     //
//////////////////////////////////////////////////
export abstract class SiteActionModifier extends ActionModifier<Site> {
    canUse(): boolean {
        return this.action.player.site === this.source;
    }
}


export abstract class HomelandSitePower extends EffectModifier<Site> {
    static modifiedEffect = PlayWorldCardEffect;
    effect: PlayWorldCardEffect;
    abstract suit: OathSuit;

    applyAfter(): void {
        // TODO: "and if you have not discarded a <suit> card here during this turn"
        if (this.effect.site === this.source && this.effect.card instanceof Denizen && this.effect.card.suit === this.suit)
            this.giveReward(this.effect.player);
    }

    abstract giveReward(player: OathPlayer): void;
}

export class Wastes extends HomelandSitePower {
    name = "Wastes";
    suit = OathSuit.Discord;

    giveReward(player: OathPlayer): void {
        for (const relic of this.source.relics) return new TakeOwnableObjectEffect(this.game, player, relic).do();
    }
}

export class StandingStones extends HomelandSitePower {
    name = "Standing Stones";
    suit = OathSuit.Arcane;

    giveReward(player: OathPlayer): void {
        new PutResourcesOnTargetEffect(this.game, player, OathResource.Secret, 1).do();
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
        new TakeResourcesFromBankEffect(this.game, player, this.game.favorBanks.get(this.suit), 1).do();
    }
}

export class Steppe extends HomelandSitePower {
    name = "Steppe";
    suit = OathSuit.Nomad;

    giveReward(player: OathPlayer): void {
        new PutResourcesOnTargetEffect(this.game, player, OathResource.Secret, 1).do();
    }
}

export class DeepWoods extends HomelandSitePower {
    name = "Deep Woods";
    suit = OathSuit.Beast;

    giveReward(player: OathPlayer): void {
        for (const relic of this.source.relics) return new TakeOwnableObjectEffect(this.game, player, relic).do();
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
        new AddActionToStackEffect(new ChooseResourceToTakeAction(this.action.player, this.source)).do();
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
        new PutWarbandsFromBagEffect(this.effect.player, 1).do();
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
        for (const site of this.action.player.site.region.sites) {
            this.action.selects.site.choices.set(site.name, site);
        }

        new AddActionToStackEffect(new PeoplesFavorDiscardAction(this.action.player, this.action.discardOptions)).do();
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
            new AddActionToStackEffect(new PeoplesFavorWakeAction(this.source.owner, this.source)).do();
            if (this.source.isMob) new AddActionToStackEffect(new PeoplesFavorWakeAction(this.source.owner, this.source)).do();
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
        if (this.action.site.inRegion(RegionName.Cradle) && !this.action.player.site.inRegion(RegionName.Cradle)) this.action.noSupplyCost = true;
        if (this.action.site.inRegion(RegionName.Hinterland)) this.action.supplyCostModifier += 1;
    }
}