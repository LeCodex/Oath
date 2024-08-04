import { TradeAction, InvalidActionResolution, CampaignAtttackAction, MusterAction, UsePowerAction, CitizenshipOfferAction, StartBindingExchangeAction, ExileCitizenAction, SkeletonKeyAction } from "../actions";
import { DiscardOptions } from "../cards/decks";
import { GrandScepter, Relic, Site } from "../cards/cards";
import { TakeOwnableObjectEffect, TravelEffect, PutWarbandsFromBagEffect, PlayDenizenAtSiteEffect, CursedCauldronResolutionEffect, MoveOwnWarbandsEffect, PeekAtCardEffect, SetGrandScepterLockEffect, GainSupplyEffect, DiscardCardEffect } from "../effects";
import { OathResource } from "../enums";
import { OwnableObject, OathPlayer, isOwnable, Exile } from "../player";
import { ResourceCost } from "../resources";
import { AccessedActionModifier, EnemyEffectModifier, EnemyActionModifier, AccessedEffectModifier, AttackerBattlePlan, DefenderBattlePlan, ActionModifier, EffectModifier, ActivePower, RestPower } from "./powers";


export class GrandScepterSeize extends EffectModifier<GrandScepter> {
    name = "Lock the Grand Scepter";
    modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect;

    canUse(): boolean {
        return this.effect.target.original === this.source.original;
    }
    
    applyAfter(): void {
        new SetGrandScepterLockEffect(this.game, true).do();
    }
}
export class GrandScepterRest extends RestPower<GrandScepter> {
    name = "Unlock the Grand Scepter";

    applyAfter(): void {
        new SetGrandScepterLockEffect(this.game, false).do();
    }
}
export class GrandScepterPeek extends ActivePower<GrandScepter> {
    name = "Peek at the Reliquary";

    canUse(): boolean {
        return super.canUse() && !this.source.seizedThisTurn;
    }

    usePower(action: UsePowerAction): void {
        for (const relic of this.game.chancellor.reliquary.relics) 
            if (relic)
                new PeekAtCardEffect(action.player, relic).do(); 
    }
}
export class GrandScepterGrantCitizenship extends ActivePower<GrandScepter> {
    name = "Grant Citizenship";

    canUse(): boolean {
        return super.canUse() && !this.source.seizedThisTurn;
    }

    usePower(action: UsePowerAction): void {
        const players = Object.values(this.game.players).filter(e => e instanceof Exile && !e.isCitizen);
        new StartBindingExchangeAction(action.player, CitizenshipOfferAction, players).doNext();
    }
}
export class GrandScepterExileCitizen extends ActivePower<GrandScepter> {
    name = "Exile a Citizen";

    canUse(): boolean {
        return super.canUse() && !this.source.seizedThisTurn;
    }

    usePower(action: UsePowerAction): void {
        new ExileCitizenAction(action.player).doNext();
    }
}

export class CupOfPlenty extends AccessedActionModifier<Relic> {
    name = "Cup of Plenty";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyBefore(): void {
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
    effect: TakeOwnableObjectEffect;

    applyBefore(): void {
        circletOfCommandCheckOwnable(this.source, this.effect.target, this.effect.player);
    }
}
export class CircletOfCommandCampaign extends EnemyActionModifier<Relic> {
    name = "Circlet of Command";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (isOwnable(target)) circletOfCommandCheckOwnable(this.source, target, this.action.player);
            if (target === this.source.ruler) this.action.campaignResult.defPool += 1;
        }
    }
}

export class DragonskinWardrum extends AccessedEffectModifier<Relic> {
    name = "Dragonskin Wardrum";
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

    applyBefore(): void {
        this.effect.getting.set(OathResource.Secret, this.effect.getting.get(OathResource.Favor) || 0);
        this.effect.getting.delete(OathResource.Favor);
    }
}

export class CursedCauldronAttack extends AttackerBattlePlan<Relic> {
    name = "Cursed Cauldron";

    applyBefore(): void {
        if (!this.source.ruler) return;
        this.action.campaignResult.endEffects.push(new CursedCauldronResolutionEffect(this.source.ruler, this.action.campaignResult));
    }
}
export class CursedCauldronDefense extends DefenderBattlePlan<Relic> {
    name = "Cursed Cauldron";

    applyBefore(): void {
        if (!this.source.ruler) return;
        this.action.campaignResult.endEffects.push(new CursedCauldronResolutionEffect(this.source.ruler, this.action.campaignResult));
    }
}

export class RingOfDevotionMuster extends ActionModifier<Relic> {
    name = "Ring of Devotion";
    modifiedAction = MusterAction;
    action: MusterAction;

    applyBefore(): void {
        this.action.amount += 2;
    }
}
export class RingOfDevotionRestriction extends EffectModifier<Relic> {
    name = "Ring of Devotion";
    modifiedEffect = MoveOwnWarbandsEffect;
    effect: MoveOwnWarbandsEffect;

    applyBefore(): void {
        if (this.effect.to instanceof Site)
            throw new InvalidActionResolution("Cannot place warbands at site with the Ring of Devotion");
    }
}

export class SkeletonKey extends ActivePower<Relic> {
    name = "Skeleton Key";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Secret, 1]]);
    
    usePower(action: UsePowerAction): void {
        if (action.player.site.ruler?.isImperial)
            new SkeletonKeyAction(action.player).doNext();
    }
}

export class MapRelic extends ActivePower<Relic> {
    name = "Map";

    usePower(action: UsePowerAction): void {
        new DiscardCardEffect(action.player, this.source, new DiscardOptions(this.game.relicDeck, true)).do();
        new GainSupplyEffect(action.player, 4).do();
    }
}