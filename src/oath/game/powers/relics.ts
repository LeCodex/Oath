import { CitizenshipOfferAction, StartBindingExchangeAction, SkeletonKeyAction, TradeAction, MusterAction, TravelAction, MakeDecisionAction, ChoosePlayersAction, SearchAction, ChooseCardsAction, ChooseNumberAction } from "../actions";
import { CampaignEndCallback } from "../actions/utils";
import { InvalidActionResolution, ModifiableAction } from "../actions/base";
import { Denizen, GrandScepter, OathCard, Relic, Site } from "../cards";
import { TakeOwnableObjectEffect, PlayDenizenAtSiteEffect, MoveOwnWarbandsEffect, PeekAtCardEffect, SetGrandScepterLockEffect, GainSupplyEffect, DrawFromDeckEffect, RevealCardEffect, TransferResourcesEffect, BecomeExileEffect, MoveDenizenToSiteEffect, MoveWorldCardToAdvisersEffect, ParentToTargetEffect } from "../actions/effects";
import { BannerKey, PlayerColor } from "../enums";
import { OathPlayer, ExileBoard } from "../player";
import { isOwnable } from "../interfaces";
import { Favor, Warband, Secret } from "../resources";
import { ResourceCost , ResourceTransferContext, SupplyCostContext } from "../costs";
import { EnemyActionModifier, AttackerBattlePlan, DefenderBattlePlan, ActionModifier, ActivePower, RestPower, BattlePlan, EnemyAttackerCampaignModifier, Accessed , ResourceTransferModifier, SupplyCostModifier } from ".";
import { DiscardOptions } from "../cards/decks";
import { inclusiveRange, isExtended } from "../utils";


export class GrandScepterSeize extends ActionModifier<GrandScepter, TakeOwnableObjectEffect> {
    modifiedAction = TakeOwnableObjectEffect;
    mustUse = true;
    get name() { return super.name + "_Lock"; }

    canUse(): boolean {
        return this.action.target === this.source;
    }
    
    applyAfter(): void {
        new SetGrandScepterLockEffect(this.game, true).doNext();
    }
}
export class GrandScepterRest extends RestPower<GrandScepter> {
    get name() { return super.name + "_Unlock"; }

    applyAfter(): void {
        new SetGrandScepterLockEffect(this.game, false).doNext();
    }
}
export abstract class GrandScepterActive extends ActivePower<GrandScepter> {
    canUse(): boolean {
        return super.canUse() && !this.sourceProxy.seizedThisTurn;
    }
}
export class GrandScepterPeek extends GrandScepterActive {
    get name() { return super.name + "_PeekAtTheReliquary"; }

    usePower(): void {
        for (const slotProxy of this.gameProxy.reliquary.children) 
            if (slotProxy.children[0])
                new PeekAtCardEffect(this.action.player, slotProxy.children[0].original).doNext(); 
    }
}
export class GrandScepterGrantCitizenship extends GrandScepterActive {
    get name() { return super.name + "_GrantCitizenship"; }

    canUse(): boolean {
        return super.canUse() && !!this.game.players.filter(e => e.board instanceof ExileBoard && !e.isImperial).length;
    }

    usePower(): void {
        const exiles = this.game.players.filter(e => e.board instanceof ExileBoard && !e.isImperial);
        new StartBindingExchangeAction(this.action.player, CitizenshipOfferAction, exiles).doNext();
    }
}
export class GrandScepterExileCitizen extends GrandScepterActive {
    get name() { return super.name + "_ExileACitizen"; }

    canUse(): boolean {
        return super.canUse() && !!this.game.players.filter(e => e.board instanceof ExileBoard && e.isImperial).length;
    }

    usePower(): void {
        const citizens = this.game.players.filter(e => e.board instanceof ExileBoard && e.isImperial);
        new ChoosePlayersAction(
            this.action.player, "Exile a Citizen",
            (targets: OathPlayer[]) => {
                const target = targets[0];
                if (!target) return;

                let amount = 5;
                const peoplesFavor = this.game.banners.get(BannerKey.PeoplesFavor);
                if (this.action.player === this.game.oathkeeper) amount--;
                if (this.action.player === peoplesFavor?.owner) amount--;
                if (target === this.game.oathkeeper) amount++;
                if (target === peoplesFavor?.owner) amount++;
                
                const costContext = new ResourceTransferContext(this.action.player, this, new ResourceCost([[Favor, amount]]), target);
                new TransferResourcesEffect(this.game, costContext).doNext(success => {
                    if (!success) throw this.costContext.cost.cannotPayError;
                    new BecomeExileEffect(target).doNext();
                });
            },
            [citizens]
        ).doNext();
    }
}

export class StickyFireAttack extends AttackerBattlePlan<Relic> {
    applyBefore(): void {
        const defender = this.action.campaignResult.defender;
        if (!defender) return;

        this.action.campaignResult.onAttackWin(new CampaignEndCallback(() => new MakeDecisionAction(this.action.player, "Use Sticky Fire?", () => { 
            this.action.campaignResult.defenderKills(Infinity);
            new TransferResourcesEffect(this.game, new ResourceTransferContext(this.action.player, this, new ResourceCost([[Favor, 1]]), defender)).doNext();
        }).doNext(), this.source.name, false));
    }
}
export class StickyFireDefense extends DefenderBattlePlan<Relic> {
    applyBefore(): void {
        const attacker = this.action.campaignResult.attacker;
        this.action.campaignResult.onAttackWin(new CampaignEndCallback(() => new MakeDecisionAction(this.action.player, "Use Sticky Fire?", () => { 
            this.action.campaignResult.attackerKills(Infinity);
            new TransferResourcesEffect(this.game, new ResourceTransferContext(this.action.player, this, new ResourceCost([[Favor, 1]]), attacker)).doNext();
        }).doNext(), this.source.name, false));
    }
}

export class CursedCauldronAttack extends AttackerBattlePlan<Relic> {
    applyBefore(): void {
        this.action.campaignResult.onAttackWin(new CampaignEndCallback(() =>
            new ParentToTargetEffect(this.game, this.player, this.playerProxy.leader.bag.original.get(this.action.campaignResult.loserLoss)).doNext(),
            this.source.name, false
        ));
    }
}
export class CursedCauldronDefense extends DefenderBattlePlan<Relic> {
    applyBefore(): void {
        this.action.campaignResult.onAttackWin(new CampaignEndCallback(
            () => new ParentToTargetEffect(this.game, this.player, this.playerProxy.leader.bag.original.get(this.action.campaignResult.loserLoss)).doNext(),
            this.source.name, false
        ));
    }
}

export class ObsidianCageAttack extends AttackerBattlePlan<Relic> {
    applyBefore(): void {
        const defender = this.action.campaignResult.defender;
        if (!defender) return;

        this.action.campaignResult.onAttackWin(new CampaignEndCallback(
            () => new ParentToTargetEffect(this.game, this.player, defender.byClass(Warband), this.source).doNext(),
            this.source.name, false
        ));
    }
}
export class ObsidianCageDefense extends DefenderBattlePlan<Relic> {
    applyBefore(): void {
        const attacker = this.action.campaignResult.attacker;
        this.action.campaignResult.onAttackWin(new CampaignEndCallback(
            () => new ParentToTargetEffect(this.game, this.player, attacker.byClass(Warband), this.source).doNext(),
            this.source.name, false
        ));
    }
}
export class ObsidianCageActive extends ActivePower<Relic> {
    usePower(): void {
        const players = new Set<OathPlayer>();
        for (const playerProxy of this.gameProxy.players)
            if (this.source.getWarbandsAmount(playerProxy.leader.board.original.key) + this.source.getWarbandsAmount(playerProxy.board.original.key) > 0)
                players.add(playerProxy.original);
        
        new ChoosePlayersAction(
            this.action.player, "Return the warbands to a player",
            (targets: OathPlayer[]) => {
                const target = targets[0];
                if (!target) return;
                new ChooseNumberAction(
                    this.action.player, "Choose how many to return", inclusiveRange(1, this.source.getWarbandsAmount(target.leader.board.key)),
                    (amount: number) => {
                        new ParentToTargetEffect(this.game, target, this.source.getWarbands(target.leader.board.key).max(amount)).doNext();
                        const warbandsToSwap = this.source.getWarbands(target.board.key).max(amount);
                        new ParentToTargetEffect(this.game, target, warbandsToSwap, target.bag).doNext();
                        new ParentToTargetEffect(this.game, target, target.leader.bag.get(warbandsToSwap.length)).doNext();
                    }
                )
            },
            [players]
        ).doNext();
    }
}

@Accessed
export class CupOfPlenty extends SupplyCostModifier<Relic> {
    canUse(context: SupplyCostContext): boolean {
        return context.origin instanceof TradeAction;
    }

    apply(context: SupplyCostContext): void {
        if (this.playerProxy.suitAdviserCount(context.origin.cardProxy.suit) > 0) context.cost.multiplier = 0;
    }
}

export class CircletOfCommand extends EnemyActionModifier<Relic, TakeOwnableObjectEffect> {
    modifiedAction = TakeOwnableObjectEffect;

    applyBefore(): void {
        const targetProxy = this.action.maskProxyManager.get(this.action.target);
        if (!this.sourceProxy.ruler) return;
        if (targetProxy.owner !== this.sourceProxy.ruler) return;
        if (targetProxy === this.sourceProxy) return;
        throw new InvalidActionResolution(`Cannot take objects from ${this.sourceProxy.ruler.name} while protected by the Circlet of Command.`);
    }
}
export class CircletOfCommandCampaign extends EnemyAttackerCampaignModifier<Relic> {
    applyAtStart(): void {
        this.action.selects.targetProxies.filterChoices(e => e === this.sourceProxy || !isOwnable(e) || e.owner !== this.sourceProxy.ruler);
    }

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) 
            if (target === this.sourceProxy.ruler?.original) this.action.campaignResult.defPool += 1;
    }
}

@Accessed
export class DragonskinDrum extends ActionModifier<Relic, TravelAction> {
    modifiedAction = TravelAction;

    applyAfter(): void {
        new ParentToTargetEffect(this.game, this.player, this.playerProxy.leader.original.bag.get(1)).doNext();
    }
}

@Accessed
export class BookOfRecords extends ResourceTransferModifier<Relic> {
    modifiedAction = PlayDenizenAtSiteEffect;
    mustUse = true;

    canUse(context: ResourceTransferContext): boolean {
        return context.origin instanceof PlayDenizenAtSiteEffect;
    }

    apply(context: ResourceTransferContext): void {
        context.cost.placedResources.set(Secret, context.cost.placedResources.get(Secret) + context.cost.placedResources.get(Favor));
        context.cost.placedResources.delete(Favor);
    }
}

export class RingOfDevotionMuster extends ActionModifier<Relic, MusterAction> {
    modifiedAction = MusterAction;
    mustUse = true;

    applyBefore(): void {
        this.action.getting += 2;
    }
}
export class RingOfDevotionRestriction extends ActionModifier<Relic, MoveOwnWarbandsEffect> {
    modifiedAction = MoveOwnWarbandsEffect;
    mustUse = true;

    applyBefore(): void {
        if (this.action.to instanceof Site)
            throw new InvalidActionResolution("Cannot place warbands at site with the Ring of Devotion");
    }
}

export class SkeletonKey extends ActivePower<Relic> {
    cost = new ResourceCost([[Secret, 1]], [[Secret, 1]]);
    
    usePower(): void {
        if (this.action.playerProxy.site.ruler?.isImperial)
            new SkeletonKeyAction(this.action.player).doNext();
    }
}

export class DowsingSticks extends ActivePower<Relic> {
    cost = new ResourceCost([[Secret, 1]], [[Favor, 2]]);
    
    usePower(): void {
        new DrawFromDeckEffect(this.action.player, this.game.relicDeck, 1).doNext(cards => {
            if (!cards[0]) return;
            const relic = cards[0];
            new MakeDecisionAction(
                this.action.player, "Keep the relic?",
                () => new TakeOwnableObjectEffect(this.game, this.action.player, relic).doNext(),
                () => relic.putOnBottom(this.action.player)
            ).doNext();
        });
    }
}

export class MapRelic extends ActivePower<Relic> {
    usePower(): void {
        this.source.putOnBottom(this.action.player);
        new GainSupplyEffect(this.action.player, 4).doNext();
    }
}

export class HornedMask extends ActivePower<Relic> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const advisers = [...this.action.playerProxy.advisers].filter(e => e instanceof Denizen).map(e => e.original);
        const denizens = [...this.action.playerProxy.site.denizens].map(e => e.original);

        new ChooseCardsAction(
            this.action.player, "Swap an adviser with a denizen at your site", [advisers, denizens],
            (adviserChoices: Denizen[], denizenChoices: Denizen[]) => {
                if (!adviserChoices[0] || !denizenChoices[0]) return;
                const otherSite = denizenChoices[0].site as Site;
                new MoveDenizenToSiteEffect(this.game, this.action.player, adviserChoices[0], otherSite).doNext();
                new MoveWorldCardToAdvisersEffect(this.game, this.action.player, denizenChoices[0]).doNext();
            }
        ).doNext();
    }
}

export class OracularPig extends ActivePower<Relic> {
    usePower(): void {
        for (let i = 0; i < 3; i++) {
            const card = this.game.worldDeck.children[i];
            if (card) new PeekAtCardEffect(this.action.player, card).doNext();
        }
    }
}

export class IvoryEye extends ActivePower<Relic> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const cards = new Set<OathCard>();
        for (const site of this.game.map.sites()) {
            if (site.facedown) cards.add(site);
            for (const relic of site.relics) cards.add(relic);
        }
        for (const player of this.game.players)
            for (const adviser of player.advisers)
                if (adviser.facedown) cards.add(adviser);

        new ChooseCardsAction(
            this.action.player, "Peek at a card", [cards],
            (cards: OathCard[]) => { if (cards[0]) new PeekAtCardEffect(this.action.player, cards[0]).doNext(); }
        ).doNext();
    }
}

export class BrassHorse extends ActivePower<Relic> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const cardProxy = this.action.playerProxy.site.region?.discard.children[0];
        if (!cardProxy) return;

        new RevealCardEffect(this.game, this.action.player, cardProxy.original).doNext();
        
        const sites = new Set<Site>();
        if (cardProxy instanceof Denizen)
            for (const siteProxy of this.gameProxy.map.sites())
                if (siteProxy !== this.action.playerProxy.site)
                    for (const denizenProxy of siteProxy.denizens)
                        if (denizenProxy.suit === cardProxy.suit)
                            sites.add(siteProxy.original);
        
        const travelAction = new TravelAction(this.action.player, this.action.player, (s: Site) => !sites.size || sites.has(s));
        travelAction.supplyCost.multiplier = 0;
        travelAction.doNext();
    }
}

export class Whistle extends ActivePower<Relic> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new ChoosePlayersAction(
            this.action.player, "Force a player to travel to you",
            (targets: OathPlayer[]) => {
                if (!targets[0]) return;
                const travelAction = new TravelAction(targets[0], this.action.player, (site: Site) => site === this.action.player.site);
                travelAction.supplyCost.multiplier = 0;
                travelAction.doNext();
                new TransferResourcesEffect(this.game, new ResourceTransferContext(this.player, this, new ResourceCost([[Secret, 1]]), targets[0], this.source)).doNext();
            },
            [this.gameProxy.players.filter(e => e.site !== this.action.playerProxy.site).map(e => e.original)]
        ).doNext();
    }
}

export class TruthfulHarp extends ActionModifier<Relic, SearchAction> {
    modifiedAction = SearchAction;

    applyBefore(): void {
        this.action.amount += 2;
    }

    applyAfter(): void {
        for (const card of this.action.cards) new RevealCardEffect(this.game, this.action.player, card).doNext();
    }
}

export class CrackedHorn extends ActionModifier<Relic, SearchAction> {
    modifiedAction = SearchAction;

    applyBefore(): void {
        this.action.discardOptions = new DiscardOptions(this.game.worldDeck, true);
    }
}

export class BanditCrown extends ActionModifier<Relic, ModifiableAction> {
    modifiedAction = ModifiableAction;
    mustUse = true;

    applyWhenApplied(): boolean {
        const rulerProxy = this.sourceProxy.ruler;
        if (!rulerProxy) return true;

        for (const siteProxy of this.gameProxy.map.sites()) {
            if (siteProxy.ruler && siteProxy.ruler !== rulerProxy.leader) continue;
            const originalFn = siteProxy.getWarbandsAmount.bind(rulerProxy);
            siteProxy.getWarbandsAmount = (color: PlayerColor | undefined) => {
                return originalFn(color) + (color === rulerProxy.leader.board.original.key ? siteProxy.bandits : 0);
            };
        }
        return true;
    }
}

export class GrandMask extends ActionModifier<Relic, ModifiableAction> {
    modifiedAction = ModifiableAction;
    mustUse = true;

    applyWhenApplied(): boolean {
        const rulerProxy = this.sourceProxy.ruler;
        if (rulerProxy !== this.gameProxy.currentPlayer) return true;

        const overrideRule = new Set();
        for (const siteProxy of this.gameProxy.map.sites()) {
            if (!siteProxy.ruler?.isImperial) continue;
            for (const denizenProxy of siteProxy.denizens) {
                let isBattlePlan = false;
                for (const power of denizenProxy.powers) {
                    if (isExtended(power, BattlePlan)) {
                        isBattlePlan = true;
                        break;
                    }
                }
                if (isBattlePlan) continue;
                denizenProxy.ruler = rulerProxy.original;
            }
        }

        return true;
    }
}
