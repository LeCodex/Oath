import { TradeAction, InvalidActionResolution, CampaignAtttackAction, MusterAction } from "../actions";
import { Relic, Site } from "../cards/cards";
import { TakeOwnableObjectEffect, TravelEffect, PutWarbandsFromBagEffect, PlayDenizenAtSiteEffect, CursedCauldronResolutionEffect, MoveOwnWarbandsEffect } from "../effects";
import { OathResource } from "../enums";
import { OwnableObject, OathPlayer, isOwnable } from "../player";
import { AccessedActionModifier, EnemyEffectModifier, EnemyActionModifier, AccessedEffectModifier, AttackerBattlePlan, DefenderBattlePlan, ActionModifier, EffectModifier } from "./powers";


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