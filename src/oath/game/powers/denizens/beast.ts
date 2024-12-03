import { SearchAction, CampaignAttackAction, CampaignDefenseAction, TradeAction, TakeFavorFromBankAction, ActAsIfAtSiteAction, MakeDecisionAction, CampaignAction, ChoosePlayersAction, ChooseCardsAction, ChooseSuitsAction, KillWarbandsOnTargetAction, MusterAction, TravelAction, SearchPlayOrDiscardAction, BrackenAction } from "../../actions/actions";
import { InvalidActionResolution } from "../../actions/base";
import { Denizen, Edifice, GrandScepter, Relic, Site } from "../../cards/cards";
import { DieSymbol } from "../../dice";
import { BecomeCitizenEffect, DiscardCardEffect, DrawFromDeckEffect, FinishChronicleEffect, GainSupplyEffect, MoveDenizenToSiteEffect, MoveResourcesToTargetEffect, MoveWorldCardToAdvisersEffect, ParentToTargetEffect, PlayWorldCardEffect, RegionDiscardEffect, TakeOwnableObjectEffect } from "../../actions/effects";
import { OathSuit } from "../../enums";
import { WithPowers } from "../../interfaces";
import { OathPlayer } from "../../player";
import { Favor, OathWarband, ResourceCost, Secret } from "../../resources";
import { AttackerBattlePlan, DefenderBattlePlan, WhenPlayed, RestPower, ActivePower, EnemyAttackerCampaignModifier, EnemyDefenderCampaignModifier, AccessedActionModifier, ActionModifier, EnemyActionModifier } from "../powers";


export class NatureWorshipAttack extends AttackerBattlePlan<Denizen> {
    name = "Nature Worship";
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool += this.activator.suitAdviserCount(OathSuit.Beast);
    }
}
export class NatureWorshipDefense extends DefenderBattlePlan<Denizen> {
    name = "Nature Worship";
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool -= this.activator.suitAdviserCount(OathSuit.Beast);
    }
}

export class WarTortoiseAttack extends AttackerBattlePlan<Denizen> {
    name = "War Tortoise";
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.defRoll.ignore.add(DieSymbol.TwoShield);
    }
}
export class WarTortoiseDefense extends DefenderBattlePlan<Denizen> {
    name = "War Tortoise";
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkRoll.ignore.add(DieSymbol.TwoSword);
    }
}

export class Rangers extends AttackerBattlePlan<Denizen> {
    name = "Rangers";
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkRoll.ignore.add(DieSymbol.Skull);
        if (this.action.campaignResult.defPool >= 4) this.action.campaignResult.atkPool += 2;
    }
}

export class WalledGarden extends DefenderBattlePlan<Denizen> {
    name = "Walled Garden";

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (target !== this.source.site) return;
            for (const siteProxy of this.gameProxy.board.sites())
                for (const denizenProxy of siteProxy.denizens)
                    if (denizenProxy.suit === OathSuit.Beast)
                        this.action.campaignResult.defPool++;
        }
    }
}

export class Bracken extends AccessedActionModifier<Denizen, SearchAction> {
    name = "Bracken";
    modifiedAction = SearchAction;

    applyBefore(): void {
        new BrackenAction(this.action).doNext();
    }
}

export class ErrandBoy extends AccessedActionModifier<Denizen, SearchAction> {
    name = "Errand Boy";
    modifiedAction = SearchAction;
    cost = new ResourceCost([[Favor, 1]]);

    applyAtStart(): void {
        for (const regionProxy of Object.values(this.gameProxy.board.children))
            this.action.selects.deck.choices.set(regionProxy.name, regionProxy.discard.original);
    }
}

export class ForestPaths extends AccessedActionModifier<Denizen, TravelAction> {
    name = "Forest Paths";
    modifiedAction = TravelAction;
    cost = new ResourceCost([[Favor, 1]]);

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TravelAction>>): Iterable<ActionModifier<WithPowers, TravelAction>> {
        return [...modifiers].filter(e => e.source instanceof Site);
    }

    applyBefore(): void {
        if (![...this.action.siteProxy.denizens].some(e => e.suit === OathSuit.Beast))
            throw new InvalidActionResolution("When using the Forest Paths, you must travel to a site with a Beast card");

        this.action.noSupplyCost = true;
    }
}

export class NewGrowth extends AccessedActionModifier<Denizen, SearchPlayOrDiscardAction> {
    name = "New Growth";
    modifiedAction = SearchPlayOrDiscardAction;

    applyAtStart(): void {
        if (!(this.action.cardProxy instanceof Denizen)) return;
        if (this.action.cardProxy.suit !== OathSuit.Beast && this.action.cardProxy.suit !== OathSuit.Hearth) return;

        for (const site of this.game.board.sites())
            if (!site.facedown)
                this.action.selects.choice.choices.set(site.visualName(this.action.player), site);
    }
}

export class WildCry extends AccessedActionModifier<Denizen, PlayWorldCardEffect> {
    name = "Wild Cry";
    modifiedAction = PlayWorldCardEffect;

    applyBefore(): void {
        if (!this.action.facedown && this.action.card instanceof Denizen && this.action.card.suit === OathSuit.Beast) {
            new GainSupplyEffect(this.action.executor, 1).doNext();
            new ParentToTargetEffect(this.game, this.action.executor, this.action.executorProxy.leader.original.bag.get(2)).doNext();
        }
    }
}

export class AnimalPlaymates extends AccessedActionModifier<Denizen, MusterAction> {
    name = "Animal Playmates";
    modifiedAction = MusterAction;

    applyBefore(): void {
        if (this.action.cardProxy.suit === OathSuit.Beast)
            this.action.noSupplyCost = true;
    }
}

export class Birdsong extends AccessedActionModifier<Denizen, TradeAction> {
    name = "Birdsong";
    modifiedAction = TradeAction;

    applyBefore(): void {
        if (this.action.cardProxy.suit === OathSuit.Beast || this.action.cardProxy.suit === OathSuit.Nomad)
            this.action.noSupplyCost = true;
    }
}

export class TheOldOak extends AccessedActionModifier<Denizen, TradeAction> {
    name = "The Old Oak";
    modifiedAction = TradeAction;
    mustUse = true;

    applyBefore(): void {
        if (this.action.cardProxy === this.sourceProxy && !this.action.forFavor && [...this.action.playerProxy.advisers].some(e => e instanceof Denizen && e.suit === OathSuit.Beast))
            this.action.getting.set(Secret, (this.action.getting.get(Secret) ?? 0) + 1);
    }
}

export class Mushrooms extends AccessedActionModifier<Denizen, SearchAction> {
    name = "Mushrooms";
    modifiedAction = SearchAction;
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        const discard = this.activatorProxy.site.region?.discard;
        if (!discard) return;
        this.action.amount -= 2;  // So it plays well with other amount modifiers
        this.action.deckProxy = discard;
        this.action.fromBottom = true;
        this.action.noSupplyCost = true;
    }
}

export class MarshSpirit extends ActionModifier<Denizen, CampaignAttackAction> {
    name = "Marsh Spirit";
    modifiedAction = CampaignAttackAction;
    mustUse = true;

    applyBefore(): void {
        for (const targetProxy of this.action.campaignResult.targets)
            if (targetProxy === this.sourceProxy.site && this.action.modifiers.some(e => e instanceof AttackerBattlePlan))
                throw new InvalidActionResolution("Cannot use battle plans when targeting the Marsh Spirit's site");
    }
}

export class ForestCouncilTrade extends EnemyActionModifier<Denizen, TradeAction> {
    name = "Forest Council";
    modifiedAction = TradeAction;

    applyBefore(): void {
        if (this.action.cardProxy.suit === OathSuit.Beast)
            throw new InvalidActionResolution("Cannot trade with Beast cards under the Forest Council");
    }
}
export class ForestCouncilMuster extends EnemyActionModifier<Denizen, MusterAction> {
    name = "Forest Council";
    modifiedAction = MusterAction;

    applyBefore(): void {
        if (this.action.cardProxy.suit === OathSuit.Beast)
            throw new InvalidActionResolution("Cannot muster from Beast cards under the Forest Council");
    }
}

export class GraspingVines extends EnemyActionModifier<Denizen, TravelAction> {
    name = "Grasping Vines";
    modifiedAction = TravelAction;

    applyBefore(): void {
        if (this.action.maskProxyManager.get(this.action.travelling).site == this.sourceProxy.site)
            new KillWarbandsOnTargetAction(this.action.travelling, this.action.travelling, 1).doNext();
    }
}

export class InsectSwarmAttack extends EnemyAttackerCampaignModifier<Denizen> {
    name = "Insect Swarm";

    canUse(): boolean {
        return this.action.campaignResult.defender === this.sourceProxy.ruler?.original;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, CampaignAttackAction>>): Iterable<ActionModifier<WithPowers, CampaignAttackAction>> {
        for (const modifier of modifiers)
            if (modifier instanceof AttackerBattlePlan)
                modifier.cost.add(new ResourceCost([], [[Favor, 1]]));

        return [];
    }
}
export class InsectSwarmDefense extends EnemyDefenderCampaignModifier<Denizen> {
    name = "Insect Swarm";

    canUse(): boolean {
        return this.action.campaignResult.attacker === this.sourceProxy.ruler?.original;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, CampaignDefenseAction>>): Iterable<ActionModifier<WithPowers, CampaignDefenseAction>> {
        for (const modifier of modifiers)
            if (modifier instanceof DefenderBattlePlan)
                modifier.cost.add(new ResourceCost([], [[Favor, 1]]));

        return [];
    }
}

export class ThreateningRoar extends WhenPlayed<Denizen> {
    name = "Threatening Roar";

    whenPlayed(): void {
        new RegionDiscardEffect(this.action.executor, [OathSuit.Beast, OathSuit.Nomad], this.source).doNext();
    }
}

export class AnimalHost extends WhenPlayed<Denizen> {
    name = "Animal Host";

    whenPlayed(): void {
        let amount = 0;
        for (const siteProxy of this.gameProxy.board.sites())
            for (const denizenProxy of siteProxy.denizens)
                if (denizenProxy.suit === OathSuit.Beast)
                    amount++;

        new ParentToTargetEffect(this.game, this.action.executor, this.action.executorProxy.leader.original.bag.get(amount)).doNext();
    }
}

export class VowOfPoverty extends AccessedActionModifier<Denizen, TradeAction> {
    name = "Vow of Poverty";
    modifiedAction = TradeAction;
    mustUse = true;

    applyBefore(): void {
        this.action.getting.set(Favor, -Infinity);
    }
}
export class VowOfPovertyRest extends RestPower<Denizen> {
    name = "Vow of Poverty";

    applyAfter(): void {
        if (this.activatorProxy.byClass(Favor).length === 0)
            new TakeFavorFromBankAction(this.activator, 2).doNext();
    }
}

export class VowOfUnionAttack extends AccessedActionModifier<Denizen, CampaignAttackAction> {
    name = "Vow of Union";
    modifiedAction = CampaignAttackAction;
    mustUse = true;

    applyBefore(): void {
        for (const siteProxy of this.gameProxy.board.sites())
            if (siteProxy.ruler === this.sourceProxy.ruler?.leader)
                this.action.campaignResult.atkForce.add(siteProxy.original);
    }
}
export class VowOfUnionTravel extends AccessedActionModifier<Denizen, TravelAction> {
    name = "Vow of Union";
    modifiedAction = TravelAction;
    mustUse = true;

    applyWhenApplied(): boolean {
        // Don't cause an error, just prevent the action
        return !this.activatorProxy.site.getWarbands(this.activatorProxy.leader.original.key);
    }
}

export class VowOfBeastkin extends AccessedActionModifier<Denizen, MusterAction> {
    name = "Vow of Beastkin";
    modifiedAction = MusterAction;
    mustUse = true;

    applyBefore(): void {
        if (![...this.activatorProxy.advisers].some(e => e instanceof Denizen && e.suit === this.action.cardProxy.suit))
            throw new InvalidActionResolution("Must muster on a card matching your advisers with Vow of Beastkin");

        this.action.getting++;
    }
}

export class SmallFriends extends AccessedActionModifier<Denizen, TradeAction> {
    name = "Small Friends";
    modifiedAction = TradeAction;

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TradeAction>>): Iterable<ActionModifier<WithPowers, TradeAction>> {
        // Ignore all other modifiers, since we are going to select them again anyways
        return [...modifiers].filter(e => e !== this);
    }

    applyWhenApplied(): boolean {
        const sites = new Set<Site>();
        for (const siteProxy of this.gameProxy.board.sites())
            if (siteProxy !== this.activatorProxy.site)
                for (const denizenProxy of siteProxy.denizens)
                    if (denizenProxy.suit === OathSuit.Beast)
                        sites.add(siteProxy.original);

        if (sites.size === 0)
            throw new InvalidActionResolution("No other site with a Beast card");

        new ActAsIfAtSiteAction(this.activator, this.action, sites).doNext();
        return false;
    }
}

export class GiantPython extends EnemyAttackerCampaignModifier<Denizen> {
    name = "Giant Python";

    applyBefore(): void {
        if (this.action.campaignResult.defPool % 2 == 1)
            throw new InvalidActionResolution("Must declare an even number of defense die against the Giant Python");
    }
}

export class TrueNamesAttack extends EnemyAttackerCampaignModifier<Denizen> {
    name = "True Names";

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
    name = "True Names";

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
    name = "Long-Lost Heir";

    whenPlayed(): void {
        new MakeDecisionAction(this.action.executor, "Become a Citizen?", () => new BecomeCitizenEffect(this.action.executor).doNext());
    }
}

export class WildAllies extends ActivePower<Denizen> {
    name = "Wild Allies";
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const campaignAction = new CampaignAction(this.action.player);
        campaignAction.noSupplyCost = true;

        const sites = new Set<Site>();
        for (const siteProxy of this.gameProxy.board.sites()) {
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
    name = "Wolves";
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
    name = "Pied Piper";
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new ChoosePlayersAction(
            this.action.player, "Send the Pied Piper to steal 2 favor",
            (targets: OathPlayer[]) => {
                if (!targets[0]) return;
                new MoveResourcesToTargetEffect(this.game, this.action.player, Favor, 2, this.action.player, targets[0]).doNext();
                new MoveWorldCardToAdvisersEffect(this.game, this.action.player, this.source, targets[0]).doNext();
            }
        ).doNext();
    }
}

export class FaeMerchant extends ActivePower<Denizen> {
    name = "Fae Merchant";
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new DrawFromDeckEffect(this.action.player, this.game.relicDeck, 1).doNext(cards => {
            const relic = cards[0];
            if (!relic) return;
            
            new TakeOwnableObjectEffect(this.game, this.action.player, relic).doNext();
            new ChooseCardsAction(
                this.action.player, "Discard a relic", [[...this.action.playerProxy.relics].filter(e => !(e instanceof GrandScepter)).map(e => e.original)],
                (cards: Relic[]) => { if (cards[0]) cards[0].putOnBottom(this.action.player); }
            ).doNext();
        });
    }
}

export class SecondChance extends ActivePower<Denizen> {
    name = "SecondChance";
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
                new ParentToTargetEffect(this.game, this.action.player, this.action.playerProxy.leader.original.bag.get(1)).doNext();
            },
            [players]
        ).doNext();
    }
}

export class MemoryOfNature extends ActivePower<Denizen> {
    name = "Memory Of Nature";
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        let amount = 0;
        for (const siteProxy of this.gameProxy.board.sites())
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
    name = "Roving Terror";
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new ChooseCardsAction(
            this.action.player, "Replace another card at a site",
            [[...this.gameProxy.board.sites()].reduce((a, e) => [...a, ...e.denizens], []).filter(e => !e.activelyLocked && e !== this.sourceProxy).map(e => e.original)],
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
    name = "Forest Temple";
    modifiedAction = FinishChronicleEffect;
    mustUse = true;

    applyBefore(): void {
        for (const siteProxy of this.gameProxy.board.sites()) {
            for (const denizenProxy of siteProxy.denizens) {
                if (denizenProxy.suit === OathSuit.Beast) {
                    siteProxy.addChild(new OathWarband().colorize(this.action.executor.key));
                    break;
                }
            }
        }
    }
}

export class RuinedTemple extends EnemyActionModifier<Edifice, PlayWorldCardEffect> {
    name = "Ruined Temple";
    modifiedAction = PlayWorldCardEffect;

    applyBefore(): void {
        if (!this.action.facedown && this.action.card instanceof Denizen && this.action.card.suit === OathSuit.Beast)
            throw new InvalidActionResolution("Cannot play Beast cards faceup unless you rule the Ruined Temple");
    }
}