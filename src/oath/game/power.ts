import { CampaignAction, CampaignAtttackAction, CampaignDefenseAction, InvalidActionResolution, OathAction, PeoplesFavorDiscardAction, PeoplesFavorWakeAction, SearchAction, SearchPlayAction, TradeAction, TravelAction, UsePowerAction, WakeAction } from "./actions";
import { Denizen, OwnableCard, Relic, Site, WorldCard } from "./cards";
import { BannerName, OathResource, OathSuit, RegionName } from "./enums";
import { Banner, DarkestSecret, PeoplesFavor, ResourceCost } from "./resources";
import { AddActionToStackEffect, OathEffect, PayCostToTargetEffect, PlayWorldCardEffect, PutResourcesOnTargetEffect, PutWarbandsFromBagEffect, TakeOwnableObjectEffect, TakeResourcesFromBankEffect, TakeWarbandsIntoBagEffect, TravelEffect } from "./effects";
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
    modifiedEffect = PlayWorldCardEffect;

    abstract whenPlayed(player: OathPlayer): void;
}

export abstract class ActionPower<T extends OathGameObject> extends OathPower<T> {
    abstract canUse(action: OathAction): boolean;
}

export abstract class ActivePower<T extends OwnableCard> extends ActionPower<T> {
    canUse(action: OathAction): boolean {
        return this.source.accessibleBy(action.player) && this.source.empty;
    }

    abstract usePower(player: OathPlayer): void;
}

export abstract class ActionModifier<T extends OathGameObject> extends ActionPower<T> {
    modifiedAction: abstract new (...args: any) => OathAction;
    mustUse = false;

    canUse(action: OathAction): boolean {
        return (action instanceof this.modifiedAction);
    }

    applyBefore(action: OathAction): boolean { return true; }   // Applied before the action's choices are made. If returns false, the execution will be interrupted
    applyDuring(action: OathAction): void { }                   // Applied right before the execution of the action
    applyAfter(action: OathAction): void { }                    // Applied after the execution of the action
}

export abstract class EnemyActionModifier<T extends OwnableCard> extends ActionModifier<T> {
    canUse(action: OathAction): boolean {
        return super.canUse(action) && (this.source.ruler === undefined || this.source.ruler.enemyWith(action.player));
    }
}

export abstract class AccessedActionModifier<T extends OwnableCard> extends ActionModifier<T> {
    canUse(action: OathAction): boolean {
        return super.canUse(action) && this.source.accessibleBy(action.player) && this.source.empty;
    }
}

export abstract class BattlePlan<T extends OwnableCard> extends ActionModifier<T> {
    canUse(action: CampaignAction): boolean {
        return super.canUse(action) && action.player.rules(this.source);
    }
}

export abstract class AttackerBattlePlan<T extends OwnableCard> extends BattlePlan<T> {
    majorAction = CampaignAtttackAction;
}

export abstract class DefenderBattlePlan<T extends OwnableCard> extends BattlePlan<T> {
    majorAction = CampaignDefenseAction;
}

export abstract class EffectModifier<T extends OathGameObject> extends OathPower<T> {
    modifiedEffect: new (...args: any) => OathEffect<any>;

    canUse(effect: OathEffect<any>): boolean {
        return effect instanceof this.modifiedEffect;
    }

    applyDuring(effect: OathEffect<any>): void { }  // Applied right before the resolution of the effect
    applyAfter(effect: OathEffect<any>): void { }   // Applied after the resolution of the effect
}

export abstract class EnemyEffectModifier<T extends OwnableCard> extends EffectModifier<T> {
    canUse(effect: OathEffect<any>): boolean {
        return super.canUse(effect) && (this.source.ruler === undefined || this.source.ruler.enemyWith(effect.player));
    }
}

export abstract class AccessedEffectModifier<T extends OwnableCard> extends EffectModifier<T> {
    canUse(effect: OathEffect<any>): boolean {
        return super.canUse(effect) && this.source.accessibleBy(effect.player);
    }
}


//////////////////////////////////////////////////
//                  DENIZENS                    //
//////////////////////////////////////////////////
// ------------------ ORDER ------------------- //
export class LongbowArchersAttack extends AttackerBattlePlan<Denizen> {
    name = "Longbow Archers";

    applyDuring(action: CampaignAtttackAction): void {
        action.campaignResult.atkPool++;
    }
}
export class LongbowArchersDefense extends DefenderBattlePlan<Denizen> {
    name = "Longbow Archers";

    applyDuring(action: CampaignDefenseAction): void {
        action.campaignResult.atkPool--;
    }
}


export class ShieldWall extends DefenderBattlePlan<Denizen> {
    name = "Shield Wall";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyDuring(action: CampaignDefenseAction): void {
        action.campaignResult.defPool += 2;
        action.campaignResult.defenderKillsEntireForce = true;
    }
}


export class Curfew extends EnemyActionModifier<Denizen> {
    name = "Curfew";
    modifiedAction = TradeAction;
    mustUse = true;

    applyDuring(action: TradeAction): void {
        if (action.card.site?.ruler === this.source.ruler) {
            if (!new PayCostToTargetEffect(this.game, action.player, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
                throw new InvalidActionResolution("Cannot pay the Curfew.");
        }
    }
}

export class TollRoads extends EnemyEffectModifier<Denizen> {
    name = "Toll Roads";
    modifiedEffect = TravelEffect;

    applyDuring(effect: TravelEffect): void {
        if (effect.site.ruler === this.source.ruler) {
            if (!new PayCostToTargetEffect(this.game, effect.player, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
                throw new InvalidActionResolution("Cannot pay the Toll Roads.");
        }
    }
}

export class ForcedLabor extends EnemyActionModifier<Denizen> {
    name = "Forced Labor";
    modifiedAction = SearchAction;
    mustUse = true;

    applyDuring(action: TradeAction): void {
        if (action.card.site?.ruler === this.source.ruler) {
            if (!new PayCostToTargetEffect(this.game, action.player, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
                throw new InvalidActionResolution("Cannot pay the Forced Labor.");
        }
    }
}


// ------------------ ARCANE ------------------- //
function additionalCostCheck(action: OathAction, cost: ResourceCost, name: string) {
    for (const modifier of action.parameters.modifiers)
        if (modifier instanceof AttackerBattlePlan)
            if (!new PayCostToTargetEffect(this.game, action.player, cost, modifier.source).do())
                throw new InvalidActionResolution(`Cannot pay for the ${name}.`);
}
export class GleamingArmorAttack extends EnemyActionModifier<Denizen> {
    name = "Gleaming Armor"
    modifiedAction = CampaignAtttackAction;
    mustUse = true;

    applyBefore(action: CampaignAtttackAction): boolean {
        additionalCostCheck(action, new ResourceCost([[OathResource.Secret, 1]]), this.name);
        return true;
    }
}
export class GleamingArmorDefense extends EnemyActionModifier<Denizen> {
    name = "Gleaming Armor"
    modifiedAction = CampaignDefenseAction;
    mustUse = true;

    applyBefore(action: CampaignDefenseAction): boolean {
        additionalCostCheck(action, new ResourceCost([[OathResource.Secret, 1]]), this.name);
        return true;
    }
}


// ------------------ HEARTH ------------------- //
export class HeartsAndMinds extends DefenderBattlePlan<Denizen> {
    name = "Hearts and Minds";
    cost = new ResourceCost([[OathResource.Favor, 3]]);

    applyBefore(action: CampaignDefenseAction): boolean {
        action.campaignResult.successful = false;
        new AddActionToStackEffect(this.game, action.next).do();

        if (this.game.banners.get(BannerName.PeoplesFavor)?.owner !== action.player)
            action.campaignResult.discardAtEnd.add(this.source);

        return false;
    }
}


export class AwaitedReturn extends AccessedActionModifier<Denizen> {
    name = "Awaited Return";
    modifiedAction = TradeAction;

    applyDuring(action: TradeAction): void {
        if (action.player.ownWarbands > 0) {
            new TakeWarbandsIntoBagEffect(action.player, 1).do();
            action.noSupplyCost = true;
        }
    }
}


// ------------------ NOMAD ------------------- //
export class WayStation extends ActionModifier<Denizen> {
    name = "Way Station";
    modifiedAction = TravelAction;

    applyDuring(action: TravelAction): void {
        if (!this.source.site) return;
        if (action.site === this.source.site) {
            if (this.source.ruler !== action.player && !new PayCostToTargetEffect(this.game, action.player, new ResourceCost([[OathResource.Favor, 1]]), this.source.ruler).do())
                return;

            action.noSupplyCost = true;
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

    applyDuring(effect: TakeOwnableObjectEffect): void {
        lostTongueCheckOwnable(this.source, effect.target, effect.player);
    }
}
export class LostTongueCampaign extends EnemyActionModifier<Denizen> {
    name = "Lost Tongue";
    modifiedAction = CampaignAtttackAction;
    
    applyDuring(action: CampaignAtttackAction): void {
        for (const target of action.campaignResult.targets)
            if (isOwnable(target)) lostTongueCheckOwnable(this.source, target, action.player);
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
    name = "Spell Breaker"
    modifiedAction = OathAction;

    applyBefore(action: OathAction): boolean {
        for (const modifier of action.parameters.modifiers)
            if (modifier.cost.totalResources.get(OathResource.Secret))
                throw new InvalidActionResolution("Cannot use powers that cost Secrets under the Spell Breaker");

        return true;
    }
}
export class SpellBreakerActive extends EnemyActionModifier<Denizen> {
    name = "Spell Breaker"
    modifiedAction = UsePowerAction;

    applyDuring(action: UsePowerAction): void {
        if (action.power.cost.totalResources.get(OathResource.Secret))
            throw new InvalidActionResolution("Cannot use powers that cost Secrets under the Spell Breaker");
    }
}


// ------------------ DISCORD ------------------- //
export class RelicThief extends EnemyEffectModifier<Denizen> {
    name = "Relic Thief";
    modifiedEffect = TakeOwnableObjectEffect;

    applyAfter(effect: TakeOwnableObjectEffect): void {
        if (!this.source.ruler) return;
        if (effect.target instanceof Relic && effect.player?.site.region === this.source.ruler.site.region) {
            // Roll dice and do stuff, probably after an action to pay the cost
        }
    }
}


export class KeyToTheCity extends WhenPlayed<Denizen> {
    name = "Key to the City";

    whenPlayed(player: OathPlayer): void {
        if (!this.source.site) return;
        
        if (this.source.site.ruler?.site !== this.source.site)
            for (const [player, amount] of this.source.site.warbands)
                new TakeWarbandsIntoBagEffect(player, amount, this.source.site).do();

        new PutWarbandsFromBagEffect(player, 1, this.source.site).do();
    }
}


export class MaxTwoAdvisers extends ActionModifier<Denizen> {
    name = "Max Two Advisers";
    modifiedAction = SearchPlayAction;
    mustUse = true;

    applyDuring(action: SearchPlayAction): void {
        if (!action.site) action.capacity = Math.min(action.capacity, 2);
    }
}


// ------------------ BEAST ------------------- //
export class Bracken extends AccessedActionModifier<Denizen> {
    name = "Bracken"
    modifiedAction = SearchAction;

    applyDuring(action: SearchAction): void {
        // Action to change the discard options
    }
}


export class InsectSwarmAttack extends EnemyActionModifier<Denizen> {
    name = "Insect Swarm"
    modifiedAction = CampaignAtttackAction;
    mustUse = true;

    applyBefore(action: CampaignAtttackAction): boolean {
        additionalCostCheck(action, new ResourceCost([], [[OathResource.Favor, 1]]), this.name);
        return true;
    }
}
export class InsectSwarmDefense extends EnemyActionModifier<Denizen> {
    name = "Insect Swarm"
    modifiedAction = CampaignDefenseAction;
    mustUse = true;

    applyBefore(action: CampaignDefenseAction): boolean {
        additionalCostCheck(action, new ResourceCost([], [[OathResource.Favor, 1]]), this.name);
        return true;
    }
}



//////////////////////////////////////////////////
//                    SITES                     //
//////////////////////////////////////////////////
export abstract class SiteActionModifier extends ActionModifier<Site> {
    canUse(action: OathAction): boolean {
        return action.player.site === this.source;
    }
}


export abstract class HomelandSitePower extends EffectModifier<Site> {
    modifiedEffect = PlayWorldCardEffect;
    abstract suit: OathSuit;

    applyAfter(effect: PlayWorldCardEffect): void {
        // TODO: "and if you have not discarded a <suit> card here during this turn"
        if (effect.site === this.source && effect.card instanceof Denizen && effect.card.suit === this.suit)
            this.giveReward(effect.player);
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
    modifiedAction = TravelAction;
    mustUse = true;

    applyDuring(action: TravelAction): void {
        for (const power of action.site.powers) {
            if (power instanceof CoastalSite) {
                action.supplyCost = 1;
                return;
            }
        }
    }
}


export class CharmingValley extends SiteActionModifier {
    name = "Charming Valley";
    modifiedAction = TravelAction;
    mustUse = true;

    applyDuring(action: TravelAction): void {
        action.supplyCostModifier += 1;
    }
}



//////////////////////////////////////////////////
//                   RELICS                     //
//////////////////////////////////////////////////
export abstract class CupOfPlenty extends AccessedActionModifier<Relic> {
    name = "Cup of Plenty"
    modifiedAction = TradeAction;

    applyDuring(action: TradeAction): void {
        if (action.player.adviserSuitCount(action.card.suit) > 0) action.noSupplyCost = true;
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

    applyDuring(effect: TakeOwnableObjectEffect): void {
        circletOfCommandCheckOwnable(this.source, effect.target, effect.player);
    }
}
export class CircletOfCommandCampaign extends EnemyActionModifier<Relic> {
    name = "Circlet of Command";
    modifiedAction = CampaignAtttackAction;
    
    applyDuring(action: CampaignAtttackAction): void {
        for (const target of action.campaignResult.targets) {
            if (isOwnable(target)) circletOfCommandCheckOwnable(this.source, target, action.player);
            if (target === this.source.ruler) action.campaignResult.defPool += 1;
        }
    }
}


export class DragonskinWardrum extends AccessedEffectModifier<Relic> {
    name = "Dragonskin Wardrum"
    modifiedEffect = TravelEffect;

    applyAfter(effect: TravelEffect): void {
        new PutWarbandsFromBagEffect(effect.player, 1).do();
    }
}



//////////////////////////////////////////////////
//                   BANNERS                    //
//////////////////////////////////////////////////
export abstract class BannerActionModifier<T extends Banner> extends ActionModifier<T> {
    canUse(action: OathAction): boolean {
        return super.canUse(action) && action.player === this.source.owner;
    }
}

export class PeoplesFavorSearch extends BannerActionModifier<PeoplesFavor> {
    name = "People's Favor";
    modifiedAction = SearchPlayAction;
    mustUse = true;  // Not strictly true, but it involves a choice either way, so it's better to alwyas include it

    applyBefore(action: SearchPlayAction): boolean {
        for (const site of action.player.site.region.sites) {
            action.selects.site.choices.set(site.name, site);
        }

        new AddActionToStackEffect(this.game, new PeoplesFavorDiscardAction(action.player, action.discardOptions)).do();
        return true;
    }
}
export class PeoplesFavorWake extends BannerActionModifier<PeoplesFavor> {
    name = "People's Favor";
    modifiedAction = WakeAction;
    mustUse = true;

    applyBefore(action: WakeAction): boolean {
        if (this.source.owner) {
            new AddActionToStackEffect(this.game, new PeoplesFavorWakeAction(this.source.owner, this.source)).do();
            if (this.source.isMob) new AddActionToStackEffect(this.game, new PeoplesFavorWakeAction(this.source.owner, this.source)).do();
        }

        return true;
    }
}


export class DarkestSecretPower extends BannerActionModifier<DarkestSecret> {
    name = "Darkest Secret";
    modifiedAction = SearchAction;
    mustUse = true;

    applyDuring(action: SearchAction): void {
        action.supplyCost = 2;
    }
}



//////////////////////////////////////////////////
//                 RELIQUARY                    //
//////////////////////////////////////////////////
export abstract class ReliquaryModifier extends ActionModifier<Reliquary> {
    mustUse = true;

    canUse(action: OathAction): boolean {
        return super.canUse(action) && action.player === this.game.chancellor;
    }
}

export class Brutal extends ReliquaryModifier {
    name = "Brutal";
    modifiedAction = CampaignAtttackAction;

    applyDuring(action: CampaignAtttackAction) {
        action.campaignResult.attackerKillsEntireForce = true;
        action.campaignResult.defenderKillsEntireForce = true;
    }
}

export class Greedy extends ReliquaryModifier {
    name = "Greedy";
    modifiedAction = SearchAction;

    applyDuring(action: SearchAction): void {
        if (action.actualSupplyCost > 2) throw new InvalidActionResolution("Cannot do a Greedy Search for more than 2 Supply.");
        action.amount += 2;
    }
}

export class Careless extends ReliquaryModifier {
    name = "Careless";
    modifiedAction = TradeAction;

    applyDuring(action: TradeAction): void {
        action.getting.set(OathResource.Secret, Math.max(0, (action.getting.get(OathResource.Secret) || 0) - 1));
        action.getting.set(OathResource.Favor, (action.getting.get(OathResource.Favor) || 0) + 1);
    }
}

export class Decadent extends ReliquaryModifier {
    name = "Decadent";
    modifiedAction = TravelAction;

    applyDuring(action: TravelAction): void {
        if (action.site.inRegion(RegionName.Cradle) && !action.player.site.inRegion(RegionName.Cradle)) action.noSupplyCost = true;
        if (action.site.inRegion(RegionName.Hinterland)) action.supplyCostModifier += 1;
    }
}