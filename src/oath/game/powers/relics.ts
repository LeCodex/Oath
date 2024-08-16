import { InvalidActionResolution, CitizenshipOfferAction, StartBindingExchangeAction, SkeletonKeyAction, TradeAction, CampaignAtttackAction, MusterAction, TravelAction, MakeDecisionAction, ChoosePlayersAction, SearchAction, ChooseCardsAction } from "../actions/actions";
import { Denizen, GrandScepter, OathCard, Relic, Site } from "../cards/cards";
import { TakeOwnableObjectEffect, PutWarbandsFromBagEffect, PlayDenizenAtSiteEffect, MoveOwnWarbandsEffect, PeekAtCardEffect, SetGrandScepterLockEffect, GainSupplyEffect, DrawFromDeckEffect, RevealCardEffect, PayCostToTargetEffect, BecomeExileEffect, MoveWarbandsToEffect, TakeWarbandsIntoBagEffect, MoveResourcesToTargetEffect } from "../effects";
import { BannerName, OathResource } from "../enums";
import { OathPlayer, Exile } from "../player";
import { OwnableObject, isOwnable } from "../interfaces";
import { ResourceCost } from "../resources";
import { AccessedActionModifier, EnemyEffectModifier, EnemyActionModifier, AccessedEffectModifier, AttackerBattlePlan, DefenderBattlePlan, ActionModifier, EffectModifier, ActivePower, RestPower } from "./powers";
import { DiscardOptions } from "../cards/decks";


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
        for (const slotProxy of this.gameProxy.chancellor.reliquary.slots) 
            if (slotProxy.relic)
                new PeekAtCardEffect(this.action.player, slotProxy.relic.original).do(); 
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
        const players = [];
        for (const citizen of Object.values(this.game.players))
            if (citizen instanceof Exile && citizen.isCitizen)
                players.push(citizen);

        new ChoosePlayersAction(
            this.action.player, "Exile a Citizen",
            (targets: OathPlayer[]) => {
                const target = targets[0];
                if (!target) return;

                let amount = 5;
                const peoplesFavor = this.game.banners.get(BannerName.PeoplesFavor);
                if (this.action.player === this.game.oathkeeper) amount--;
                if (this.action.player === peoplesFavor?.owner) amount--;
                if (target === this.game.oathkeeper) amount++;
                if (target === peoplesFavor?.owner) amount++;

                if (!new PayCostToTargetEffect(this.game, this.action.player, new ResourceCost([[OathResource.Favor, amount]]), target).do())
                    throw new InvalidActionResolution("Cannot pay resource cost");

                new BecomeExileEffect(target).do();
            },
            players
        ).doNext();
    }
}

export class StickyFireAttack extends AttackerBattlePlan<Relic> {
    name = "Sticky Fire";

    applyBefore(): void {
        const defender = this.action.campaignResult.defender;
        if (!defender) return;

        this.action.campaignResult.onSuccessful(true, () => new MakeDecisionAction(this.action.player, "Use Sicky Fire?", () => { 
            this.action.campaignResult.defenderKills(Infinity);
            new MoveResourcesToTargetEffect(this.game, this.action.player, OathResource.Favor, 1, defender).do();
        }));
    }
}
export class StickyFireDefense extends DefenderBattlePlan<Relic> {
    name = "Sticky Fire";

    applyBefore(): void {
        const attacker = this.action.campaignResult.attacker;
        this.action.campaignResult.onSuccessful(false, () => new MakeDecisionAction(this.action.player, "Use Sicky Fire?", () => { 
            this.action.campaignResult.attackerKills(Infinity);
            new MoveResourcesToTargetEffect(this.game, this.action.player, OathResource.Favor, 1, attacker).do();
        }));
    }
}

export class CursedCauldronAttack extends AttackerBattlePlan<Relic> {
    name = "Cursed Cauldron";

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, () => new PutWarbandsFromBagEffect(this.activator.leader, this.action.campaignResult.loserLoss).do());
    }
}
export class CursedCauldronDefense extends DefenderBattlePlan<Relic> {
    name = "Cursed Cauldron";

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(false, () => new PutWarbandsFromBagEffect(this.activator.leader, this.action.campaignResult.loserLoss).do());
    }
}

export class ObsidianCageAttack extends AttackerBattlePlan<Relic> {
    name = "Obsidian Cage";

    applyBefore(): void {
        const defender = this.action.campaignResult.defender;
        if (!defender) return;

        this.action.campaignResult.onSuccessful(true, () => {
            for (const [owner, amount] of defender.warbands)
                new MoveWarbandsToEffect(this.game, this.activator, owner, amount, this.source, defender).do();
        });
    }
}
export class ObsidianCageDefense extends DefenderBattlePlan<Relic> {
    name = "Obsidian Cage";

    applyBefore(): void {
        const attacker = this.action.campaignResult.attacker;
        this.action.campaignResult.onSuccessful(false, () => {
            for (const [owner, amount] of attacker.warbands)
                new MoveWarbandsToEffect(this.game, this.activator, owner, amount, this.source, attacker).do();
        });
    }
}
export class ObsidianCageActive extends ActivePower<Relic> {
    name = "Obsidian Cage";

    usePower(): void {
        const players = new Set<OathPlayer>();
        for (const playerProxy of Object.values(this.gameProxy.players))
            if (this.source.getWarbands(playerProxy.leader.original) + this.source.getWarbands(playerProxy.original) > 0)
                players.add(playerProxy.original);
        
        // TODO: "Any number"
        new ChoosePlayersAction(
            this.action.player, "Return the warbands to a player",
            (targets: OathPlayer[]) => {
                const target = targets[0];
                if (!target) return;
                new MoveOwnWarbandsEffect(target.leader, this.source, target, Infinity).do(); 
                const amount = new TakeWarbandsIntoBagEffect(target, Infinity, this.source).do();
                new PutWarbandsFromBagEffect(target.leader, amount, target).do();
            },
            players
        ).doNext();
    }
}

export class CupOfPlenty extends AccessedActionModifier<Relic> {
    name = "Cup of Plenty";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyBefore(): void {
        if (this.activatorProxy.suitAdviserCount(this.action.cardProxy.suit) > 0) this.action.noSupplyCost = true;
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
                circletOfCommandCheckOwnable(this.sourceProxy, targetProxy, this.activatorProxy);
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
        new PutWarbandsFromBagEffect(this.activator.leader, 1).do();
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

export class DowsingSticks extends ActivePower<Relic> {
    name = "Dowsing Sticks";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Favor, 2]]);
    
    usePower(): void {
        const relic = new DrawFromDeckEffect(this.action.player, this.game.relicDeck, 1).do()[0];
        if (!relic) return;

        new MakeDecisionAction(
            this.action.player, "Keep the relic?",
            () => new TakeOwnableObjectEffect(this.game, this.action.player, relic).do(),
            () => relic.putOnBottom(this.action.player)
        );
    }
}

export class MapRelic extends ActivePower<Relic> {
    name = "Map";

    usePower(): void {
        this.source.putOnBottom(this.action.player);
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

export class IvoryEye extends ActivePower<Relic> {
    name = "Ivory Eye";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        const cards = new Set<OathCard>();
        for (const site of this.game.board.sites()) {
            if (site.facedown) cards.add(site);
            for (const relic of site.relics) cards.add(relic);
        }
        for (const player of Object.values(this.game.players))
            for (const adviser of player.advisers)
                if (adviser.facedown) cards.add(adviser);

        new ChooseCardsAction(
            this.action.player, "Peek at a card", cards,
            (cards: OathCard[]) => { if (cards.length) new PeekAtCardEffect(this.action.player, cards[0]).do(); }
        ).doNext();
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
        travelAction._noSupplyCost = true;
        travelAction.doNext();
    }
}

export class Whistle extends ActivePower<Relic> {
    name = "Whistle";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        new ChoosePlayersAction(
            this.action.player, "Force a player to travel to you",
            (targets: OathPlayer[]) => {
                if (!targets.length) return;
                const travelAction = new TravelAction(targets[0], this.action.player, (s: Site) => s === this.action.player.site)
                travelAction._noSupplyCost = true;
                travelAction.doNext();
                new MoveResourcesToTargetEffect(this.game, this.action.player, OathResource.Secret, 1, targets[0], this.source).doNext();
            },
            Object.values(this.gameProxy.players).filter(e => e.site !== this.action.playerProxy.site).map(e => e.original)
        )
    }
}

export class TruthfulHarp extends ActionModifier<Relic> {
    name = "Truthful Harp";
    modifiedAction = SearchAction;
    action: SearchAction;

    applyBefore(): void {
        this.action.amount += 2;
    }

    applyAfter(): void {
        for (const card of this.action.cards) new RevealCardEffect(this.game, this.action.player, card).do();
    }
}

export class CrackedHorn extends ActionModifier<Relic> {
    name = "Cracked Horn";
    modifiedAction = SearchAction;
    action: SearchAction;

    applyBefore(): void {
        this.action.discardOptions = new DiscardOptions(this.game.worldDeck, true);
    }
}
