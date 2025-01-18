import { SearchAction, CampaignAttackAction, CampaignDefenseAction, TradeAction, TakeFavorFromBankAction, ActAsIfAtSiteAction, MakeDecisionAction, CampaignAction, ChoosePlayersAction, ChooseCardsAction, ChooseSuitsAction, KillWarbandsOnTargetAction, MusterAction, TravelAction, SearchPlayOrDiscardAction, BrackenAction, TradeForSecretAction } from "../actions";
import { InvalidActionResolution } from "../actions/utils";
import { Denizen, Edifice, GrandScepter, Relic, Site } from "../model/cards";
import { BecomeCitizenEffect, DiscardCardEffect, TransferResourcesEffect, DrawFromDeckEffect, FinishChronicleEffect, GainSupplyEffect, MoveDenizenToSiteEffect, MoveWorldCardToAdvisersEffect, ParentToTargetEffect, PlayWorldCardEffect, RegionDiscardEffect, TakeOwnableObjectEffect } from "../actions/effects";
import { CardRestriction, OathSuit } from "../enums";
import { WithPowers } from "../model/interfaces";
import { ExileBoard, OathPlayer } from "../model/player";
import { Favor, Warband, Secret } from "../model/resources";
import { ResourceCost } from "../costs";
import { ResourceTransferContext, SupplyCostContext } from "./context";
import { AttackerBattlePlan, DefenderBattlePlan, WhenPlayed, RestPower, ActivePower, EnemyAttackerCampaignModifier, EnemyDefenderCampaignModifier, Accessed, ActionModifier, EnemyActionModifier, BattlePlan, ResourceTransferModifier, NoSupplyCostActionModifier, SupplyCostModifier } from ".";
import { AttackDieSymbol, DefenseDieSymbol } from "../dice";
import { DiscardOptions } from "../model/decks";


export class NatureWorshipAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool += this.player.suitAdviserCount(OathSuit.Beast);
    }
}
export class NatureWorshipDefense extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool -= this.player.suitAdviserCount(OathSuit.Beast);
    }
}

export class WarTortoiseAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.defRoll.ignore.add(DefenseDieSymbol.TwoShields);
    }
}
export class WarTortoiseDefense extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkRoll.ignore.add(AttackDieSymbol.TwoSwords);
    }
}

export class Rangers extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkRoll.ignore.add(AttackDieSymbol.Skull);
        if (this.action.campaignResult.defPool >= 4) this.action.campaignResult.atkPool += 2;
    }
}

export class WalledGarden extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (target !== this.source.site) return;
            for (const siteProxy of this.gameProxy.map.sites())
                for (const denizenProxy of siteProxy.denizens)
                    if (denizenProxy.suit === OathSuit.Beast)
                        this.action.campaignResult.defPool++;
        }
    }
}

@Accessed
export class Bracken extends ActionModifier<Denizen, SearchAction> {
    modifiedAction = SearchAction;

    applyBefore(): void {
        new BrackenAction(this.action).doNext();
    }
}

@Accessed
export class ErrandBoy extends ActionModifier<Denizen, SearchAction> {
    modifiedAction = SearchAction;
    cost = new ResourceCost([[Favor, 1]]);

    applyAtStart(): void {
        for (const regionProxy of this.gameProxy.map.children)
            this.action.selects.deckProxy.choices.set(regionProxy.name, regionProxy.discard.original);
    }
}

@Accessed
export class ForestPaths extends ActionModifier<Denizen, TravelAction> {
    modifiedAction = TravelAction;
    cost = new ResourceCost([[Favor, 1]]);

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TravelAction>>): Iterable<ActionModifier<WithPowers, TravelAction>> {
        return [...modifiers].filter(e => e.source instanceof Site);
    }

    applyAtStart(): void {
        this.action.selects.siteProxy.filterChoices(e => [...e.denizens].some(e => e.suit === OathSuit.Beast));
    }
}
export class ForestPathsCost extends NoSupplyCostActionModifier(ForestPaths) { }

@Accessed
export class NewGrowth extends ActionModifier<Denizen, SearchPlayOrDiscardAction> {
    modifiedAction = SearchPlayOrDiscardAction;

    applyAtStart(): void {
        if (!(this.action.cardProxy instanceof Denizen) || this.action.cardProxy.restriction === CardRestriction.Adviser) return;
        if (this.action.cardProxy.suit !== OathSuit.Beast && this.action.cardProxy.suit !== OathSuit.Hearth) return;

        for (const site of this.game.map.sites())
            if (!site.facedown)
                this.action.selects.choice.choices.set(site.visualName(this.action.player), site);
    }
}

@Accessed
export class WildCry extends ActionModifier<Denizen, PlayWorldCardEffect> {
    modifiedAction = PlayWorldCardEffect;

    applyBefore(): void {
        if (!this.action.facedown && this.action.card instanceof Denizen && this.action.card.suit === OathSuit.Beast) {
            new GainSupplyEffect(this.action.executor, 1).doNext();
            new ParentToTargetEffect(this.game, this.action.executor, this.action.executorProxy.leader.original.bag.get(2)).doNext();
        }
    }
}

@Accessed
export class AnimalPlaymates extends SupplyCostModifier<Denizen> {
    canUse(context: SupplyCostContext): boolean {
        return context.origin instanceof MusterAction;
    }

    apply(context: SupplyCostContext): void {
        if ((context.origin as MusterAction).cardProxy.suit === OathSuit.Beast)
            context.cost.multiplier = 0;
    }
}

@Accessed
export class Birdsong extends SupplyCostModifier<Denizen> {
    canUse(context: SupplyCostContext): boolean {
        return context.origin instanceof TradeAction;
    }

    apply(context: SupplyCostContext): void {
        const action = context.origin as TradeAction;
        if (action.cardProxy.suit === OathSuit.Beast || action.cardProxy.suit === OathSuit.Nomad)
            context.cost.multiplier = 0;
    }
}

@Accessed
export class TheOldOak extends ResourceTransferModifier<Denizen> {
    mustUse = true;

    canUse(context: ResourceTransferContext): boolean {
        return context.origin instanceof TradeForSecretAction;
    }

    apply(context: ResourceTransferContext): void {
        if (context.source === this.sourceProxy && [...this.playerProxy.advisers].some(e => e instanceof Denizen && e.suit === OathSuit.Beast))
            context.cost.placedResources.set(Secret, context.cost.placedResources.get(Secret) + 1);
    }

    applyBefore(): void {
    }
}

@Accessed
export class Mushrooms extends ActionModifier<Denizen, SearchAction> {
    modifiedAction = SearchAction;
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        const discard = this.playerProxy.site.region?.discard;
        if (!discard) return;
        this.action.amount -= 2;  // So it plays well with other amount modifiers
        this.action.deckProxy = discard;
        this.action.fromBottom = true;
    }
}
export class MushroomsCost extends NoSupplyCostActionModifier(Mushrooms) { }

export class MarshSpirit extends ActionModifier<Denizen, CampaignAttackAction> {
    modifiedAction = CampaignAttackAction;
    mustUse = true;

    applyBefore(): void {
        for (const targetProxy of this.action.campaignResult.targets)
            if (targetProxy === this.sourceProxy.site && this.action.modifiers.some(e => e instanceof AttackerBattlePlan))
                throw new InvalidActionResolution("Cannot use battle plans when targeting the Marsh Spirit's site");
    }
}

export class ForestCouncilTrade extends EnemyActionModifier<Denizen, TradeAction> {
    modifiedAction = TradeAction;

    applyAtStart(): void {
        this.action.selects.cardProxy.filterChoices(e => e.suit !== OathSuit.Beast);
    }
}
export class ForestCouncilMuster extends EnemyActionModifier<Denizen, MusterAction> {
    modifiedAction = MusterAction;

    applyAtStart(): void {
        this.action.selects.cardProxy.filterChoices(e => e.suit !== OathSuit.Beast);
    }
}

export class GraspingVines extends EnemyActionModifier<Denizen, TravelAction> {
    modifiedAction = TravelAction;

    applyBefore(): void {
        if (this.action.maskProxyManager.get(this.action.travelling).site == this.sourceProxy.site)
            new KillWarbandsOnTargetAction(this.action.travelling, this.action.travelling, 1).doNext();
    }
}

export class InsectSwarm extends ResourceTransferModifier<Denizen> {
    mustUse = true;

    canUse(context: ResourceTransferContext): boolean {
        if (!(context.origin instanceof BattlePlan)) return false;
        const campaignResult = (context.origin.action as CampaignAttackAction | CampaignDefenseAction).campaignResult;
        const ruler = this.sourceProxy.ruler?.original;
        return campaignResult.areEnemies(ruler, this.player);
    }

    apply(context: ResourceTransferContext): void {
        context.cost.add(new ResourceCost([], [[Favor, 1]]));
    }
}

export class ThreateningRoar extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        new RegionDiscardEffect(this.action.executor, [OathSuit.Beast, OathSuit.Nomad], this.source).doNext();
    }
}

export class AnimalHost extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        let amount = 0;
        for (const siteProxy of this.gameProxy.map.sites())
            for (const denizenProxy of siteProxy.denizens)
                if (denizenProxy.suit === OathSuit.Beast)
                    amount++;

        new ParentToTargetEffect(this.game, this.action.executor, this.action.executorProxy.leader.original.bag.get(amount)).doNext();
    }
}

@Accessed
export class VowOfPoverty extends ActionModifier<Denizen, TradeAction> {
    modifiedAction = TradeAction;
    mustUse = true;

    applyBefore(): void {
        this.action.getting.set(Favor, -Infinity);
    }
}
export class VowOfPovertyRest extends RestPower<Denizen> {
    applyAfter(): void {
        if (this.playerProxy.byClass(Favor).length === 0)
            new TakeFavorFromBankAction(this.player, 2).doNext();
    }
}

@Accessed
export class VowOfUnionAttack extends ActionModifier<Denizen, CampaignAttackAction> {
    modifiedAction = CampaignAttackAction;
    mustUse = true;

    applyBefore(): void {
        for (const siteProxy of this.gameProxy.map.sites())
            if (siteProxy.ruler === this.sourceProxy.ruler?.leader)
                this.action.campaignResult.atkForce.add(siteProxy.original);
    }
}
@Accessed
export class VowOfUnionTravel extends ActionModifier<Denizen, TravelAction> {
    modifiedAction = TravelAction;
    mustUse = true;

    applyWhenApplied(): boolean {
        // Don't cause an error, just prevent the action
        return !this.playerProxy.site.getWarbands(this.playerProxy.leader.board.original.key);
    }
}

@Accessed
export class VowOfBeastkin extends ActionModifier<Denizen, MusterAction> {
    modifiedAction = MusterAction;
    mustUse = true;

    applyAtStart(): void {
        const newChoices = [...this.action.selects.cardProxy.choices].filter(([_, e]) => this.action.playerProxy.suitAdviserCount(e.suit) > 0)
        this.action.selects.cardProxy.choices = new Map(newChoices);
        this.action.getting++;
    }
}

@Accessed
export class SmallFriends extends ActionModifier<Denizen, TradeAction> {
    modifiedAction = TradeAction;

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TradeAction>>): Iterable<ActionModifier<WithPowers, TradeAction>> {
        // Ignore all other modifiers, since we are going to select them again anyways
        return [...modifiers].filter(e => e !== this);
    }

    applyWhenApplied(): boolean {
        const sites = new Set<Site>();
        for (const siteProxy of this.gameProxy.map.sites())
            if (siteProxy !== this.playerProxy.site)
                for (const denizenProxy of siteProxy.denizens)
                    if (denizenProxy.suit === OathSuit.Beast)
                        sites.add(siteProxy.original);

        new ActAsIfAtSiteAction(this.player, this.action, sites).doNext();
        return false;
    }
}

export class GiantPython extends EnemyAttackerCampaignModifier<Denizen> {
    applyBefore(): void {
        if (this.action.campaignResult.defPool % 2 == 1)
            throw new InvalidActionResolution("Must declare an even number of defense die against the Giant Python");
    }
}

export class TrueNamesAttack extends EnemyAttackerCampaignModifier<Denizen> {
    applyBefore(): void {
        if (!this.sourceProxy.ruler) return;
        const suits = [...this.sourceProxy.ruler?.advisers].filter(e => e instanceof Denizen).map(e => e.suit);
        
        for (const modifier of this.action.modifiers)
            if (
                modifier instanceof AttackerBattlePlan && modifier.sourceProxy instanceof Denizen && 
                suits.includes(modifier.sourceProxy.suit)
            )
                throw new InvalidActionResolution("Cannot use battle plans of suits matching the advisers of the ruler of True Names");
    }
}
export class TrueNamesDefense extends EnemyDefenderCampaignModifier<Denizen> {
    applyBefore(): void {
        if (!this.sourceProxy.ruler) return;
        const suits = [...this.sourceProxy.ruler?.advisers].filter(e => e instanceof Denizen).map(e => e.suit);
        
        for (const modifier of this.action.modifiers)
            if (
                modifier instanceof DefenderBattlePlan && modifier.sourceProxy instanceof Denizen && 
                suits.includes(modifier.sourceProxy.suit)
            )
                throw new InvalidActionResolution("Cannot use battle plans of suits matching the advisers of the ruler of True Names");
    }
}

export class LongLostHeir extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        if (!(this.action.playerProxy.board instanceof ExileBoard)) return;
        new MakeDecisionAction(this.action.executor, "Become a Citizen?", () => new BecomeCitizenEffect(this.action.executor).doNext());
    }
}

export class WildAllies extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const campaignAction = new CampaignAction(this.action.player);
        campaignAction.supplyCost.multiplier = 0;

        const sites = new Set<Site>();
        for (const siteProxy of this.gameProxy.map.sites()) {
            for (const denizenProxy of siteProxy.denizens) {
                if (denizenProxy.suit === OathSuit.Beast) {
                    sites.add(siteProxy.original);
                    break;
                }
            }
        }
        
        new ActAsIfAtSiteAction(this.action.player, campaignAction, sites).doNext();
    }
}

export class Wolves extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new ChoosePlayersAction(
            this.action.player, "Kill a warband",
            (targets: OathPlayer[]) => { if (targets[0]) new KillWarbandsOnTargetAction(this.action.player, targets[0], 1).doNext(); },
            [this.game.players]
        ).doNext();
    }
}

export class PiedPiper extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new ChoosePlayersAction(
            this.action.player, "Send the Pied Piper to steal 2 favor",
            (targets: OathPlayer[]) => {
                if (!targets[0]) return;
                new TransferResourcesEffect(this.game, new ResourceTransferContext(this.action.player, this, new ResourceCost([[Favor, 2]]), this.action.player, targets[0])).doNext();
                new MoveWorldCardToAdvisersEffect(this.game, this.action.player, this.source, targets[0]).doNext();
            }
        ).doNext();
    }
}

export class FaeMerchant extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new DrawFromDeckEffect(this.action.player, this.game.relicDeck, 1).doNext(cards => {
            const relic = cards[0];
            if (!relic) return;
            
            new TakeOwnableObjectEffect(this.game, this.action.player, relic).doNext();
            new ChooseCardsAction(
                this.action.player, "Discard a relic", [[...this.action.playerProxy.relics].filter(e => !(e instanceof GrandScepter)).map(e => e.original)],
                (cards: Relic[]) => { if (cards[0]) new DiscardCardEffect(this.action.player, cards[0], new DiscardOptions(this.game.relicDeck, true)).doNext(); }
            ).doNext();
        });
    }
}

export class SecondChance extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const players = new Set<OathPlayer>();
        for (const playerProxy of this.gameProxy.players) {
            for (const adviserProxy of playerProxy.advisers) {
                if (adviserProxy instanceof Denizen && (adviserProxy.suit === OathSuit.Order || adviserProxy.suit === OathSuit.Discord)) {
                    players.add(playerProxy.original);
                    break;
                }
            }
        }

        new ChoosePlayersAction(
            this.action.player, "Kill a warband",
            (targets: OathPlayer[]) => {
                if (!targets[0]) return;
                new KillWarbandsOnTargetAction(this.action.player, targets[0], 1).doNext();
                new ParentToTargetEffect(this.game, this.action.player, this.action.playerProxy.leader.original.bag.get(1), this.action.player).doNext();
            },
            [players]
        ).doNext();
    }
}

export class MemoryOfNature extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        let amount = 0;
        for (const siteProxy of this.gameProxy.map.sites())
            for (const denizenProxy of siteProxy.denizens)
                if (denizenProxy.suit === OathSuit.Beast) amount++;

        this.moveFavor(amount);
    }

    moveFavor(amount: number) {
        new ChooseSuitsAction(
            this.action.player, "Move a favor from one bank to the Beast bank (" + amount + " left)",
            (suits: OathSuit[]) => {
                if (suits[0] === undefined) return;
                const from = this.game.favorBank(suits[0]);
                const to = this.game.favorBank(OathSuit.Beast);
                if (!from || !to) return;
                new ParentToTargetEffect(this.game, this.action.player, from.get(amount), to).doNext();
                if (--amount) this.moveFavor(amount);
            }
        ).doNext();
    }
}

export class RovingTerror extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new ChooseCardsAction(
            this.action.player, "Replace another card at a site",
            [[...this.gameProxy.map.sites()].reduce((a, e) => [...a, ...e.denizens], []).filter(e => !e.activelyLocked && e !== this.sourceProxy).map(e => e.original)],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                const site = cards[0].site;
                if (!site) return;
                new DiscardCardEffect(this.action.player, cards[0]).doNext();
                new MoveDenizenToSiteEffect(this.game, this.action.player, this.source, site).doNext();
            }
        ).doNext();
    }
}


export class ForestTemple extends ActionModifier<Edifice, FinishChronicleEffect> {
    modifiedAction = FinishChronicleEffect;
    mustUse = true;

    applyBefore(): void {
        for (const siteProxy of this.gameProxy.map.sites()) {
            for (const denizenProxy of siteProxy.denizens) {
                if (denizenProxy.suit === OathSuit.Beast) {
                    siteProxy.addChild(new Warband().colorize(this.action.executor.board.key));
                    break;
                }
            }
        }
    }
}

export class RuinedTemple extends EnemyActionModifier<Edifice, PlayWorldCardEffect> {
    modifiedAction = PlayWorldCardEffect;

    applyBefore(): void {
        if (!this.action.facedown && this.action.card instanceof Denizen && this.action.card.suit === OathSuit.Beast)
            throw new InvalidActionResolution("Cannot play Beast cards faceup unless you rule the Ruined Temple");
    }
}