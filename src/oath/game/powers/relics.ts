import { InvalidActionResolution, CitizenshipOfferAction, StartBindingExchangeAction, ExileCitizenAction, SkeletonKeyAction, TradeAction, CampaignAtttackAction, MusterAction, TravelAction, CampaignResult } from "../actions/actions";
import { DiscardOptions } from "../cards/decks";
import { Denizen, GrandScepter, Relic, Site } from "../cards/cards";
import { TakeOwnableObjectEffect, PutWarbandsFromBagEffect, PlayDenizenAtSiteEffect, MoveOwnWarbandsEffect, PeekAtCardEffect, SetGrandScepterLockEffect, GainSupplyEffect, DiscardCardEffect, DrawFromDeckEffect, RevealCardEffect } from "../effects";
import { OathResource } from "../enums";
import { OwnableObject, OathPlayer, isOwnable, Exile } from "../player";
import { ResourceCost } from "../resources";
import { AccessedActionModifier, EnemyEffectModifier, EnemyActionModifier, AccessedEffectModifier, AttackerBattlePlan, DefenderBattlePlan, ActionModifier, EffectModifier, ActivePower, RestPower } from "./powers";


export class GrandScepterSeize extends EffectModifier<GrandScepter> {
    name = "Lock the Grand Scepter";
    modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect;

    canUse(): boolean {
        return this.effect.target === this.source;
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
export abstract class GrandScepterActive extends ActivePower<GrandScepter> {
    canUse(): boolean {
        return super.canUse() && !this.sourceProxy.seizedThisTurn;
    }
}
export class GrandScepterPeek extends GrandScepterActive {
    name = "Peek at the Reliquary";

    usePower(): void {
        for (const relicProxy of this.gameProxy.chancellor.reliquary.relics) 
            if (relicProxy)
                new PeekAtCardEffect(this.action.player, relicProxy.original).do(); 
    }
}
export class GrandScepterGrantCitizenship extends GrandScepterActive {
    name = "Grant Citizenship";

    usePower(): void {
        const players = Object.values(this.gameProxy.players).filter(e => e instanceof Exile && !e.isCitizen).map(e => e.original);
        new StartBindingExchangeAction(this.action.player, CitizenshipOfferAction, players).doNext();
    }
}
export class GrandScepterExileCitizen extends GrandScepterActive {
    name = "Exile a Citizen";

    usePower(): void {
        new ExileCitizenAction(this.action.player).doNext();
    }
}

export class CupOfPlenty extends AccessedActionModifier<Relic> {
    name = "Cup of Plenty";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyBefore(): void {
        if (this.action.playerProxy.adviserSuitCount(this.action.cardProxy.suit) > 0) this.action.noSupplyCost = true;
    }
}

function circletOfCommandCheckOwnable(sourceProxy: Relic, targetProxy: OwnableObject, playerProxy: OathPlayer | undefined) {
    if (!sourceProxy.ruler) return;
    if (!playerProxy) return;
    if (targetProxy.owner !== sourceProxy.ruler) return;

    if (targetProxy !== sourceProxy)
        throw new InvalidActionResolution(`Cannot target or take objects from ${sourceProxy.ruler.name} while protected by the Circlet of Command.`);
}
export class CircletOfCommand extends EnemyEffectModifier<Relic> {
    name = "Circlet of Command";
    modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect;

    applyBefore(): void {
        const targetProxy = this.effect.maskProxyManager.get(this.effect.target);
        circletOfCommandCheckOwnable(this.sourceProxy, targetProxy, this.effect.playerProxy);
    }
}
export class CircletOfCommandCampaign extends EnemyActionModifier<Relic> {
    name = "Circlet of Command";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (isOwnable(target)) {
                const targetProxy = this.action.maskProxyManager.get(target);
                circletOfCommandCheckOwnable(this.sourceProxy, targetProxy, this.action.playerProxy);
            }

            if (target === this.sourceProxy.ruler?.original) this.action.campaignResult.defPool += 1;
        }
    }
}

export class DragonskinDrum extends AccessedActionModifier<Relic> {
    name = "Dragonskin Drum";
    modifiedAction = TravelAction;
    action: TravelAction;

    applyAfter(): void {
        new PutWarbandsFromBagEffect(this.action.player, 1).do();
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

function cursedCauldronResolution(result: CampaignResult, player: OathPlayer) {
    if (result.winner === player)
        new PutWarbandsFromBagEffect(result.winner, result.loserLoss).do();
}
export class CursedCauldronAttack extends AttackerBattlePlan<Relic> {
    name = "Cursed Cauldron";

    applyBefore(): void {
        if (!this.sourceProxy.ruler?.original) return;
        this.action.campaignResult.endCallbacks.push(() => cursedCauldronResolution(this.action.campaignResult, this.action.player));
    }
}
export class CursedCauldronDefense extends DefenderBattlePlan<Relic> {
    name = "Cursed Cauldron";

    applyBefore(): void {
        if (!this.sourceProxy.ruler?.original) return;
        this.action.campaignResult.endCallbacks.push(() => cursedCauldronResolution(this.action.campaignResult, this.action.player));
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
    
    usePower(): void {
        if (this.action.playerProxy.site.ruler?.isImperial)
            new SkeletonKeyAction(this.action.player).doNext();
    }
}

export class MapRelic extends ActivePower<Relic> {
    name = "Map";

    usePower(): void {
        new DiscardCardEffect(this.action.player, this.source, new DiscardOptions(this.game.relicDeck, true)).do();
        new GainSupplyEffect(this.action.player, 4).do();
    }
}

export class OracularPig extends ActivePower<Relic> {
    name = "Oracular Pig";

    usePower(): void {
        for (let i = 0; i < 3; i++) {
            const card = this.game.worldDeck.cards[i];
            if (card) new PeekAtCardEffect(this.action.player, card).do();
        }
    }
}

export class BrassHorse extends ActivePower<Relic> {
    name = "Brass Horse";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        const cardProxy = this.action.playerProxy.site.region.discard.cards[0];
        if (!cardProxy) return;

        new RevealCardEffect(this.game, this.action.player, cardProxy.original).do();
        
        const sites = new Set<Site>();
        if (cardProxy instanceof Denizen)
            for (const siteProxy of this.gameProxy.board.sites())
                if (siteProxy !== this.action.playerProxy.site)
                    for (const denizenProxy of siteProxy.denizens)
                        if (denizenProxy.suit === cardProxy.suit)
                            sites.add(siteProxy.original);
        
        const travelAction = new TravelAction(this.action.player, this.action.player, (s: Site) => !sites.size || sites.has(s));
        travelAction.noSupplyCost = true;
        travelAction.doNext();
    }
}