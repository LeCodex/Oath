import { TravelAction, MakeDecisionAction, ChooseRegionAction, SearchPlayOrDiscardAction, ChooseCardsAction, TakeFavorFromBankAction, ChooseSitesAction, MoveWarbandsBetweenBoardAndSitesAction, RestAction, TakeReliquaryRelicAction, CampaignEndAction, StartBindingExchangeAction, TheGatheringOfferAction } from "../actions";
import { InvalidActionResolution, ModifiableAction, ResolveCallbackEffect } from "../actions/base";
import { Region } from "../map";
import { Denizen, Edifice, OathCard, Relic, Site, VisionBack, WorldCard } from "../cards";
import { DiscardOptions } from "../cards/decks";
import { AttackDie, DieSymbol } from "../dice";
import { PayCostToTargetEffect, TakeOwnableObjectEffect, PutResourcesOnTargetEffect, PayPowerCostEffect, BecomeCitizenEffect, DrawFromDeckEffect, FlipEdificeEffect, MoveResourcesToTargetEffect, DiscardCardEffect, GainSupplyEffect, PutDenizenIntoDispossessedEffect, GetRandomCardFromDispossessed, PeekAtCardEffect, MoveWorldCardToAdvisersEffect, MoveDenizenToSiteEffect, DiscardCardGroupEffect, PlayVisionEffect, ParentToTargetEffect, BurnResourcesEffect, PutPawnAtSiteEffect, RecoverTargetEffect } from "../actions/effects";
import { BannerKey, OathSuit } from "../enums";
import { isOwnable } from "../interfaces";
import { ExileBoard, OathPlayer } from "../player";
import { Favor, ResourceCost, Secret } from "../resources";
import { ActivePower, CapacityModifier, AttackerBattlePlan, DefenderBattlePlan, WhenPlayed, EnemyAttackerCampaignModifier, EnemyActionModifier, ActionModifier, gainPowerUntilActionResolves, BattlePlan, AccessedActionModifier } from ".";


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
        if (this.action.campaignResult.defender?.suitAdviserCount(OathSuit.Nomad)) this.action.campaignResult.atkPool += 4;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}
export class RivalKhanDefense extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        if (this.action.campaignResult.attacker?.suitAdviserCount(OathSuit.Nomad)) this.action.campaignResult.atkPool -= 4;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class GreatCrusadeAttack extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.atkPool += this.activator.suitRuledCount(OathSuit.Nomad);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}
export class GreatCrusadeDefense extends DefenderBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.atkPool -= this.activator.suitRuledCount(OathSuit.Nomad);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class MountainGiantAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        new MakeDecisionAction(
            this.activator, "±1, or ±3 and discard at end?",
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
    applyBefore(): void {
        new MakeDecisionAction(
            this.activator, "±1, or ±3 and discard at end?",
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
        gainPowerUntilActionResolves(this.source, WildMountsReplace, CampaignEndAction);
        WildMountsReplace.firstDiscardDone = false;
    }
}
export class WildMountsReplace extends ActionModifier<Denizen, DiscardCardEffect<OathCard>> {
    modifiedAction = DiscardCardEffect;

    static firstDiscardDone = false;

    constructor(source: Denizen, action: DiscardCardEffect<OathCard>, activator: OathPlayer) {
        super(source, action, activator);
        this.mustUse = WildMountsReplace.firstDiscardDone;  // All future discards must be cancelled
    }

    applyWhenApplied(): boolean {
        if (this.action.card instanceof Denizen && this.action.card.suit === OathSuit.Nomad && [...this.action.card.powers].some(e => e instanceof BattlePlan)) {
            if (!WildMountsReplace.firstDiscardDone) {
                WildMountsReplace.firstDiscardDone = true;

                const ruledBeastCards: Denizen[] = [];
                for (const siteProxy of this.gameProxy.map.sites())
                    if (siteProxy.ruler === this.action.playerProxy)
                        for (const denizenProxy of siteProxy.denizens)
                            if (denizenProxy.suit === OathSuit.Beast)
                                ruledBeastCards.push(denizenProxy.original);

                for (const adviserProxy of this.action.playerProxy.advisers)
                    if (adviserProxy instanceof Denizen && adviserProxy.suit === OathSuit.Beast)
                        ruledBeastCards.push(adviserProxy.original);

                new ChooseCardsAction(
                    this.action.player, "Choose a Beast card to discard instead",
                    [ruledBeastCards],
                    (cards: Denizen[]) => { if (cards[0]) new DiscardCardEffect(this.action.player, cards[0], this.action.discardOptions).doNext(); }
                ).doNext();
            }
            return false;
        }
        return true;
    }
}

export class RainBoots extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.campaignResult.defRoll.ignore.add(DieSymbol.Shield);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class Lancers extends AttackerBattlePlan<Denizen> {
    applyBefore(): void {
        this.action.next.next.applyModifiers([new LancersEnd(this.source, this.action.next.next, this.activator)]);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}
export class LancersEnd extends ActionModifier<Denizen, CampaignEndAction> {
    modifiedAction = CampaignEndAction;

    applyBefore(): void {
        const rolls = this.action.campaignResult.atkRoll.rolls;
        this.action.campaignResult.atkRoll.rolls = [...rolls, ...rolls];
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
        new MoveWarbandsBetweenBoardAndSitesAction(this.action.playerProxy).doNext();
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class WayStation extends ActionModifier<Denizen, TravelAction> {
    modifiedAction = TravelAction;

    applyBefore(): void {
        if (!this.sourceProxy.site) return;
        if (this.action.siteProxy === this.sourceProxy.site) {
            if (!this.activatorProxy.rules(this.sourceProxy)) {
                new PayCostToTargetEffect(this.game, this.activator, new ResourceCost([[Favor, 1]]), this.sourceProxy.ruler?.original).doNext(success => {
                    if (!success) return;
                    this.action.noSupplyCost = true;
                });
            } else {
                this.action.noSupplyCost = true;
            }
        }
    }
}

export class Hospitality extends AccessedActionModifier<Denizen, TravelAction> {
    modifiedAction = TravelAction;

    applyAfter(): void {
        const adviserSuits = [...this.activatorProxy.advisers].filter(e => e instanceof Denizen).map(e => e.suit);
        const suits = [...this.action.siteProxy.denizens].map(e => e.suit).filter(e => adviserSuits.includes(e));
        if (suits.length) new TakeFavorFromBankAction(this.activator, 1, suits).doNext();
    }
}

export class Tents extends AccessedActionModifier<Denizen, TravelAction> {
    modifiedAction = TravelAction;
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        if (this.action.travelling.site.region === this.action.siteProxy.region?.original)
            this.action.noSupplyCost = true;
    }
}

export class SpecialEnvoy extends AccessedActionModifier<Denizen, TravelAction> {
    modifiedAction = TravelAction;

    applyBefore(): void {
        this.action.noSupplyCost = true;
    }

    applyAfter(): void {
        new RestAction(this.action.player).doNext();
    }
}

export class AFastSteed extends AccessedActionModifier<Denizen, TravelAction> {
    modifiedAction = TravelAction;
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        if (this.activatorProxy.warbands.length <= 3)
            this.action.noSupplyCost = true;
    }
}

export class RelicWorship extends AccessedActionModifier<Denizen, RecoverTargetEffect> {
    modifiedAction = RecoverTargetEffect;

    applyAtEnd(): void {
        if (this.action.target instanceof Relic)
            new GainSupplyEffect(this.activator, 2).doNext();
    }
}

export class LostTongue extends EnemyActionModifier<Denizen, TakeOwnableObjectEffect> {
    modifiedAction = TakeOwnableObjectEffect;
    
    applyBefore(): void {
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
            this.action.selects.targetProxies.filterChoices(e => !isOwnable(e) || e.owner !== this.sourceProxy.ruler);
    }
}

export class AncientBloodline extends EnemyActionModifier<Denizen, ModifiableAction> {
    modifiedAction = ModifiableAction;

    applyBefore(): void {
        for (const siteProxy of this.gameProxy.map.sites()) {
            if (siteProxy.ruler !== this.activatorProxy) continue;
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
        if (targetProxy instanceof Relic && targetProxy.site?.ruler === this.action.executorProxy)
            throw new InvalidActionResolution("Relics under the Ancient Bloodline are locked");
    }
}

export class VowOfKinshipWhenPlayed extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        new ParentToTargetEffect(this.game, this.action.executor, this.action.executor.byClass(Favor).max(Infinity), this.game.favorBank(OathSuit.Nomad)).doNext();
    }
}
export class VowOfKinshipGain extends ActionModifier<Denizen, ParentToTargetEffect> {
    modifiedAction = ParentToTargetEffect;
    mustUse = true;

    applyBefore(): void {
        const ruler = this.sourceProxy.ruler?.original;
        if (this.action.target !== ruler) return;
        const nomadBank = this.game.favorBank(OathSuit.Nomad);
        if (!nomadBank) return;

        const favors: Favor[] = [];
        for (const object of this.action.objects) {
            if (object instanceof Favor) {
                favors.push(object);
                this.action.objects.delete(object);
            }
        }

        new ParentToTargetEffect(this.game, this.action.executor, favors, nomadBank).doNext();
    }
}
export class VowOfKinshipGive extends ActionModifier<Denizen, MoveResourcesToTargetEffect> {
    modifiedAction = MoveResourcesToTargetEffect;
    mustUse = true;

    applyBefore(): void {
        if (this.action.resource !== Favor) return;
        const ruler = this.sourceProxy.ruler?.original;
        const nomadBank = this.game.favorBank(OathSuit.Nomad);
        if (!nomadBank) return;
        if (this.action.executor === ruler && this.action.source === ruler) this.action.source = nomadBank;
    }
}
export class VowOfKinshipBurn extends ActionModifier<Denizen, BurnResourcesEffect> {
    modifiedAction = BurnResourcesEffect;
    mustUse = true;

    applyBefore(): void {
        if (this.action.resource !== Favor) return;
        const ruler = this.sourceProxy.ruler?.original;
        const nomadBank = this.game.favorBank(OathSuit.Nomad);
        if (!nomadBank) return;
        if (this.action.executor === ruler && this.action.source === ruler) this.action.source = nomadBank;
    }
}

export class SacredGround extends ActionModifier<Denizen, PlayVisionEffect> {
    modifiedAction = PlayVisionEffect;
    mustUse = true;

    applyBefore(): void {
        if (this.action.executorProxy.site !== this.sourceProxy.site)
            throw new InvalidActionResolution("Must play Visions at the Sacred Ground");
    }
}

export class Elders extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 2]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.player, Secret, 1).doNext();
    }
}

export class AncientBinding extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]], [[Secret, 1]]);

    usePower(): void {
        for (const player of this.game.players) {
            new MoveResourcesToTargetEffect(this.game, player, Secret, player.byClass(Secret).length - (player === this.action.player ? 0 : 1), undefined).doNext();

            for (const adviser of player.advisers)
                new MoveResourcesToTargetEffect(this.game, player, Secret, Infinity, undefined, adviser).doNext();

            for (const relic of player.relics)
                new MoveResourcesToTargetEffect(this.game, player, Secret, Infinity, undefined, relic).doNext();
        }

        for (const site of this.game.map.sites())
            for (const denizen of site.denizens)
                if (denizen !== this.source)
                    new MoveResourcesToTargetEffect(this.game, this.action.player, Secret, Infinity, undefined, denizen).doNext();
    }
}

export class Convoys extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new ChooseRegionAction(
            this.action.player, "Move a discard on top of your region's discard",
            (region: Region | undefined) => {
                if (!region) return;
                const discard = this.action.playerProxy.site.region?.discard.original;
                if (!discard) return;
                const discardOptions = new DiscardOptions(discard);
                new DiscardCardGroupEffect(this.action.player, region.discard.children, discardOptions).doNext();
            }
        ).doNext();
    }
}

export class Resettle extends ActivePower<Denizen> {
    usePower(): void {
        new ChooseCardsAction(
            this.action.player, "Choose a Nomad adviser",
            [this.gameProxy.players.reduce((a, e) => [...a, ...[...e.advisers].filter(e => e instanceof Denizen && e.suit == OathSuit.Nomad)], [] as Denizen[])],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                new ChooseSitesAction(
                    this.action.player, "Move it to a site",
                    (sites: Site[]) => {
                        if (!sites[0]) return;
                        new MoveDenizenToSiteEffect(this.game, this.action.player, cards[0]!, sites[0]).doNext();
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
                new SearchPlayOrDiscardAction(this.action.player, card).doNext();
                break;
            }
        }
    }
}

export class SpellBreaker extends EnemyActionModifier<Denizen, PayPowerCostEffect> {
    modifiedAction = PayPowerCostEffect;

    canUse(): boolean {
        return super.canUse() && (this.action.power.cost.totalResources.get(Secret) ?? 0) > 0;
    }

    applyBefore(): void {
        throw new InvalidActionResolution("Cannot use powers that cost Secrets under the Spell Breaker");
    }
}

export class FamilyWagon extends CapacityModifier<Denizen> {
    canUse(player: OathPlayer, site?: Site): boolean {
        return player === this.source.ruler && !site;
    }

    updateCapacityInformation(targetProxy: Set<WorldCard>): [number, Iterable<WorldCard>] {
        // NOTE: This is technically different from the way Family Wagon is worded. The way *this* works
        // is by setting the capacity to 2, and making all *other* Nomad cards not count towards the limit (effectively
        // making you have 1 spot for a non Nomad card, and infinite ones for Nomad cards, while allowing you
        // to replace Family Wagon if you want to)
        return [2, [...targetProxy].filter(e => e !== this.sourceProxy && e instanceof Denizen && e.suit === OathSuit.Nomad)];
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
        if (darkestSecretProxy?.owner !== this.action.executorProxy) return;

        new MakeDecisionAction(this.action.executor, "Give Darkest Secret to become a Citizen?", () => {
            new ParentToTargetEffect(this.game, this.action.executor, [darkestSecretProxy.original], this.game.chancellor).doNext();
            new BecomeCitizenEffect(this.action.executor).doNext();
            new TakeReliquaryRelicAction(this.action.executor).doNext();
        }).doNext();
    }
}

export class FaithfulFriend extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        new GainSupplyEffect(this.action.executor, 4).doNext();
    }
}

export class Pilgrimage extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        const discard = this.action.executorProxy.site.region?.discard.original;
        if (!discard) return;

        let amount = 0;
        for (const denizenProxy of this.action.executorProxy.site.denizens) {
            if (!denizenProxy.activelyLocked) {
                new PutDenizenIntoDispossessedEffect(this.game, this.action.executor, denizenProxy.original).doNext();
                amount++;
            }
        }

        for (let i = 0; i < amount; i++) {
            new GetRandomCardFromDispossessed(this.game, this.action.executor).doNext(card => {
                new PeekAtCardEffect(this.action.executor, card).doNext();
                new DiscardCardEffect(this.action.executor, card, new DiscardOptions(discard)).doNext();
            });
        }
    }
}

export class TwinBrother extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        const cards = new Set<Denizen>();
        for (const playerProxy of this.gameProxy.players) {
            if (playerProxy === this.action.executorProxy) continue;
            for (const adviserProxy of playerProxy.advisers)
                if (adviserProxy !== this.sourceProxy && adviserProxy instanceof Denizen && adviserProxy.suit === OathSuit.Nomad && !adviserProxy.activelyLocked)
                    cards.add(adviserProxy.original);
        }

        new ChooseCardsAction(
            this.action.executor, "You may swap Twin Brother with another Nomad adviser", [cards],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                const otherPlayer = cards[0].owner as OathPlayer;
                new MoveWorldCardToAdvisersEffect(this.game, otherPlayer, this.source).doNext();
                new MoveWorldCardToAdvisersEffect(this.game, this.action.executor, cards[0]).doNext();
            },
            [[0, 1]]
        ).doNext();
    }
}

export class GreatHerd extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        const cards = new Set<Denizen>();
        for (const siteProxy of this.gameProxy.map.sites()) {
            if (siteProxy === this.action.executorProxy.site) continue;
            for (const denizenProxy of siteProxy.denizens)
                if (denizenProxy !== this.sourceProxy && denizenProxy.suit === OathSuit.Nomad && !denizenProxy.activelyLocked)
                    cards.add(denizenProxy.original);
        }

        new ChooseCardsAction(
            this.action.executor, "You may swap Great Herd with another Nomad denizen", [cards],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                const otherSite = cards[0].site as Site;
                new MoveDenizenToSiteEffect(this.game, this.action.executor, this.source, otherSite).doNext();
                new MoveDenizenToSiteEffect(this.game, this.action.executor, cards[0], this.action.executorProxy.site.original).doNext();
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
                player, "Put your pawn at " + this.sourceProxy.site.name + "?",
                () => new PutPawnAtSiteEffect(player, this.sourceProxy.site!.original).doNext()
            ).doNext();
        }

        new ResolveCallbackEffect(this.game, () => {
            const participants = this.gameProxy.players.filter(e => e.site === this.sourceProxy.site).map(e => e.original);
            for (const player of participants) {
                new StartBindingExchangeAction(player, TheGatheringOfferAction, participants).doNext();
            }
        }).doNext();
    }
}


export class AncientForge extends ActivePower<Edifice> {
    cost = new ResourceCost([[Favor, 2]], [[Secret, 1]]);
    
    usePower(): void {
        new DrawFromDeckEffect(this.action.player, this.game.relicDeck, 1).doNext(cards => {
            const relic = cards[0];
            if (!relic) return;
            
            new MakeDecisionAction(
                this.action.player, "Keep the relic?",
                () => new TakeOwnableObjectEffect(this.game, this.action.player, relic).doNext(),
                () => relic.putOnBottom(this.action.player)
            ).doNext();
        });
    }
}

export class BrokenForge extends ActivePower<Edifice> {
    cost = new ResourceCost([[Favor, 2], [Secret, 2]]);

    usePower(): void {
        new FlipEdificeEffect(this.source).doNext();
    }
}
