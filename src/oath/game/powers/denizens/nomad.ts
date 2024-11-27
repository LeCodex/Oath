import { TravelAction, MakeDecisionAction, ChooseRegionAction, SearchPlayOrDiscardAction, ChooseCardsAction, TakeFavorFromBankAction, ChooseSitesAction, MoveWarbandsBetweenBoardAndSitesAction, RestAction, RecoverAction, TakeReliquaryRelicAction, CampaignEndAction } from "../../actions/actions";
import { InvalidActionResolution, ModifiableAction } from "../../actions/base";
import { Region } from "../../board";
import { Denizen, Edifice, OathCard, Relic, Site, VisionBack, WorldCard } from "../../cards/cards";
import { DiscardOptions } from "../../cards/decks";
import { AttackDie, DieSymbol } from "../../dice";
import { PayCostToTargetEffect, TakeOwnableObjectEffect, PutResourcesOnTargetEffect, PayPowerCostEffect, BecomeCitizenEffect, DrawFromDeckEffect, FlipEdificeEffect, MoveResourcesToTargetEffect, DiscardCardEffect, GainSupplyEffect, PutDenizenIntoDispossessedEffect, GetRandomCardFromDispossessed, PeekAtCardEffect, MoveWorldCardToAdvisersEffect, MoveDenizenToSiteEffect, DiscardCardGroupEffect, PlayVisionEffect, ParentToTargetEffect, BurnResourcesEffect } from "../../actions/effects";
import { OathEffect } from "../../actions/base";
import { BannerName, OathSuit } from "../../enums";
import { OwnableObject, isOwnable } from "../../interfaces";
import { OathPlayer } from "../../player";
import { Favor, ResourceCost, Secret } from "../../resources";
import { ActionModifier, EnemyEffectModifier, ActivePower, CapacityModifier, AttackerBattlePlan, DefenderBattlePlan, WhenPlayed, EnemyAttackerCampaignModifier, EnemyActionModifier, EffectModifier, untilActionResolves } from "../powers";


export class HorseArchersAttack extends AttackerBattlePlan<Denizen> {
    name = "Horse Archers";

    applyBefore(): void {
        this.action.campaignResult.params.atkPool += 3;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}
export class HorseArchersDefense extends DefenderBattlePlan<Denizen> {
    name = "Horse Archers";

    applyBefore(): void {
        this.action.campaignResult.params.atkPool -= 3;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class RivalKhanAttack extends AttackerBattlePlan<Denizen> {
    name = "Rival Khan";

    applyBefore(): void {
        if (this.action.campaignResult.defender?.suitAdviserCount(OathSuit.Nomad)) this.action.campaignResult.params.atkPool += 4;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}
export class RivalKhanDefense extends DefenderBattlePlan<Denizen> {
    name = "Rival Khan";

    applyBefore(): void {
        if (this.action.campaignResult.attacker?.suitAdviserCount(OathSuit.Nomad)) this.action.campaignResult.params.atkPool -= 4;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class GreatCrusadeAttack extends AttackerBattlePlan<Denizen> {
    name = "Great Crusade";

    applyBefore(): void {
        this.action.campaignResult.params.atkPool += this.activator.suitRuledCount(OathSuit.Nomad);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}
export class GreatCrusadeDefense extends DefenderBattlePlan<Denizen> {
    name = "Great Crusade";

    applyBefore(): void {
        this.action.campaignResult.params.atkPool -= this.activator.suitRuledCount(OathSuit.Nomad);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class MountainGiantAttack extends AttackerBattlePlan<Denizen> {
    name = "Mountain Giant";
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        new MakeDecisionAction(
            this.activator, "±1, or ±3 and discard at end?",
            () => { this.action.campaignResult.params.atkPool++; },
            () => {
                this.action.campaignResult.params.atkPool += 3;
                this.action.campaignResult.discardAtEnd(this.source);
            }, 
            ["±1", "±3"]
        ).doNext();
    }
}
export class MountainGiantDefense extends DefenderBattlePlan<Denizen> {
    name = "Mountain Giant";

    applyBefore(): void {
        new MakeDecisionAction(
            this.activator, "±1, or ±3 and discard at end?",
            () => { this.action.campaignResult.params.atkPool--; },
            () => {
                this.action.campaignResult.params.atkPool -= 3;
                this.action.campaignResult.discardAtEnd(this.source);
            },
            ["±1", "±3"]
        ).doNext();
    }
}

export class WildMountsAttack extends AttackerBattlePlan<Denizen> {
    name = "Wild Mounts";

    applyBefore(): void {
        untilActionResolves(this.source, WildMountsReplace, CampaignEndAction);
    }
}
export class WildMountsReplace<T extends OathCard> extends EffectModifier<Denizen, DiscardCardEffect<T>> {
    name = "Wild Mounts";
    modifiedEffect = DiscardCardEffect;

    applyBefore(): void {
        
    }
}

export class RainBoots extends AttackerBattlePlan<Denizen> {
    name = "Rain Boots";

    applyBefore(): void {
        this.action.campaignResult.params.defRoll.ignore.add(DieSymbol.Shield)
    }
}

export class Lancers extends AttackerBattlePlan<Denizen> {
    name = "Lancers";

    applyBefore(): void {
        this.action.next.next.applyModifiers([new LancersEnd(this.source, this.action.next.next, this.activator)]);
    }
}
export class LancersEnd extends ActionModifier<Denizen, CampaignEndAction> {
    name = "Lancers";
    modifiedAction = CampaignEndAction;

    applyBefore(): void {
        const roll = this.action.campaignResult.params.atkRoll.dice.get(AttackDie);
        if (!roll) return;
        for (const [symbol, amount] of roll) roll.set(symbol, 2 * amount);
    }
}

export class StormCaller extends DefenderBattlePlan<Denizen> {
    name = "Storm Caller";

    applyBefore(): void {
        this.action.campaignResult.params.defPool += 2;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class MountedPatrol extends DefenderBattlePlan<Denizen> {
    name = "Mounted Patrol";

    applyBefore(): void {
        this.action.campaignResult.params.atkPool = Math.floor(this.action.campaignResult.params.atkPool / 2);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class WarningSignals extends DefenderBattlePlan<Denizen> {
    name = "Warning Signals";

    applyBefore(): void {
        new MoveWarbandsBetweenBoardAndSitesAction(this.action.playerProxy).doNext();
    }
}

export class WayStation extends ActionModifier<Denizen, TravelAction> {
    name = "Way Station";
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

export class Hospitality extends ActionModifier<Denizen, TravelAction> {
    name = "Hospitality";
    modifiedAction = TravelAction;

    applyAfter(): void {
        const adviserSuits = [...this.activatorProxy.advisers].filter(e => e instanceof Denizen).map(e => e.suit);
        const suits = [...this.action.siteProxy.denizens].map(e => e.suit).filter(e => adviserSuits.includes(e));
        if (suits.length) new TakeFavorFromBankAction(this.activator, 1, suits);
    }
}

export class Tents extends ActionModifier<Denizen, TravelAction> {
    name = "Tents";
    modifiedAction = TravelAction;
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        if (this.action.travelling.site.region === this.action.siteProxy.region?.original)
            this.action.noSupplyCost = true;
    }
}

export class SpecialEnvoy extends ActionModifier<Denizen, TravelAction> {
    name = "Special Envoy";
    modifiedAction = TravelAction;

    applyBefore(): void {
        this.action.noSupplyCost = true;
    }

    applyAfter(): void {
        new RestAction(this.action.player).doNext();
    }
}

export class AFastSteed extends ActionModifier<Denizen, TravelAction> {
    name = "A Fast Steed";
    modifiedAction = TravelAction;
    cost = new ResourceCost([[Favor, 1]]);

    applyBefore(): void {
        if (this.activatorProxy.warbands.length <= 3)
            this.action.noSupplyCost = true;
    }
}

export class RelicWorship extends ActionModifier<Denizen, RecoverAction> {
    name = "Relic Worship";
    modifiedAction = RecoverAction;
    cost = new ResourceCost([[Favor, 1]]);

    applyAtEnd(): void {
        if (this.action.targetProxy instanceof Relic)
            new GainSupplyEffect(this.activator, 2).doNext();
    }
}

function lostTongueCheckOwnable(sourceProxy: Denizen, targetProxy: OwnableObject, playerProxy: OathPlayer | undefined) {
    if (!sourceProxy.ruler) return;
    if (!playerProxy) return;
    if (targetProxy.owner !== sourceProxy.ruler) return;

    if (playerProxy.suitRuledCount(OathSuit.Nomad) < 1)
        throw new InvalidActionResolution(`Cannot target or take objects from ${sourceProxy.ruler.name} without understanding the Lost Tongue.`);
}
export class LostTongue extends EnemyEffectModifier<Denizen, TakeOwnableObjectEffect> {
    name = "Lost Tongue";
    modifiedEffect = TakeOwnableObjectEffect;

    applyBefore(): void {
        const targetProxy = this.effect.maskProxyManager.get(this.effect.target);
        lostTongueCheckOwnable(this.sourceProxy, targetProxy, this.effect.executorProxy);
    }
}
export class LostTongueCampaign extends EnemyAttackerCampaignModifier<Denizen> {
    name = "Lost Tongue";

    applyBefore(): void {
        for (const target of this.action.campaignResult.params.targets) {
            if (isOwnable(target)) {
                const targetProxy = this.action.maskProxyManager.get(target);
                lostTongueCheckOwnable(this.sourceProxy, targetProxy, this.activatorProxy);
            }
        }
    }
}

export class AncientBloodlineAction extends EnemyActionModifier<Denizen, ModifiableAction> {
    name = "Ancient Bloodline";
    modifiedAction = ModifiableAction;

    applyBefore(): void {
        for (const siteProxy of this.gameProxy.board.sites()) {
            if (siteProxy.ruler !== this.activatorProxy) continue;
            for (const denizenProxy of siteProxy.denizens)
                denizenProxy.locked = true;
        }
    }
}
export class AncientBloodlineEffect extends EnemyEffectModifier<Denizen, OathEffect<any>> {
    name = "Ancient Bloodline";
    modifiedEffect = OathEffect;

    applyBefore(): void {
        for (const siteProxy of this.gameProxy.board.sites()) {
            if (siteProxy.ruler !== this.effect.executorProxy) continue;
            for (const denizenProxy of siteProxy.denizens)
                denizenProxy.locked = true;
        }
    }
}
// TODO: Allow relics to be locked too
export class AncientBloodlineRelics extends EnemyEffectModifier<Denizen, TakeOwnableObjectEffect> {
    name = "Ancient Bloodline";
    modifiedEffect = TakeOwnableObjectEffect;

    applyBefore(): void {
        const targetProxy = this.effect.maskProxyManager.get(this.effect.target);
        if (targetProxy instanceof Relic && targetProxy.site?.ruler === this.effect.executorProxy)
            throw new InvalidActionResolution("Cannot take locked relics from the Ancient Bloodline");
    }
}

export class VowOfKinshipWhenPlayed extends WhenPlayed<Denizen> {
    name = "Vow of Kinship";

    whenPlayed(): void {
        new ParentToTargetEffect(this.game, this.effect.executor, this.effect.executor.byClass(Favor).max(Infinity), this.game.favorBank(OathSuit.Nomad)).doNext();
    }
}
export class VowOfKinshipGain extends EffectModifier<Denizen, ParentToTargetEffect> {
    name = "Vow of Kinship";
    modifiedEffect = ParentToTargetEffect;

    applyBefore(): void {
        const ruler = this.sourceProxy.ruler?.original;
        const nomadBank = this.game.favorBank(OathSuit.Nomad);
        if (!nomadBank) return;

        const favors: Favor[] = [];
        for (const object of this.effect.objects) {
            if (object instanceof Favor && this.effect.target === ruler) {
                favors.push(object);
                this.effect.objects.delete(object);
            }
        }

        new ParentToTargetEffect(this.game, this.effect.executor, favors, nomadBank).doNext();
    }
}
export class VowOfKinshipGive extends EffectModifier<Denizen, MoveResourcesToTargetEffect> {
    name = "Vow of Kinship";
    modifiedEffect = MoveResourcesToTargetEffect;

    applyBefore(): void {
        if (this.effect.resource != Favor) return;
        const ruler = this.sourceProxy.ruler?.original;
        const nomadBank = this.game.favorBank(OathSuit.Nomad);
        if (!nomadBank) return;
        if (this.effect.executor === ruler && this.effect.source === ruler) this.effect.source = nomadBank;
    }
}
export class VowOfKinshipBurn extends EffectModifier<Denizen, BurnResourcesEffect> {
    name = "Vow of Kinship";
    modifiedEffect = BurnResourcesEffect;

    applyBefore(): void {
        if (this.effect.resource != Favor) return;
        const ruler = this.sourceProxy.ruler?.original;
        const nomadBank = this.game.favorBank(OathSuit.Nomad);
        if (!nomadBank) return;
        if (this.effect.executor === ruler && this.effect.source === ruler) this.effect.source = nomadBank;
    }
}

export class SacredGround extends EffectModifier<Denizen, PlayVisionEffect> {
    name = "Sacred Ground";
    modifiedEffect = PlayVisionEffect;

    applyBefore(): void {
        if (this.effect.executorProxy.site !== this.sourceProxy.site)
            throw new InvalidActionResolution("Must play Visions at the Sacred Ground");
    }
}

export class Elders extends ActivePower<Denizen> {
    name = "Elders";
    cost = new ResourceCost([[Favor, 2]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.player, Secret, 1).doNext();
    }
}

export class AncientBinding extends ActivePower<Denizen> {
    name = "Ancient Binding";
    cost = new ResourceCost([[Secret, 1]], [[Secret, 1]]);

    usePower(): void {
        for (const player of this.game.players) {
            new MoveResourcesToTargetEffect(this.game, player, Secret, player.byClass(Secret).length - (player === this.action.player ? 0 : 1), undefined).doNext();

            for (const adviser of player.advisers)
                new MoveResourcesToTargetEffect(this.game, player, Secret, Infinity, undefined, adviser).doNext();

            for (const relic of player.relics)
                new MoveResourcesToTargetEffect(this.game, player, Secret, Infinity, undefined, relic).doNext();
        }

        for (const site of this.game.board.sites())
            for (const denizen of site.denizens)
                if (denizen !== this.source)
                    new MoveResourcesToTargetEffect(this.game, this.action.player, Secret, Infinity, undefined, denizen).doNext();
    }
}

export class Convoys extends ActivePower<Denizen> {
    name = "Convoys";
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
        )
    }
}

export class Resettle extends ActivePower<Denizen> {
    name = "Resettle";

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
                )
            }
        ).doNext();
    }
}

export class Oracle extends ActivePower<Denizen> {
    name = "Oracle";
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

export class SpellBreaker extends EnemyEffectModifier<Denizen, PayPowerCostEffect> {
    name = "Spell Breaker";
    modifiedEffect = PayPowerCostEffect;

    applyBefore(): void {
        if (this.effect.power.cost.totalResources.get(Secret))
            throw new InvalidActionResolution("Cannot use powers that cost Secrets under the Spell Breaker");
    }
}

export class FamilyWagon extends CapacityModifier<Denizen> {
    name = "Family Wagon";

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
    name = "Ancient Pact";

    whenPlayed(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerName.DarkestSecret);
        if (!darkestSecretProxy) return;
        if (darkestSecretProxy?.owner !== this.effect.executorProxy) return;

        new MakeDecisionAction(this.effect.executor, "Give Darkest Secret to become a Citizen?", () => {
            new ParentToTargetEffect(this.game, this.effect.executor, [darkestSecretProxy.original], this.game.chancellor).doNext();
            new BecomeCitizenEffect(this.effect.executor).doNext();
            new TakeReliquaryRelicAction(this.effect.executor).doNext();
        });
    }
}

export class FaithfulFriend extends WhenPlayed<Denizen> {
    name = "Faithful Friend";

    whenPlayed(): void {
        new GainSupplyEffect(this.effect.executor, 4).doNext();
    }
}

export class Pilgrimage extends WhenPlayed<Denizen> {
    name = "Pilgrimage";

    whenPlayed(): void {
        const discard = this.effect.executorProxy.site.region?.discard.original;
        if (!discard) return;

        let amount = 0;
        for (const denizenProxy of this.effect.executorProxy.site.denizens) {
            if (!denizenProxy.activelyLocked) {
                new PutDenizenIntoDispossessedEffect(this.game, this.effect.executor, denizenProxy.original).doNext();
                amount++;
            }
        }

        for (let i = 0; i < amount; i++) {
            new GetRandomCardFromDispossessed(this.game, this.effect.executor).doNext(card => {
                new PeekAtCardEffect(this.effect.executor, card).doNext();
                new DiscardCardEffect(this.effect.executor, card, new DiscardOptions(discard)).doNext();
            });
        }
    }
}

export class TwinBrother extends WhenPlayed<Denizen> {
    name = "Twin Brother";

    whenPlayed(): void {
        const cards = new Set<Denizen>();
        for (const playerProxy of this.gameProxy.players) {
            if (playerProxy !== this.effect.executorProxy) continue;
            for (const adviserProxy of playerProxy.advisers)
                if (adviserProxy instanceof Denizen && adviserProxy.suit === OathSuit.Nomad && !adviserProxy.activelyLocked)
                    cards.add(adviserProxy.original);
        }

        new ChooseCardsAction(
            this.effect.executor, "Swap Twin Brother with another Nomad adviser", [cards],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                const otherPlayer = cards[0].owner as OathPlayer;
                new MoveWorldCardToAdvisersEffect(this.game, otherPlayer, this.source).doNext();
                new MoveWorldCardToAdvisersEffect(this.game, this.effect.executor, cards[0]).doNext();
            },
            [[0, 1]]
        ).doNext();
    }
}

export class GreatHerd extends WhenPlayed<Denizen> {
    name = "Great Herd";

    whenPlayed(): void {
        const cards = new Set<Denizen>();
        for (const siteProxy of this.gameProxy.board.sites()) {
            if (siteProxy !== this.effect.executorProxy.site) continue;
            for (const denizenProxy of siteProxy.denizens)
                if (denizenProxy.suit === OathSuit.Nomad && !denizenProxy.activelyLocked)
                    cards.add(denizenProxy.original);
        }

        new ChooseCardsAction(
            this.effect.executor, "Swap Great Herd with another Nomad denizen", [cards],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                const otherSite = cards[0].site as Site;
                new MoveDenizenToSiteEffect(this.game, this.effect.executor, this.source, otherSite).doNext();
                new MoveDenizenToSiteEffect(this.game, this.effect.executor, cards[0], this.effect.executorProxy.site.original).doNext();
            },
            [[0, 1]]
        ).doNext();
    }
}


export class AncientForge extends ActivePower<Edifice> {
    name = "Ancient Forge";
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
    name = "Broken Forge";
    cost = new ResourceCost([[Favor, 2], [Secret, 2]]);

    usePower(): void {
        new FlipEdificeEffect(this.source).doNext();
    }
}
