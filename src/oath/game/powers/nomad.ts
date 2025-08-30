import { TravelAction, MakeDecisionAction, ChooseRegionAction, SearchPlayOrDiscardAction, ChooseCardsAction, TakeFavorFromBankAction, ChooseSitesAction, MoveWarbandsBetweenBoardAndSitesAction, RestAction, TakeReliquaryRelicAction, CampaignEndAction, StartBindingExchangeAction, TheGatheringOfferAction } from "../actions";
import { ResolveCallbackEffect , OathAction } from "../actions/base";
import { InvalidActionResolution } from "../actions/utils";
import type { Region } from "../model/map";
import type { Edifice, OathCard, Site, WorldCard } from "../model/cards";
import { Denizen, Relic, VisionBack } from "../model/cards";
import { DiscardOptions } from "../model/decks";
import { TransferResourcesEffect, TakeOwnableObjectEffect, PutResourcesOnTargetEffect, BecomeCitizenEffect, DrawFromDeckEffect, FlipEdificeEffect, DiscardCardEffect, GainSupplyEffect, PutDenizenIntoDispossessedEffect, GetRandomCardFromDispossessed, PeekAtCardEffect, MoveWorldCardToAdvisersEffect, MoveDenizenToSiteEffect, DiscardCardGroupEffect, PlayVisionEffect, ParentToTargetEffect, PutPawnAtSiteEffect, RecoverTargetEffect } from "../actions/effects";
import { PayPowerCostEffect } from "./actions";
import { BannerKey, OathSuit } from "../enums";
import { isOwnable } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import { ExileBoard } from "../model/player";
import { Favor, Secret } from "../model/resources";
import type { SupplyCostContext } from "../costs";
import { ResourceTransferContext , ResourceCost } from "../costs";
import { ActivePower, CapacityModifier, AttackerBattlePlan, DefenderBattlePlan, WhenPlayed, EnemyAttackerCampaignModifier, EnemyActionModifier, ActionModifier, BattlePlan, Accessed, ResourceTransferModifier, NoSupplyCostActionModifier, SupplyCostModifier } from ".";
import { DefenseDieSymbol } from "../dice";
import { powersIndex } from "./classIndex";
import type { OathPowerManager } from "./manager";
import { LosePowersModifier } from "./base";


export class HorseArchersAttack extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.atkPool += 3;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}
export class HorseArchersDefense extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.atkPool -= 3;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class RivalKhanAttack extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        if (this.action.campaignResultProxy.defender?.suitAdviserCount(OathSuit.Nomad))
            this.action.campaignResult.atkPool += 4;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}
export class RivalKhanDefense extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        if (this.action.campaignResultProxy.attacker?.suitAdviserCount(OathSuit.Nomad))
            this.action.campaignResult.atkPool -= 4;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class GreatCrusadeAttack extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.atkPool += this.playerProxy.suitRuledCount(OathSuit.Nomad);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}
export class GreatCrusadeDefense extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.atkPool -= this.playerProxy?.suitRuledCount(OathSuit.Nomad) ?? this.gameProxy.map.suitRuledCount(this.player, OathSuit.Nomad);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class MountainGiantAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        new MakeDecisionAction(
            this.actionManager, this.player, "±1, or ±3 and discard at end?",
            () => { this.action.campaignResult.atkPool++; },
            () => {
                this.action.campaignResult.atkPool += 3;
                this.action.campaignResult.discardAtEnd(this.source);
            }, 
            ["±1", "±3"]
        ).doNext();
    }
}
export class MountainGiantDefense extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        if (!this.player) return;
        new MakeDecisionAction(
            this.actionManager, this.player, "±1, or ±3 and discard at end?",
            () => { this.action.campaignResult.atkPool--; },
            () => {
                this.action.campaignResult.atkPool -= 3;
                this.action.campaignResult.discardAtEnd(this.source);
            },
            ["±1", "±3"]
        ).doNext();
    }
}

export class WildMounts extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.source.powers.add("WildMountsReplace");
        WildMountsReplace.firstDiscardDone = false;
    }
}
export class WildMountsReplace extends ActionModifier<Denizen, DiscardCardEffect<OathCard>> {
    modifiedAction = DiscardCardEffect;

    static firstDiscardDone = false;

    constructor(powerManager: OathPowerManager, source: Denizen, player: OathPlayer, action: DiscardCardEffect<OathCard>) {
        super(powerManager, source, player, action);
        this.mustUse = WildMountsReplace.firstDiscardDone;  // All future discards must be cancelled
    }

    applyWhenApplied(): boolean {
        if (this.action.card instanceof Denizen && this.action.card.suit === OathSuit.Nomad && [...this.action.card.powers].some((e) => powersIndex[e] instanceof BattlePlan)) {
            if (!WildMountsReplace.firstDiscardDone && this.player && this.playerProxy) {
                WildMountsReplace.firstDiscardDone = true;

                const ruledBeastCards: Denizen[] = [];
                for (const siteProxy of this.gameProxy.map.sites())
                    if (siteProxy.ruler === this.action.playerProxy)
                        for (const denizenProxy of siteProxy.denizens)
                            if (denizenProxy.suit === OathSuit.Beast)
                                ruledBeastCards.push(denizenProxy.original);

                for (const adviserProxy of this.playerProxy.advisers)
                    if (adviserProxy instanceof Denizen && adviserProxy.suit === OathSuit.Beast)
                        ruledBeastCards.push(adviserProxy.original);

                new ChooseCardsAction(
                    this.actionManager, this.player, "Choose a Beast card to discard instead",
                    [ruledBeastCards],
                    (cards: Denizen[]) => { if (cards[0]) new DiscardCardEffect(this.actionManager, this.action.player, cards[0], this.action.discardOptions).doNext(); }
                ).doNext();
            }
            return false;
        }
        return true;
    }
}
export class WildMountsEnd extends LosePowersModifier(CampaignEndAction, WildMountsReplace) {}

export class RainBoots extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.defRoll.ignore.add(DefenseDieSymbol.Shield);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class Lancers extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.source.powers.add("LancersEnd");
        this.action.campaignResult.discardAtEnd(this.source);
    }
}
export class LancersEnd extends ActionModifier<Denizen, CampaignEndAction> {
    modifiedAction = CampaignEndAction;

    applyBefore(): void {
        const rolls = this.action.campaignResult.atkRoll.rolls;
        this.action.campaignResult.atkRoll.rolls = [...rolls, ...rolls];
        this.source.powers.delete("LancersEnd");
    }
}

export class StormCaller extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.defPool += 2;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class MountedPatrol extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.atkPool = Math.floor(this.action.campaignResult.atkPool / 2);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class WarningSignals extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        if (!this.action.playerProxy) return;
        new MoveWarbandsBetweenBoardAndSitesAction(this.actionManager, this.action.playerProxy).doNext();
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class WayStation extends ActionModifier<Denizen, TravelAction> {
    modifiedAction = TravelAction;

    applyBefore(): void {
        if (!this.sourceProxy.site) return;
        if (this.action.siteProxy === this.sourceProxy.site) {
            if (!this.playerProxy.rules(this.sourceProxy)) {
                const ruler = this.sourceProxy.ruler?.original;
                new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.player, this, new ResourceCost([[Favor, 1]]), ruler)).doNext((success) => {
                    if (!success) throw new InvalidActionResolution("Cannot pay the Way Station's ruler");
                });
            }
        }
    }
}
export class WayStationCost extends NoSupplyCostActionModifier(WayStation) { }

export class Hospitality extends Accessed(ActionModifier<Denizen, TravelAction>) {
    modifiedAction = TravelAction;

    applyAfter(): void {
        const adviserSuits = [...this.playerProxy.advisers].filter((e) => e instanceof Denizen).map((e) => e.suit);
        const suits = [...this.action.siteProxy.denizens].map((e) => e.suit).filter((e) => adviserSuits.includes(e));
        if (suits.length) new TakeFavorFromBankAction(this.actionManager, this.player, 1, suits).doNext();
    }
}

export class Tents extends Accessed(SupplyCostModifier<Denizen>) {
    cost = new ResourceCost([[Favor, 1]]);

    canUse(context: SupplyCostContext): boolean {
        return super.canUse(context) && context.origin instanceof TravelAction;
    }

    apply(context: SupplyCostContext): void {
        const action = context.origin as TravelAction;
        if (action.travelling.site.region === action.siteProxy.region?.original)
            context.cost.multiplier = 0;
    }
}

export class SpecialEnvoy extends Accessed(ActionModifier<Denizen, TravelAction>) {
    modifiedAction = TravelAction;

    applyAfter(): void {
        new RestAction(this.actionManager, this.action.player).doNext();
    }
}
export class SpecialEnvoyCost extends NoSupplyCostActionModifier(SpecialEnvoy) { }

export class AFastSteed extends Accessed(SupplyCostModifier<Denizen>) {
    cost = new ResourceCost([[Favor, 1]]);

    canUse(context: SupplyCostContext): boolean {
        return super.canUse(context) && context.origin instanceof TravelAction;
    }

    apply(context: SupplyCostContext): void {
        if (this.playerProxy && this.playerProxy.warbands.length <= 3)
            context.cost.multiplier = 0;
    }
}

export class RelicWorship extends Accessed(ActionModifier<Denizen, RecoverTargetEffect>) {
    modifiedAction = RecoverTargetEffect;

    applyAtEnd(): void {
        if (this.action.target instanceof Relic)
            new GainSupplyEffect(this.actionManager, this.player, 2).doNext();
    }
}

export class LostTongue extends EnemyActionModifier<Denizen, TakeOwnableObjectEffect> {
    modifiedAction = TakeOwnableObjectEffect;
    
    applyBefore(): void {
        if (!this.action.playerProxy) return;
        if (this.action.playerProxy.suitRuledCount(OathSuit.Nomad) < 1) {
            const targetProxy = this.action.maskProxyManager.get(this.action.target);
            if (!this.sourceProxy.ruler) return;
            if (targetProxy.owner !== this.sourceProxy.ruler) return;
            throw new InvalidActionResolution(`Cannot target or take objects from ${this.sourceProxy.ruler.name} without understanding the Lost Tongue.`);
        }
    }
}
export class LostTongueCampaign extends EnemyAttackerCampaignModifier<Denizen> {
    applyAtStart(): void {
        if (this.action.playerProxy.suitRuledCount(OathSuit.Nomad) < 1)
            this.action.selects.targetProxies.filterChoices((e) => !isOwnable(e) || e.owner !== this.sourceProxy.ruler);
    }
}

export class AncientBloodline extends EnemyActionModifier<Denizen, OathAction> {
    modifiedAction = OathAction;

    applyBefore(): void {
        for (const siteProxy of this.gameProxy.map.sites()) {
            if (siteProxy.ruler !== this.playerProxy) continue;
            for (const denizenProxy of siteProxy.denizens)
                denizenProxy.locked = true;
        }
    }
}
// TODO: Allow relics to be locked too
export class AncientBloodlineRelics extends EnemyActionModifier<Denizen, ParentToTargetEffect> {
    modifiedAction = ParentToTargetEffect;

    applyBefore(): void {
        const targetProxy = this.action.maskProxyManager.get(this.action.target);
        if (targetProxy instanceof Relic && targetProxy.site?.ruler === this.action.playerProxy)
            throw new InvalidActionResolution("Relics under the Ancient Bloodline are locked");
    }
}

export class VowOfKinshipWhenPlayed extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        new ParentToTargetEffect(this.actionManager, this.action.player, this.action.player.byClass(Favor), this.game.favorBank(OathSuit.Nomad)).doNext();
    }
}
export class VowOfKinshipGain extends ActionModifier<Denizen, ParentToTargetEffect> {
    modifiedAction = ParentToTargetEffect;
    mustUse = true;

    applyBefore(): void {
        const ruler = this.sourceProxy.ruler?.original;
        if (this.action.target !== ruler) return;
        const nomadBank = this.game.favorBank(OathSuit.Nomad);
        if (!nomadBank || this.action.target === nomadBank) return;

        const favors: Favor[] = [];
        for (const object of this.action.objects) {
            if (object instanceof Favor) {
                favors.push(object);
                this.action.objects.delete(object);
            }
        }

        new ParentToTargetEffect(this.actionManager, this.action.player, favors, nomadBank).doNext();
    }
}
export class VowOfKinship extends ResourceTransferModifier<Denizen> {
    mustUse = true;

    apply(context: ResourceTransferContext): void {
        const ruler = this.sourceProxy.ruler?.original;
        const nomadBank = this.game.favorBank(OathSuit.Nomad);
        if (!nomadBank) return;

        // TODO: Could split those to make it a choice
        if (context.source === ruler && context.player === ruler) context.source = nomadBank;
        if (context.target === ruler) context.target = nomadBank;
    }
}

export class SacredGround extends ActionModifier<Denizen, PlayVisionEffect> {
    modifiedAction = PlayVisionEffect;
    mustUse = true;

    applyBefore(): void {
        if (this.action.playerProxy.site !== this.sourceProxy.site)
            throw new InvalidActionResolution("Must play Visions at the Sacred Ground");
    }
}

export class Elders extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 2]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.actionManager, this.action.player, Secret, 1).doNext();
    }
}

export class AncientBinding extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]], [[Secret, 1]]);

    usePower(): void {
        for (const player of this.game.players) {
            new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(player, this, new ResourceCost([], [[Secret, player.byClass(Secret).length - (player === this.action.player ? 0 : 1)]]), undefined)).doNext();

            for (const adviser of player.advisers)
                new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(player, this, new ResourceCost([], [[Secret, Infinity]]), undefined, adviser)).doNext();

            for (const relic of player.relics)
                new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(player, this, new ResourceCost([], [[Secret, Infinity]]), undefined, relic)).doNext();
        }

        for (const site of this.game.map.sites())
            for (const denizen of site.denizens)
                if (denizen !== this.source)
                    new TransferResourcesEffect(this.actionManager, new ResourceTransferContext(this.action.player, this, new ResourceCost([], [[Secret, Infinity]]), undefined, denizen)).doNext();
    }
}

export class Convoys extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new ChooseRegionAction(
            this.actionManager, this.action.player, "Move a discard on top of your region's discard",
            (region: Region | undefined) => {
                if (!region) return;
                const discard = this.action.playerProxy.site.region?.discard.original;
                if (!discard) return;
                const discardOptions = new DiscardOptions(discard);
                new DiscardCardGroupEffect(this.actionManager, this.action.player, region.discard.children, discardOptions).doNext();
            }
        ).doNext();
    }
}

export class Resettle extends ActivePower<Denizen> {
    usePower(): void {
        new ChooseCardsAction(
            this.actionManager, this.action.player, "Choose a Nomad adviser",
            [this.gameProxy.players.reduce((a, e) => [...a, ...[...e.advisers].filter((e) => e instanceof Denizen && e.suit == OathSuit.Nomad)], [] as Denizen[])],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                new ChooseSitesAction(
                    this.actionManager, this.action.player, "Move it to a site",
                    (sites: Site[]) => {
                        if (!sites[0]) return;
                        new MoveDenizenToSiteEffect(this.actionManager, this.action.player, cards[0]!, sites[0]).doNext();
                    }
                ).doNext();
            }
        ).doNext();
    }
}

export class Oracle extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 2]]);

    usePower(): void {
        for (const card of this.game.worldDeck.children) {
            if (card instanceof VisionBack) {
                new SearchPlayOrDiscardAction(this.actionManager, this.action.player, card).doNext();
                break;
            }
        }
    }
}

export class SpellBreaker extends EnemyActionModifier<Denizen, PayPowerCostEffect> {
    modifiedAction = PayPowerCostEffect;

    canUse(): boolean {
        return super.canUse() && this.action.power.cost.totalResources.get(Secret) > 0;
    }

    applyBefore(): void {
        throw new InvalidActionResolution("Cannot use powers that cost Secrets under the Spell Breaker");
    }
}

export class FamilyWagon extends CapacityModifier<Denizen> {
    canUse(player: OathPlayer, site?: Site): boolean {
        return super.canUse(player, site) && player === this.source.ruler && !site;
    }

    updateCapacityInformation(targetProxy: Set<WorldCard>): [number, Iterable<WorldCard>] {
        // NOTE: This is technically different from the way Family Wagon is worded. The way *this* works
        // is by setting the capacity to 2, and making all *other* Nomad cards not count towards the limit (effectively
        // making you have 1 spot for a non Nomad card, and infinite ones for Nomad cards, while allowing you
        // to replace Family Wagon if you want to)
        return [2, [...targetProxy].filter((e) => e !== this.sourceProxy && e instanceof Denizen && e.suit === OathSuit.Nomad)];
    }

    ignoreCapacity(cardProxy: WorldCard): boolean {
        return cardProxy !== this.sourceProxy && cardProxy instanceof Denizen && cardProxy.suit === OathSuit.Nomad;
    }
}

export class AncientPact extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        if (!(this.action.playerProxy.board instanceof ExileBoard)) return;

        const darkestSecretProxy = this.gameProxy.banners.get(BannerKey.DarkestSecret);
        if (!darkestSecretProxy) return;
        if (darkestSecretProxy?.owner !== this.action.playerProxy) return;

        new MakeDecisionAction(this.actionManager, this.action.player, "Give Darkest Secret to become a Citizen?", () => {
            new ParentToTargetEffect(this.actionManager, this.action.player, [darkestSecretProxy.original], this.game.chancellor).doNext();
            new BecomeCitizenEffect(this.actionManager, this.action.player).doNext();
            new TakeReliquaryRelicAction(this.actionManager, this.action.player).doNext();
        }).doNext();
    }
}

export class FaithfulFriend extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        new GainSupplyEffect(this.actionManager, this.action.player, 4).doNext();
    }
}

export class Pilgrimage extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        const discard = this.action.playerProxy.site.region?.discard.original;
        if (!discard) return;

        let amount = 0;
        for (const denizenProxy of this.action.playerProxy.site.denizens) {
            if (!denizenProxy.activelyLocked) {
                new PutDenizenIntoDispossessedEffect(this.actionManager, this.action.player, denizenProxy.original).doNext();
                amount++;
            }
        }

        for (let i = 0; i < amount; i++) {
            new GetRandomCardFromDispossessed(this.actionManager, this.action.player).doNext((card) => {
                new PeekAtCardEffect(this.actionManager, this.action.player, card).doNext();
                new DiscardCardEffect(this.actionManager, this.action.player, card, new DiscardOptions(discard)).doNext();
            });
        }
    }
}

export class TwinBrother extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        const cards = new Set<Denizen>();
        for (const playerProxy of this.gameProxy.players) {
            if (playerProxy === this.action.playerProxy) continue;
            for (const adviserProxy of playerProxy.advisers)
                if (adviserProxy !== this.sourceProxy && adviserProxy instanceof Denizen && adviserProxy.suit === OathSuit.Nomad && !adviserProxy.activelyLocked)
                    cards.add(adviserProxy.original);
        }

        new ChooseCardsAction(
            this.actionManager, this.action.player, "You may swap Twin Brother with another Nomad adviser", [cards],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                const otherPlayer = cards[0].owner as OathPlayer;
                new MoveWorldCardToAdvisersEffect(this.actionManager, otherPlayer, this.source).doNext();
                new MoveWorldCardToAdvisersEffect(this.actionManager, this.action.player, cards[0]).doNext();
            },
            [[0, 1]]
        ).doNext();
    }
}

export class GreatHerd extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        const cards = new Set<Denizen>();
        for (const siteProxy of this.gameProxy.map.sites()) {
            if (siteProxy === this.action.playerProxy.site) continue;
            for (const denizenProxy of siteProxy.denizens)
                if (denizenProxy !== this.sourceProxy && denizenProxy.suit === OathSuit.Nomad && !denizenProxy.activelyLocked)
                    cards.add(denizenProxy.original);
        }

        new ChooseCardsAction(
            this.actionManager, this.action.player, "You may swap Great Herd with another Nomad denizen", [cards],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                const otherSite = cards[0].site as Site;
                new MoveDenizenToSiteEffect(this.actionManager, this.action.player, this.source, otherSite).doNext();
                new MoveDenizenToSiteEffect(this.actionManager, this.action.player, cards[0], this.action.playerProxy.site.original).doNext();
            },
            [[0, 1]]
        ).doNext();
    }
}

export class TheGathering extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        if (!this.sourceProxy.site) return;

        for (const player of this.game.players) {
            new MakeDecisionAction(
                this.actionManager, player, "Put your pawn at " + this.sourceProxy.site.name + "?",
                () => new PutPawnAtSiteEffect(this.actionManager, player, this.sourceProxy.site!.original).doNext()
            ).doNext();
        }

        new ResolveCallbackEffect(this.actionManager, () => {
            const participants = this.gameProxy.players.filter((e) => e.site === this.sourceProxy.site).map((e) => e.original);
            for (const player of participants) {
                new StartBindingExchangeAction(this.actionManager, player, TheGatheringOfferAction, participants).doNext();
            }
        }).doNext();
    }
}


export class AncientForge extends ActivePower<Edifice> {
    cost = new ResourceCost([[Favor, 2]], [[Secret, 1]]);
    
    usePower(): void {
        new DrawFromDeckEffect(this.actionManager, this.action.player, this.game.relicDeck, 1).doNext((cards) => {
            const relic = cards[0];
            if (!relic) return;
            
            new MakeDecisionAction(
                this.actionManager, this.action.player, "Keep the relic?",
                () => new TakeOwnableObjectEffect(this.actionManager, this.action.player, relic).doNext(),
                () => new DiscardCardEffect(this.actionManager, this.action.player, relic, new DiscardOptions(this.game.relicDeck, true)).doNext()
            ).doNext();
        });
    }
}

export class BrokenForge extends ActivePower<Edifice> {
    cost = new ResourceCost([[Favor, 2], [Secret, 2]]);

    usePower(): void {
        new FlipEdificeEffect(this.actionManager, this.source).doNext();
    }
}
