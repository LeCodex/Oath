import { CitizenshipOfferAction, StartBindingExchangeAction, SkeletonKeyAction, TradeAction, MusterAction, TravelAction, MakeDecisionAction, ChoosePlayersAction, SearchAction, ChooseCardsAction } from "../actions/actions";
import { InvalidActionResolution, ModifiableAction } from "../actions/base";
import { Denizen, GrandScepter, OathCard, Relic, Site } from "../cards/cards";
import { TakeOwnableObjectEffect, PlayDenizenAtSiteEffect, MoveOwnWarbandsEffect, PeekAtCardEffect, SetGrandScepterLockEffect, GainSupplyEffect, DrawFromDeckEffect, RevealCardEffect, PayCostToTargetEffect, BecomeExileEffect, MoveResourcesToTargetEffect, MoveDenizenToSiteEffect, MoveWorldCardToAdvisersEffect, ParentToTargetEffect } from "../actions/effects";
import { BannerKey, PlayerColor } from "../enums";
import { OathPlayer, ExileBoard } from "../player";
import { OwnableObject, isOwnable } from "../interfaces";
import { Favor, Warband, ResourceCost, Secret } from "../resources";
import { AccessedActionModifier, EnemyActionModifier, AttackerBattlePlan, DefenderBattlePlan, ActionModifier, ActivePower, RestPower, BattlePlan, EnemyAttackerCampaignModifier } from "./powers";
import { DiscardOptions } from "../cards/decks";
import { isExtended } from "../utils";


export class GrandScepterSeize extends ActionModifier<GrandScepter, TakeOwnableObjectEffect> {
    name = "Lock the Grand Scepter";
    modifiedAction = TakeOwnableObjectEffect;
    mustUse = true;

    canUse(): boolean {
        return this.action.target === this.source;
    }
    
    applyAfter(): void {
        new SetGrandScepterLockEffect(this.game, true).doNext();
    }
}
export class GrandScepterRest extends RestPower<GrandScepter> {
    name = "Unlock the Grand Scepter";

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
    name = "Peek at the Reliquary";

    usePower(): void {
        for (const slotProxy of this.gameProxy.reliquary.children) 
            if (slotProxy.children[0])
                new PeekAtCardEffect(this.action.player, slotProxy.children[0].original).doNext(); 
    }
}
export class GrandScepterGrantCitizenship extends GrandScepterActive {
    name = "Grant Citizenship";

    usePower(): void {
        const players = this.gameProxy.players.filter(e => e.board instanceof ExileBoard && !e.isImperial).map(e => e.original);
        new StartBindingExchangeAction(this.action.player, CitizenshipOfferAction, players).doNext();
    }
}
export class GrandScepterExileCitizen extends GrandScepterActive {
    name = "Exile a Citizen";

    usePower(): void {
        const citizens = [];
        for (const player of this.game.players)
            if (player.board instanceof ExileBoard && player.isImperial)
                citizens.push(player);

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
                
                const cost = new ResourceCost([[Favor, amount]]);
                new PayCostToTargetEffect(this.game, this.action.player, cost, target.board).doNext(success => {
                    if (!success) throw cost.cannotPayError;
                    new BecomeExileEffect(target).doNext();
                });
            },
            [citizens]
        ).doNext();
    }
}

export class StickyFireAttack extends AttackerBattlePlan<Relic> {
    name = "Sticky Fire";

    applyBefore(): void {
        const defender = this.action.campaignResult.defender;
        if (!defender) return;

        this.action.campaignResult.onAttackWin(() => new MakeDecisionAction(this.action.player, "Use Sticky Fire?", () => { 
            this.action.campaignResult.defenderKills(Infinity);
            new MoveResourcesToTargetEffect(this.game, this.action.player, Favor, 1, defender).doNext();
        }).doNext());
    }
}
export class StickyFireDefense extends DefenderBattlePlan<Relic> {
    name = "Sticky Fire";

    applyBefore(): void {
        const attacker = this.action.campaignResult.attacker;
        this.action.campaignResult.onAttackWin(() => new MakeDecisionAction(this.action.player, "Use Sticky Fire?", () => { 
            this.action.campaignResult.attackerKills(Infinity);
            new MoveResourcesToTargetEffect(this.game, this.action.player, Favor, 1, attacker).doNext();
        }).doNext());
    }
}

export class CursedCauldronAttack extends AttackerBattlePlan<Relic> {
    name = "Cursed Cauldron";

    applyBefore(): void {
        this.action.campaignResult.onAttackWin(() =>
            new ParentToTargetEffect(this.game, this.activator, this.activatorProxy.leader.bag.original.get(this.action.campaignResult.loserLoss)).doNext()
        );
    }
}
export class CursedCauldronDefense extends DefenderBattlePlan<Relic> {
    name = "Cursed Cauldron";

    applyBefore(): void {
        this.action.campaignResult.onAttackWin(() => 
            new ParentToTargetEffect(this.game, this.activator, this.activatorProxy.leader.bag.original.get(this.action.campaignResult.loserLoss)).doNext()
        );
    }
}

export class ObsidianCageAttack extends AttackerBattlePlan<Relic> {
    name = "Obsidian Cage";

    applyBefore(): void {
        const defender = this.action.campaignResult.defender;
        if (!defender) return;

        this.action.campaignResult.onAttackWin(() => {
            new ParentToTargetEffect(this.game, this.activator, defender.byClass(Warband), this.source).doNext();
        });
    }
}
export class ObsidianCageDefense extends DefenderBattlePlan<Relic> {
    name = "Obsidian Cage";

    applyBefore(): void {
        const attacker = this.action.campaignResult.attacker;
        this.action.campaignResult.onAttackWin(() => {
            new ParentToTargetEffect(this.game, this.activator, attacker.byClass(Warband), this.source).doNext();
        });
    }
}
export class ObsidianCageActive extends ActivePower<Relic> {
    name = "Obsidian Cage";

    usePower(): void {
        const players = new Set<OathPlayer>();
        for (const playerProxy of this.gameProxy.players)
            if (this.source.getWarbandsAmount(playerProxy.leader.original.key) + this.source.getWarbandsAmount(playerProxy.original.key) > 0)
                players.add(playerProxy.original);
        
        // TODO: "Any number"
        new ChoosePlayersAction(
            this.action.player, "Return the warbands to a player",
            (targets: OathPlayer[]) => {
                const target = targets[0];
                if (!target) return;
                new ParentToTargetEffect(this.game, target, this.source.getWarbands(target.leader.key)).doNext();
                const warbandsToSwap = this.source.getWarbands(target.key);
                new ParentToTargetEffect(this.game, target, warbandsToSwap, target.bag).doNext();
                new ParentToTargetEffect(this.game, target, target.leader.bag.get(warbandsToSwap.length)).doNext();
            },
            [players]
        ).doNext();
    }
}

export class CupOfPlenty extends AccessedActionModifier<Relic, TradeAction> {
    name = "Cup of Plenty";
    modifiedAction = TradeAction;

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
export class CircletOfCommand extends EnemyActionModifier<Relic, TakeOwnableObjectEffect> {
    name = "Circlet of Command";
    modifiedAction = TakeOwnableObjectEffect;

    applyBefore(): void {
        const targetProxy = this.action.maskProxyManager.get(this.action.target);
        circletOfCommandCheckOwnable(this.sourceProxy, targetProxy, this.action.executorProxy);
    }
}
export class CircletOfCommandCampaign extends EnemyAttackerCampaignModifier<Relic> {
    name = "Circlet of Command";

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

export class DragonskinDrum extends AccessedActionModifier<Relic, TravelAction> {
    name = "Dragonskin Drum";
    modifiedAction = TravelAction;

    applyAfter(): void {
        new ParentToTargetEffect(this.game, this.activator, this.activatorProxy.leader.original.bag.get(1)).doNext();
    }
}

export class BookOfRecords extends AccessedActionModifier<Relic, PlayDenizenAtSiteEffect> {
    name = "Book of Records";
    modifiedAction = PlayDenizenAtSiteEffect;
    mustUse = true;

    applyBefore(): void {
        this.action.getting.set(Secret, this.action.getting.get(Favor) ?? 0);
        this.action.getting.delete(Favor);
    }
}

export class RingOfDevotionMuster extends ActionModifier<Relic, MusterAction> {
    name = "Ring of Devotion";
    modifiedAction = MusterAction;
    mustUse = true;

    applyBefore(): void {
        this.action.amount += 2;
    }
}
export class RingOfDevotionRestriction extends ActionModifier<Relic, MoveOwnWarbandsEffect> {
    name = "Ring of Devotion";
    modifiedAction = MoveOwnWarbandsEffect;
    mustUse = true;

    applyBefore(): void {
        if (this.action.to instanceof Site)
            throw new InvalidActionResolution("Cannot place warbands at site with the Ring of Devotion");
    }
}

export class SkeletonKey extends ActivePower<Relic> {
    name = "Skeleton Key";
    cost = new ResourceCost([[Secret, 1]], [[Secret, 1]]);
    
    usePower(): void {
        if (this.action.playerProxy.site.ruler?.isImperial)
            new SkeletonKeyAction(this.action.player).doNext();
    }
}

export class DowsingSticks extends ActivePower<Relic> {
    name = "Dowsing Sticks";
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
    name = "Map";

    usePower(): void {
        this.source.putOnBottom(this.action.player);
        new GainSupplyEffect(this.action.player, 4).doNext();
    }
}

export class HornedMask extends ActivePower<Relic> {
    name = "Horned Mask";
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
    name = "Oracular Pig";

    usePower(): void {
        for (let i = 0; i < 3; i++) {
            const card = this.game.worldDeck.children[i];
            if (card) new PeekAtCardEffect(this.action.player, card).doNext();
        }
    }
}

export class IvoryEye extends ActivePower<Relic> {
    name = "Ivory Eye";
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
    name = "Brass Horse";
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
        travelAction.noSupplyCost = true;
        travelAction.doNext();
    }
}

export class Whistle extends ActivePower<Relic> {
    name = "Whistle";
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new ChoosePlayersAction(
            this.action.player, "Force a player to travel to you",
            (targets: OathPlayer[]) => {
                if (!targets[0]) return;
                const travelAction = new TravelAction(targets[0], this.action.player, (s: Site) => s === this.action.player.site)
                travelAction.noSupplyCost = true;
                travelAction.doNext();
                new MoveResourcesToTargetEffect(this.game, this.action.player, Secret, 1, targets[0], this.source).doNext();
            },
            [this.gameProxy.players.filter(e => e.site !== this.action.playerProxy.site).map(e => e.original)]
        ).doNext();
    }
}

export class TruthfulHarp extends ActionModifier<Relic, SearchAction> {
    name = "Truthful Harp";
    modifiedAction = SearchAction;

    applyBefore(): void {
        this.action.amount += 2;
    }

    applyAfter(): void {
        for (const card of this.action.cards) new RevealCardEffect(this.game, this.action.player, card).doNext();
    }
}

export class CrackedHorn extends ActionModifier<Relic, SearchAction> {
    name = "Cracked Horn";
    modifiedAction = SearchAction;

    applyBefore(): void {
        this.action.discardOptions = new DiscardOptions(this.game.worldDeck, true);
    }
}

export class BanditCrown extends ActionModifier<Relic, ModifiableAction> {
    name = "Bandit Crown";
    modifiedAction = ModifiableAction;
    mustUse = true;

    applyWhenApplied(): boolean {
        const rulerProxy = this.sourceProxy.ruler;
        if (!rulerProxy) return true;

        for (const siteProxy of this.gameProxy.map.sites()) {
            if (siteProxy.ruler && siteProxy.ruler !== rulerProxy.leader) continue;
            const originalFn = siteProxy.getWarbandsAmount.bind(rulerProxy);
            siteProxy.getWarbandsAmount = (color: PlayerColor | undefined) => {
                return originalFn(color) + (color === rulerProxy.leader.original.key ? siteProxy.bandits : 0);
            };
        }
        return true;
    }
}

export class GrandMask extends ActionModifier<Relic, ModifiableAction> {
    name = "Grand Mask";
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
