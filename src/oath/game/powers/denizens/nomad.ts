import { TravelAction, InvalidActionResolution, MakeDecisionAction, ChooseRegionAction, SearchPlayOrDiscardAction, ChooseCardsAction, ModifiableAction, ChooseSuitsAction, TakeFavorFromBankAction, ChooseSitesAction, MoveWarbandsBetweenBoardAndSitesAction, RestAction, RecoverAction, TakeReliquaryRelicAction, CampaignEndAction } from "../../actions/actions";
import { Region } from "../../board";
import { Denizen, Edifice, OathCard, Relic, Site, VisionBack, WorldCard } from "../../cards/cards";
import { DiscardOptions } from "../../cards/decks";
import { AttackDie, DieSymbol } from "../../dice";
import { PayCostToTargetEffect, TakeOwnableObjectEffect, PutResourcesOnTargetEffect, PayPowerCost, BecomeCitizenEffect, GiveOwnableObjectEffect, DrawFromDeckEffect, FlipEdificeEffect, MoveResourcesToTargetEffect, DiscardCardEffect, GainSupplyEffect, PutDenizenIntoDispossessedEffect, GetRandomCardFromDispossessed, PeekAtCardEffect, MoveWorldCardToAdvisersEffect, MoveDenizenToSiteEffect, OathEffect, TakeResourcesFromBankEffect, DiscardCardGroupEffect, PlayVisionEffect, ApplyModifiersEffect, PutResourcesIntoBankEffect } from "../../effects";
import { BannerName, OathResource, OathSuit } from "../../enums";
import { OwnableObject, isOwnable } from "../../interfaces";
import { OathPlayer } from "../../player";
import { ResourceCost } from "../../resources";
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
    cost = new ResourceCost([[OathResource.Secret, 1]]);

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
        new ApplyModifiersEffect(this.action.next.next, [new LancersEnd(this.source, this.action.next.next, this.activator)]).do();
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
            if (!this.activatorProxy.rules(this.sourceProxy))
                if (!new PayCostToTargetEffect(this.game, this.activator, new ResourceCost([[OathResource.Favor, 1]]), this.sourceProxy.ruler?.original).do())
                    return;
            
            this.action.noSupplyCost = true;
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
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        if (this.action.travelling.site.region === this.action.siteProxy.region.original)
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
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        if (this.activatorProxy.totalWarbands <= 3)
            this.action.noSupplyCost = true;
    }
}

export class RelicWorship extends ActionModifier<Denizen, RecoverAction> {
    name = "Relic Worship";
    modifiedAction = RecoverAction;
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyAtEnd(): void {
        if (this.action.targetProxy instanceof Relic)
            new GainSupplyEffect(this.activator, 2).do();
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
        lostTongueCheckOwnable(this.sourceProxy, targetProxy, this.effect.playerProxy);
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
            if (siteProxy.ruler !== this.effect.playerProxy) continue;
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
        if (targetProxy instanceof Relic && targetProxy.site?.ruler === this.effect.playerProxy)
            throw new InvalidActionResolution("Cannot take locked relics from the Ancient Bloodline");
    }
}

export class VowOfKinshipWhenPlayed extends WhenPlayed<Denizen> {
    name = "Vow of Kinship";

    whenPlayed(): void {
        new PutResourcesIntoBankEffect(this.game, this.effect.player, this.game.favorBanks.get(OathSuit.Nomad), Infinity).do();
    }
}
export class VowOfKinship extends EffectModifier<Denizen, MoveResourcesToTargetEffect> {
    name = "Vow of Kinship";
    modifiedEffect = MoveResourcesToTargetEffect;

    applyBefore(): void {
        if (this.effect.resource != OathResource.Favor) return;
        const ruler = this.sourceProxy.ruler?.original;
        const nomadBank = this.game.favorBanks.get(OathSuit.Nomad);

        // Only do the swap if the favor is given, not taken
        // TODO: We can't have this be a choice right now, which means instances where the movement of favor is done
        // without risk of "not being able to pay", this can result in unwated scenarios
        if (this.effect.player === ruler && this.effect.source === ruler) {
            new TakeResourcesFromBankEffect(this.game, this.effect.player, nomadBank, this.effect.amount).do();
        }
    }

    applyAfter(result: number): void {
        if (this.effect.resource != OathResource.Favor) return;
        const ruler = this.sourceProxy.ruler?.original;
        const nomadBank = this.game.favorBanks.get(OathSuit.Nomad);

        if (this.effect.target === ruler) {
            new PutResourcesIntoBankEffect(this.game, this.effect.player, nomadBank, result).do();
        }        
    }
}

export class SacredGround extends EffectModifier<Denizen, PlayVisionEffect> {
    name = "Sacred Ground";
    modifiedEffect = PlayVisionEffect;

    applyBefore(): void {
        if (this.effect.playerProxy.site !== this.sourceProxy.site)
            throw new InvalidActionResolution("Must play Visions at the Sacred Ground");
    }
}

export class Elders extends ActivePower<Denizen> {
    name = "Elders";
    cost = new ResourceCost([[OathResource.Favor, 2]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.player, OathResource.Secret, 1).do();
    }
}

export class AncientBinding extends ActivePower<Denizen> {
    name = "Ancient Binding";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Secret, 1]]);

    usePower(): void {
        for (const player of Object.values(this.game.players)) {
            new MoveResourcesToTargetEffect(this.game, player, OathResource.Secret, player.getResources(OathResource.Secret) - (player === this.action.player ? 0 : 1), undefined).do();

            for (const adviser of player.advisers)
                new MoveResourcesToTargetEffect(this.game, player, OathResource.Secret, Infinity, undefined, adviser).do();

            for (const relic of player.relics)
                new MoveResourcesToTargetEffect(this.game, player, OathResource.Secret, Infinity, undefined, relic).do();
        }

        for (const site of this.game.board.sites())
            for (const denizen of site.denizens)
                if (denizen !== this.source)
                    new MoveResourcesToTargetEffect(this.game, this.action.player, OathResource.Secret, Infinity, undefined, denizen).do();
    }
}

export class Convoys extends ActivePower<Denizen> {
    name = "Convoys";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        new ChooseRegionAction(
            this.action.player, "Move a discard on top of your region's discard",
            (region: Region | undefined) => {
                if (!region) return;
                const cards = new DrawFromDeckEffect(this.action.player, region.discard, Infinity, true).do()
                const discardOptions = new DiscardOptions(this.action.playerProxy.site.region.discard.original);
                new DiscardCardGroupEffect(this.action.player, cards, discardOptions).do();
            }
        )
    }
}

export class Resettle extends ActivePower<Denizen> {
    name = "Resettle";

    usePower(): void {
        new ChooseCardsAction(
            this.action.player, "Choose a Nomad adviser",
            [Object.values(this.gameProxy.players).reduce((a, e) => [...a, ...[...e.advisers].filter(e => e instanceof Denizen && e.suit == OathSuit.Nomad)], [] as Denizen[])],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                new ChooseSitesAction(
                    this.action.player, "Move it to a site",
                    (sites: Site[]) => {
                        if (!sites[0]) return;
                        new MoveDenizenToSiteEffect(this.game, this.action.player, cards[0], sites[0]).do();
                    }
                )
            }
        ).doNext();
    }
}

export class Oracle extends ActivePower<Denizen> {
    name = "Oracle";
    cost = new ResourceCost([[OathResource.Secret, 2]]);

    usePower(): void {
        for (const [index, card] of this.game.worldDeck.cards.entries()) {
            if (card instanceof VisionBack) {
                const vision = new DrawFromDeckEffect(this.action.player, this.game.worldDeck, 1, false, index).do()[0];
                new SearchPlayOrDiscardAction(this.action.player, vision).doNext();
            }
        }
    }
}

export class SpellBreaker extends EnemyEffectModifier<Denizen, PayPowerCost> {
    name = "Spell Breaker";
    modifiedEffect = PayPowerCost;

    applyBefore(): void {
        if (this.effect.power.cost.totalResources.get(OathResource.Secret))
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
        if (darkestSecretProxy?.owner !== this.effect.playerProxy) return;

        new MakeDecisionAction(this.effect.player, "Give Darkest Secret to become a Citizen?", () => {
            new GiveOwnableObjectEffect(this.game, this.game.chancellor, darkestSecretProxy.original).do();
            new BecomeCitizenEffect(this.effect.player).do();
            new TakeReliquaryRelicAction(this.effect.player).doNext();
        });
    }
}

export class FaithfulFriend extends WhenPlayed<Denizen> {
    name = "Faithful Friend";

    whenPlayed(): void {
        new GainSupplyEffect(this.effect.player, 4).do();
    }
}

export class Pilgrimage extends WhenPlayed<Denizen> {
    name = "Pilgrimage";

    whenPlayed(): void {
        let amount = 0;
        for (const denizenProxy of this.effect.playerProxy.site.denizens) {
            if (!denizenProxy.activelyLocked) {
                new PutDenizenIntoDispossessedEffect(this.game, this.effect.player, denizenProxy.original).do();
                amount++;
            }
        }

        for (let i = 0; i < amount; i++) {
            const card = new GetRandomCardFromDispossessed(this.game, this.effect.player).do();
            new PeekAtCardEffect(this.effect.player, card).do();
            new DiscardCardEffect(this.effect.player, card, new DiscardOptions(this.effect.playerProxy.site.region.discard.original)).do();
        }
    }
}

export class TwinBrother extends WhenPlayed<Denizen> {
    name = "Twin Brother";

    whenPlayed(): void {
        const cards = new Set<Denizen>();
        for (const playerProxy of Object.values(this.gameProxy.players)) {
            if (playerProxy !== this.effect.playerProxy) continue;
            for (const adviserProxy of playerProxy.advisers)
                if (adviserProxy instanceof Denizen && adviserProxy.suit === OathSuit.Nomad && !adviserProxy.activelyLocked)
                    cards.add(adviserProxy.original);
        }

        new ChooseCardsAction(
            this.effect.player, "Swap Twin Brother with another Nomad adviser", [cards],
            (cards: Denizen[]) => {
                if (!cards.length) return;
                const otherPlayer = cards[0].owner as OathPlayer;
                new MoveWorldCardToAdvisersEffect(this.game, otherPlayer, this.source).do();
                new MoveWorldCardToAdvisersEffect(this.game, this.effect.player, cards[0]).do();
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
            if (siteProxy !== this.effect.playerProxy.site) continue;
            for (const denizenProxy of siteProxy.denizens)
                if (denizenProxy.suit === OathSuit.Nomad && !denizenProxy.activelyLocked)
                    cards.add(denizenProxy.original);
        }

        new ChooseCardsAction(
            this.effect.player, "Swap Great Herd with another Nomad denizen", [cards],
            (cards: Denizen[]) => {
                if (!cards.length) return;
                const otherSite = cards[0].site as Site;
                new MoveDenizenToSiteEffect(this.game, this.effect.player, this.source, otherSite).do();
                new MoveDenizenToSiteEffect(this.game, this.effect.player, cards[0], this.effect.playerProxy.site.original).do();
            },
            [[0, 1]]
        ).doNext();
    }
}


export class AncientForge extends ActivePower<Edifice> {
    name = "Ancient Forge";
    cost = new ResourceCost([[OathResource.Favor, 2]], [[OathResource.Secret, 1]]);
    
    usePower(): void {
        const relic = new DrawFromDeckEffect(this.action.player, this.game.relicDeck, 1).do()[0];
        if (!relic) return;
        
        new MakeDecisionAction(
            this.action.player, "Keep the relic?",
            () => new TakeOwnableObjectEffect(this.game, this.action.player, relic).do(),
            () => relic.putOnBottom(this.action.player)
        ).doNext();
    }
}

export class BrokenForge extends ActivePower<Edifice> {
    name = "Broken Forge";
    cost = new ResourceCost([[OathResource.Favor, 2], [OathResource.Secret, 2]]);

    usePower(): void {
        new FlipEdificeEffect(this.source).do();
    }
}
