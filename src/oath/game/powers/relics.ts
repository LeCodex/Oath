import { CitizenshipOfferAction, StartBindingExchangeAction, SkeletonKeyAction, TradeAction, MusterAction, TravelAction, MakeDecisionAction, ChoosePlayersAction, SearchAction, ChooseCardsAction, ChooseNumberAction, WakeAction } from "../actions";
import { CampaignEndCallback, cannotPayError, InvalidActionResolution } from "../actions/utils";
import { OathAction } from "../actions/base";
import type { GrandScepter, OathCard, Relic} from "../model/cards";
import { Denizen, Site } from "../model/cards";
import { TakeOwnableObjectEffect, PlayDenizenAtSiteEffect, MoveOwnWarbandsEffect, PeekAtCardEffect, GainSupplyEffect, DrawFromDeckEffect, RevealCardEffect, TransferResourcesEffect, BecomeExileEffect, MoveDenizenToSiteEffect, MoveWorldCardToAdvisersEffect, ParentToTargetEffect, DiscardCardEffect } from "../actions/effects";
import type { PlayerColor } from "../enums";
import { BannerKey } from "../enums";
import type { OathPlayer} from "../model/player";
import { ExileBoard } from "../model/player";
import { isOwnable } from "../model/interfaces";
import { Favor, Warband, Secret } from "../model/resources";
import type { ResourceTransferContext, SupplyCostContext } from "../costs";
import { ResourceCost } from "../costs";
import { EnemyActionModifier, AttackerBattlePlan, DefenderBattlePlan, ActionModifier, ActivePower, BattlePlan, EnemyAttackerCampaignModifier, Accessed, ResourceTransferModifier, SupplyCostModifier, SeizeModifier, RecoverModifier } from ".";
import { DiscardOptions } from "../model/decks";
import { inclusiveRange, isExtended } from "../utils";
import { powersIndex } from "./classIndex";
import { GainPowersModifier, LosePowersModifier } from "./base";


export class RelicSeize extends SeizeModifier<Relic> {
    applyAfter() {
        new TakeOwnableObjectEffect(this.actionManager, this.action.player, this.source).doNext();
    }
}
export class RelicRecover extends RecoverModifier<Relic> {
    modify(): void {
        if (!this.source.site) return;
        const cost = this.source.site.recoverCost;
        new TransferResourcesEffect(this.actionManager, this.action.player, cost, this.game.favorBank(this.source.site.recoverSuit)).doNext(success => {
            if (!success) throw cannotPayError(cost);
        });
    }
}

export class GrandScepterPeek extends ActivePower<GrandScepter> {
    get name() { return super.name + "_PeekAtTheReliquary"; }

    usePower(): void {
        for (const slotProxy of this.gameProxy.reliquary.children) 
            if (slotProxy.children[0])
                new PeekAtCardEffect(this.actionManager, this.action.player, slotProxy.children[0].original).doNext(); 
    }
}
export class GrandScepterGrantCitizenship extends ActivePower<GrandScepter> {
    get name() { return super.name + "_GrantCitizenship"; }

    canUse(): boolean {
        return super.canUse() && !!this.game.players.filter(e => e.board instanceof ExileBoard && !e.isImperial).length;
    }

    usePower(): void {
        const exiles = this.game.players.filter(e => e.board instanceof ExileBoard && !e.isImperial);
        new StartBindingExchangeAction(this.actionManager, this.action.player, CitizenshipOfferAction, exiles).doNext();
    }
}
export class GrandScepterExileCitizen extends ActivePower<GrandScepter> {
    get name() { return super.name + "_ExileACitizen"; }

    canUse(): boolean {
        return super.canUse() && !!this.game.players.filter(e => e.board instanceof ExileBoard && e.isImperial).length;
    }

    usePower(): void {
        const citizens = this.game.players.filter(e => e.board instanceof ExileBoard && e.isImperial);
        new ChoosePlayersAction(
            this.actionManager, this.action.player, "Exile a Citizen",
            (targets: OathPlayer[]) => {
                const target = targets[0];
                if (!target) return;

                let amount = 5;
                const peoplesFavor = this.game.banners.get(BannerKey.PeoplesFavor);
                if (this.action.player === this.game.oathkeeper) amount--;
                if (this.action.player === peoplesFavor?.owner) amount--;
                if (target === this.game.oathkeeper) amount++;
                if (target === peoplesFavor?.owner) amount++;
                
                new TransferResourcesEffect(this.actionManager, this.action.player, new ResourceCost([[Favor, amount]]), target).doNext(success => {
                    if (!success) throw cannotPayError(this.selfCostContext.cost);
                    new BecomeExileEffect(this.actionManager, target).doNext();
                });
            },
            [citizens]
        ).doNext();
    }
}
export class GrandScepterTake extends LosePowersModifier(TakeOwnableObjectEffect, GrandScepterPeek, GrandScepterGrantCitizenship, GrandScepterExileCitizen) {
    canUse(): boolean {
        return this.action.target === this.source as GrandScepter;
    }
}
export class GrandScepterOn extends GainPowersModifier(WakeAction, GrandScepterPeek, GrandScepterGrantCitizenship, GrandScepterExileCitizen) {}

export class StickyFireAttack extends AttackerBattlePlan<Relic> {
    applyBefore(): void {
        const defender = this.action.campaignResult.defender;
        if (!defender) return;

        this.action.campaignResult.onAttackWin(new CampaignEndCallback(() => new MakeDecisionAction(this.actionManager, this.action.player, "Use Sticky Fire?", () => { 
            this.action.campaignResult.defenderKills(Infinity);
            new TransferResourcesEffect(this.actionManager, this.action.player, new ResourceCost([[Favor, 1]]), defender).doNext();
        }).doNext(), this.source.name, false));
    }
}
export class StickyFireDefense extends DefenderBattlePlan<Relic> {
    applyBefore(): void {
        const attacker = this.action.campaignResult.attacker;
        this.action.campaignResult.onAttackWin(new CampaignEndCallback(() => new MakeDecisionAction(this.actionManager, this.action.player, "Use Sticky Fire?", () => { 
            this.action.campaignResult.attackerKills(Infinity);
            new TransferResourcesEffect(this.actionManager, this.action.player, new ResourceCost([[Favor, 1]]), attacker).doNext();
        }).doNext(), this.source.name, false));
    }
}

export class CursedCauldronAttack extends AttackerBattlePlan<Relic> {
    applyBefore(): void {
        this.action.campaignResult.onAttackWin(new CampaignEndCallback(() =>
            new ParentToTargetEffect(this.actionManager, this.player, this.playerProxy.leader.bag.original.get(this.action.campaignResult.loserLoss)).doNext(),
            this.source.name, false
        ));
    }
}
export class CursedCauldronDefense extends DefenderBattlePlan<Relic> {
    applyBefore(): void {
        this.action.campaignResult.onAttackWin(new CampaignEndCallback(
            () => new ParentToTargetEffect(this.actionManager, this.player, this.playerProxy.leader.bag.original.get(this.action.campaignResult.loserLoss)).doNext(),
            this.source.name, false
        ));
    }
}

export class ObsidianCageAttack extends AttackerBattlePlan<Relic> {
    applyBefore(): void {
        const defender = this.action.campaignResult.defender;
        if (!defender) return;

        this.action.campaignResult.onAttackWin(new CampaignEndCallback(
            () => new ParentToTargetEffect(this.actionManager, this.player, defender.byClass(Warband), this.source).doNext(),
            this.source.name, false
        ));
    }
}
export class ObsidianCageDefense extends DefenderBattlePlan<Relic> {
    applyBefore(): void {
        const attacker = this.action.campaignResult.attacker;
        this.action.campaignResult.onAttackWin(new CampaignEndCallback(
            () => new ParentToTargetEffect(this.actionManager, this.player, attacker.byClass(Warband), this.source).doNext(),
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
            this.actionManager, this.action.player, "Return the warbands to a player",
            (targets: OathPlayer[]) => {
                const target = targets[0];
                if (!target) return;
                new ChooseNumberAction(
                    this.actionManager, this.action.player, "Choose how many to return",
                    inclusiveRange(1, this.source.getWarbandsAmount(target.leader.board.key)),
                    (amount: number) => {
                        new ParentToTargetEffect(this.actionManager, target, this.source.getWarbands(target.leader.board.key).max(amount)).doNext();
                        const warbandsToSwap = this.source.getWarbands(target.board.key).max(amount);
                        new ParentToTargetEffect(this.actionManager, target, warbandsToSwap, target.bag).doNext();
                        new ParentToTargetEffect(this.actionManager, target, target.leader.bag.get(warbandsToSwap.length)).doNext();
                    }
                )
            },
            [players]
        ).doNext();
    }
}

export class CupOfPlenty extends Accessed(SupplyCostModifier<Relic>) {
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

export class DragonskinDrum extends Accessed(ActionModifier<Relic, TravelAction>) {
    modifiedAction = TravelAction;

    applyAfter(): void {
        new ParentToTargetEffect(this.actionManager, this.player, this.playerProxy.leader.original.bag.get(1)).doNext();
    }
}

export class BookOfRecords extends Accessed(ResourceTransferModifier<Relic>) {
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
            new SkeletonKeyAction(this.actionManager, this.action.player).doNext();
    }
}

export class DowsingSticks extends ActivePower<Relic> {
    cost = new ResourceCost([[Secret, 1]], [[Favor, 2]]);
    
    usePower(): void {
        new DrawFromDeckEffect(this.actionManager, this.action.player, this.game.relicDeck, 1).doNext(cards => {
            if (!cards[0]) return;
            const relic = cards[0];
            new MakeDecisionAction(
                this.actionManager, this.action.player, "Keep the relic?",
                () => new TakeOwnableObjectEffect(this.actionManager, this.action.player, relic).doNext(),
                () => new DiscardCardEffect(this.actionManager, this.action.player, relic, new DiscardOptions(this.game.relicDeck, true)).doNext()
            ).doNext();
        });
    }
}

export class MapRelic extends ActivePower<Relic> {
    usePower(): void {
        new DiscardCardEffect(this.actionManager, this.action.player, this.source, new DiscardOptions(this.game.relicDeck, true)).doNext()
        new GainSupplyEffect(this.actionManager, this.action.player, 4).doNext();
    }
}

export class HornedMask extends ActivePower<Relic> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const advisers = [...this.action.playerProxy.advisers].filter(e => e instanceof Denizen).map(e => e.original);
        const denizens = [...this.action.playerProxy.site.denizens].map(e => e.original);

        new ChooseCardsAction(
            this.actionManager, this.action.player, "Swap an adviser with a denizen at your site", [advisers, denizens],
            (adviserChoices: Denizen[], denizenChoices: Denizen[]) => {
                if (!adviserChoices[0] || !denizenChoices[0]) return;
                const otherSite = denizenChoices[0].site as Site;
                new MoveDenizenToSiteEffect(this.actionManager, this.action.player, adviserChoices[0], otherSite).doNext();
                new MoveWorldCardToAdvisersEffect(this.actionManager, this.action.player, denizenChoices[0]).doNext();
            }
        ).doNext();
    }
}

export class OracularPig extends ActivePower<Relic> {
    usePower(): void {
        for (let i = 0; i < 3; i++) {
            const card = this.game.worldDeck.children[i];
            if (card) new PeekAtCardEffect(this.actionManager, this.action.player, card).doNext();
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
            this.actionManager, this.action.player, "Peek at a card", [cards],
            (cards: OathCard[]) => { if (cards[0]) new PeekAtCardEffect(this.actionManager, this.action.player, cards[0]).doNext(); }
        ).doNext();
    }
}

export class BrassHorse extends ActivePower<Relic> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const cardProxy = this.action.playerProxy.site.region?.discard.children[0];
        if (!cardProxy) return;

        new RevealCardEffect(this.actionManager, this.action.player, cardProxy.original).doNext();
        
        const sites = new Set<Site>();
        if (cardProxy instanceof Denizen)
            for (const siteProxy of this.gameProxy.map.sites())
                if (siteProxy !== this.action.playerProxy.site)
                    for (const denizenProxy of siteProxy.denizens)
                        if (denizenProxy.suit === cardProxy.suit)
                            sites.add(siteProxy.original);
        
        const travelAction = new TravelAction(this.actionManager, this.action.player, this.action.player, (s: Site) => !sites.size || sites.has(s));
        travelAction.supplyCost.multiplier = 0;
        travelAction.doNext();
    }
}

export class Whistle extends ActivePower<Relic> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new ChoosePlayersAction(
            this.actionManager, this.action.player, "Force a player to travel to you",
            (targets: OathPlayer[]) => {
                if (!targets[0]) return;
                const travelAction = new TravelAction(this.actionManager, targets[0], this.action.player, (site: Site) => site === this.action.player.site);
                travelAction.supplyCost.multiplier = 0;
                travelAction.doNext();
                new TransferResourcesEffect(this.actionManager, this.player, new ResourceCost([[Secret, 1]]), targets[0], this.source).doNext();
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
        for (const card of this.action.cards) new RevealCardEffect(this.actionManager, this.action.player, card).doNext();
    }
}

export class CrackedHorn extends ActionModifier<Relic, SearchAction> {
    modifiedAction = SearchAction;

    applyBefore(): void {
        this.action.discardOptions = new DiscardOptions(this.game.worldDeck, true);
    }
}

export class BanditCrown extends ActionModifier<Relic, OathAction> {
    modifiedAction = OathAction;
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

export class GrandMask extends ActionModifier<Relic, OathAction> {
    modifiedAction = OathAction;
    mustUse = true;

    applyWhenApplied(): boolean {
        const rulerProxy = this.sourceProxy.ruler;
        if (rulerProxy !== this.gameProxy.currentPlayer) return true;

        for (const siteProxy of this.gameProxy.map.sites()) {
            if (!siteProxy.ruler?.isImperial) continue;
            for (const denizenProxy of siteProxy.denizens) {
                if (![...denizenProxy.powers].some(e => isExtended(powersIndex[e], BattlePlan))) continue;
                denizenProxy.ruler = rulerProxy.original;
            }
        }

        return true;
    }
}
