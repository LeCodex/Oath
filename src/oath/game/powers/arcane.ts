import { CampaignAttackAction, CampaignDefenseAction, TakeFavorFromBankAction, TradeAction, TravelAction, MakeDecisionAction, RestAction, ChooseCardsAction, SearchPlayOrDiscardAction, ChoosePlayersAction, ChooseNumberAction, SearchAction, KillWarbandsOnTargetAction, MusterAction, RecoverBannerPitchAction, ChooseRnWsAction, RecoverAction } from "../actions";
import { Conspiracy, Denizen, Edifice, Relic, Site, WorldCard } from "../cards";
import { DiscardOptions } from "../cards/decks";
import { AttackDie, AttackDieSymbol, DefenseDie, RollResult } from "../dice";
import { RegionDiscardEffect, PutResourcesOnTargetEffect, RollDiceEffect, BecomeCitizenEffect, DiscardCardEffect, PeekAtCardEffect, PutDenizenIntoDispossessedEffect, GetRandomCardFromDispossessed, MoveWorldCardToAdvisersEffect, ParentToTargetEffect, TransferResourcesEffect } from "../actions/effects";
import { BannerKey, OathSuit } from "../enums";
import { ExileBoard, OathPlayer } from "../player";
import { Favor, OathResourceType, ResourcesAndWarbands, Secret } from "../resources";
import { ResourceCost , ResourceTransferContext, SupplyCostContext } from "../costs";

import { ActionModifier, AttackerBattlePlan, DefenderBattlePlan, ActivePower, WhenPlayed, Accessed, EnemyAttackerCampaignModifier, BattlePlan , NoSupplyCostActionModifier , ResourceTransferModifier } from ".";


import { inclusiveRange } from "../utils";
import { WithPowers } from "../interfaces";
import { DarkestSecret } from "../banks";


export class FireTalkersAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerKey.DarkestSecret);
        if (darkestSecretProxy?.owner !== this.playerProxy) return;
        this.action.campaignResult.atkPool += 3;
    }
}
export class FireTalkersDefense extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerKey.DarkestSecret);
        if (darkestSecretProxy?.owner !== this.playerProxy) return;
        this.action.campaignResult.atkPool -= 3;
    }
}

export class BillowingFogAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.attackerKillsNoWarbands = true;
    }
}
export class BillowingFogDefense extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.defenderKillsNoWarbands = true;
    }
}

export class KindredWarriorsAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkRoll.ignore.add(AttackDieSymbol.Skull);
        this.action.campaignResult.atkPool += (this.player.ruledSuits - 1);
    }
}
export class KindredWarriorsDefense extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool -= (this.player.ruledSuits - 1);
    }
}

export class CrackingGroundAttack extends AttackerBattlePlan<Denizen> {
    cost = new ResourceCost([], [[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool += [...this.action.campaignResult.targets].filter(e => e instanceof Site).length;
    }
}
export class CrackingGroundDefense extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([], [[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool -= [...this.action.campaignResult.targets].filter(e => e instanceof Site).length;
    }
}

export class RustingRay extends DefenderBattlePlan<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerKey.DarkestSecret);
        if (darkestSecretProxy?.owner !== this.playerProxy) return;
        this.action.campaignResult.atkRoll.ignore.add(AttackDieSymbol.HollowSword);
    }
}

export class GleamingArmor extends ResourceTransferModifier<Denizen> {
    mustUse = true;

    canUse(context: ResourceTransferContext): boolean {
        if (!(context.origin instanceof BattlePlan)) return false;
        const campaignResult = (context.origin.action as CampaignAttackAction | CampaignDefenseAction).campaignResult;
        const ruler = this.sourceProxy.ruler?.original;
        return campaignResult.areEnemies(ruler, this.player);
    }

    apply(context: ResourceTransferContext): void {
        context.cost.add(new ResourceCost([[Secret, 1]]));
    }
}

export class SpiritSnare extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new TakeFavorFromBankAction(this.action.player, 1).doNext();
    }
}

export class Dazzle extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        new RegionDiscardEffect(this.action.executor, [OathSuit.Hearth, OathSuit.Order], this.source).doNext();
    }
}

export class Tutor extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1], [Secret, 1]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.player, Secret, 1).doNext();
    }
}

export class Alchemist extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]], [[Secret, 1]]);

    usePower(): void {
        for (let i = 0; i < 4; i++) new TakeFavorFromBankAction(this.action.player, 1).doNext();
    }
}

export class WizardSchool extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.player, Secret, 1).doNext();
        new RestAction(this.action.player).doNext();
    }
}

export class TamingCharm extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new ChooseCardsAction(
            this.action.player, "Discard to gain 2 favor", [[...this.action.player.site.denizens].filter(e => e.suit === OathSuit.Beast || e.suit === OathSuit.Nomad && !e.activelyLocked)],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                const bank = this.game.favorBank(cards[0].suit);
                if (bank)
                    new TransferResourcesEffect(this.game, new ResourceTransferContext(this.action.player, this, new ResourceCost([[Favor, 2]]), this.action.player, bank)).doNext();
                new DiscardCardEffect(this.action.player, cards[0]).doNext();
            }
        ).doNext();
    }
}

export class Inquisitor extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        const cards = new Set<WorldCard>();
        for (const playerProxy of this.gameProxy.players) {
            if (playerProxy === this.action.playerProxy || playerProxy.site !== this.action.playerProxy.site) continue;
            for (const adviserProxy of playerProxy.advisers)
                if (adviserProxy.original.facedown) cards.add(adviserProxy.original);
        }

        new ChooseCardsAction(
            this.action.player, "Peek at an adviser", [cards],
            (cards: WorldCard[]) => {
                const card = cards[0];
                if (!card) return;
                new PeekAtCardEffect(this.action.player, card).doNext();

                if (card instanceof Conspiracy)
                    new SearchPlayOrDiscardAction(this.action.player, card).doNext();
                else
                    new TransferResourcesEffect(this.game, new ResourceTransferContext(this.action.player, this, new ResourceCost([[Favor, 1]]), card.owner!, this.source)).doNext();
            }
        ).doNext();
    }
}

export class TerrorSpells extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(amount: number = 2): void {
        if (this.gameProxy.banners.get(BannerKey.DarkestSecret)?.owner !== this.action.playerProxy) return;

        const targets: ResourcesAndWarbands[] = [];
        for (const siteProxy of this.gameProxy.map.sites())
            if (siteProxy.region === this.action.playerProxy.site.region && siteProxy.warbands.length > 0)
                targets.push(siteProxy.original);
        
        for (const playerProxy of this.gameProxy.players)
            if (playerProxy.site.region === this.action.playerProxy.site.region && playerProxy.warbands.length > 0)
                targets.push(playerProxy.original);

        new ChooseRnWsAction(
            this.action.player, "Kill a warband (" + amount + " left)",
            (targets: ResourcesAndWarbands[]) => {
                if (targets[0]) {
                    new KillWarbandsOnTargetAction(this.action.player, targets[0], 1).doNext();
                    amount--;
                }
                if (amount) this.usePower(amount);
            },
            [targets]
        ).doNext();
    }
}

export class PlagueEngines extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]], [[Secret, 1]]);

    usePower(): void {
        for (const playerProxy of this.gameProxy.players)
            new ParentToTargetEffect(this.game, playerProxy.original, playerProxy.original.byClass(Favor).max(playerProxy.ruledSites), this.game.favorBank(OathSuit.Arcane)).doNext();
    }
}

export class ForgottenVault extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        const banner = this.game.banners.get(BannerKey.DarkestSecret);
        if (!banner) return;

        new MakeDecisionAction(
            this.action.player, "Put or remove a secret from the Darkest Secret?",
            () => new PutResourcesOnTargetEffect(this.game, this.action.player, Secret, 1, banner).doNext(),
            () => new TransferResourcesEffect(this.game, new ResourceTransferContext(this.action.player, this, new ResourceCost([], [[Secret, 1]]), undefined, banner)).doNext(),
            ["Put", "Remove"]
        ).doNext();
    }
}

export class BloodPact extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const leader = this.action.playerProxy.leader.original;
        new ChooseNumberAction(
            this.action.player, "Sacrifice pairs of warbands to get secrets", inclusiveRange(1, Math.floor(this.action.player.getWarbandsAmount(leader.board.key) / 2)),
            (value: number) => {
                new ParentToTargetEffect(this.game, this.action.player, this.action.player.getWarbands(leader.board.key, 2 * value), leader.bag).doNext();
                new PutResourcesOnTargetEffect(this.game, this.action.player, Secret, value).doNext();
            }
        ).doNext();
    }
}

@Accessed
export class ActingTroupe extends ActionModifier<Denizen, TradeAction> {
    modifiedAction = TradeAction;

    applyBefore(): void {
        if (this.action.cardProxy.suit === OathSuit.Order || this.action.cardProxy.suit === OathSuit.Beast)
            this.sourceProxy.suit = this.action.cardProxy.suit;
    }
}

export class Jinx extends ActionModifier<Denizen, RollDiceEffect<AttackDie | DefenseDie>> {
    modifiedAction = RollDiceEffect;
    cost = new ResourceCost([[Secret, 1]]);

    canUse(): boolean {
        return !!this.action.executorProxy && this.action.executorProxy.rules(this.sourceProxy) && !(!this.sourceProxy.empty && this.gameProxy.currentPlayer === this.action.executorProxy);
    }

    applyAfter(): void {
        const result = this.action.result;
        const player = this.action.executor;
        if (!player) return;
        if (!(this.action.result.die instanceof AttackDie) || !(this.action.result.die instanceof DefenseDie)) return;

        new MakeDecisionAction(player, "Reroll " + this.action.result.rolls.map(e => e.join(" & ")).join(", ") + " ?", () => {
            this.payCost(success => {
                if (!success) return;
                result.rolls = new RollResult(this.game.random, this.action.result.die).roll(this.action.amount).rolls;
            });
        }).doNext();
    }
}

@Accessed
export class Portal extends ActionModifier<Denizen, TravelAction> {
    modifiedAction = TravelAction;
    cost = new ResourceCost([[Secret, 1]]);

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TravelAction>>): Iterable<ActionModifier<WithPowers, TravelAction>> {
        return [...modifiers].filter(e => e.source instanceof Site);
    }

    applyAtStart(): void {
        if (this.player.site !== this.source.site)
            this.action.selects.siteProxy.filterChoices(e => e.original === this.source.site);
    }
}
export class PortalCost extends NoSupplyCostActionModifier(Portal) { }

@Accessed
export class SecretSignal extends ActionModifier<Denizen, TradeAction> {
    modifiedAction = TradeAction;
    
    applyAfter(): void {
        const bank = this.game.favorBank(this.action.cardProxy.suit);
        if (bank && this.action.getting.get(Favor) === 1)
            new TransferResourcesEffect(this.game, new ResourceTransferContext(this.action.player, this, new ResourceCost([[Favor, 1]]), this.action.player.board, bank)).doNext();
    }
}

@Accessed
export class InitiationRite extends ResourceTransferModifier<Denizen> {
    mustUse = true;

    canUse(context: ResourceTransferContext): boolean {
        return context.origin instanceof MusterAction;
    }

    apply(context: ResourceTransferContext): void {
        context.cost.placedResources.set(Secret, context.cost.placedResources.get(Favor) || 0);
        context.cost.placedResources.set(Favor, 0);
    }
}

export class SealingWard extends EnemyAttackerCampaignModifier<Denizen> {
    
    applyAfter(): void {
        for (const target of this.action.campaignResult.targets)
            if (target instanceof Relic && target.owner === this.sourceProxy.ruler?.original)
                this.action.campaignResult.defPool += 1;
    }
}

@Accessed
export class Augury extends ActionModifier<Denizen, SearchAction> {
    modifiedAction = SearchAction;
    
    applyBefore(): void {
        this.action.amount++;
    }
}

@Accessed
export class Observatory extends ActionModifier<Denizen, SearchAction> {
    modifiedAction = SearchAction;
    
    applyAtStart(): void {
        if (this.action.playerProxy.site === this.sourceProxy.site)
            for (const region of this.game.map.children)
                this.action.selects.deckProxy.choices.set(region.name, region.discard);
    }
}

@Accessed
export class MagiciansCode extends ActionModifier<Denizen, RecoverBannerPitchAction> {
    modifiedAction = RecoverBannerPitchAction;  // Technically should be chosen at the time you recover, but this is way simpler
    cost = new ResourceCost([[Favor, 2]]);

    canUse(): boolean {
        return super.canUse() && this.action.banner instanceof DarkestSecret;
    }

    applyAtStart(): void {
        const amounts = [this.action.banner.amount];
        if (this.action.banner.amount > 0) amounts.unshift(this.action.banner.amount - 1);
        for (const amount of amounts) this.action.selects.amount.choices.set(amount.toString(), amount);
    }
    
    applyBefore(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.player, Secret, 2).doNext();
        this.action.amount += 2;
    }
}

@Accessed
export class MapLibrary extends ActionModifier<Denizen, TradeAction> {
    modifiedAction = TradeAction;
    
    applyWhenApplied(): boolean {
        if (this.action.playerProxy.site === this.sourceProxy.site && this.sourceProxy.site.region)
            for (const siteProxy of this.sourceProxy.site.region.sites)
                this.action.accessibleDenizenProxies.push(...siteProxy.denizens);

        return true;
    }
}

@Accessed
export class MasterOfDisguise extends ActionModifier<Denizen,TradeAction> {
    modifiedAction = TradeAction;

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TradeAction>>): Iterable<ActionModifier<WithPowers, TradeAction>> {
        // Ignore all other modifiers, since we are going to select them again anyways
        // TODO: Have a flag for all the "act as if" powers? Currently, if you choose two of them, they cancel each other out
        return [...modifiers].filter(e => e !== this);
    }

    applyWhenApplied(): boolean {
        new ChoosePlayersAction(
            this.player, "Act as if you have another player's advisers instead",
            (players: OathPlayer[]) => {
                if (!players[0]) return;
                for (const cardProxy of this.action.playerProxy.advisers) cardProxy.prune();
                for (const cardProxy of players[0].advisers) this.action.playerProxy.addChild(cardProxy);
                this.action.doNext();  // Allow the player to choose other new modifiers
            }
        ).doNext();
        return false;
    }
}

export class WitchsBargain extends ActivePower<Denizen> {
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new ChoosePlayersAction(
            this.action.player, "Bargain with players at your site",
            (players: OathPlayer[]) => {
                for (const player of players) {
                    const maxSecrets = this.action.player.byClass(Secret).length;
                    const maxFavors = Math.floor(this.action.player.byClass(Favor).length / 2);
                    
                    new ChooseNumberAction(
                        this.action.player, "Give favors to take secrets (positive), or vice versa (negative)", inclusiveRange(-maxSecrets, maxFavors),
                        (value: number) => {
                            let giftedResource: OathResourceType = Favor, takenResource: OathResourceType = Secret;
                            let giving = value * 2, taking = value;
                            if (value < 0) {
                                giftedResource = Secret;
                                takenResource = Favor;
                                giving = -value;
                                taking = -value * 2;
                            }
                            
                            new TransferResourcesEffect(this.game, new ResourceTransferContext(this.action.player, this, new ResourceCost([[giftedResource, giving]]), player)).doNext(success => {
                                if (!success) return;
                                new TransferResourcesEffect(this.game, new ResourceTransferContext(this.action.player, this, new ResourceCost([[takenResource, taking]]), this.action.player, player)).doNext();
                            });
                        }
                    ).doNext();
                }
            },
            [this.gameProxy.players.filter(e => e.site === this.action.playerProxy.site).map(e => e.original)],
            [[1, Infinity]]
        ).doNext();
    }
}

export class Bewitch extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        if (!(this.action.playerProxy.board instanceof ExileBoard)) return;
        if (this.action.executorProxy.getAllResources(Secret) > this.gameProxy.chancellor.byClass(Secret).length)
            new MakeDecisionAction(this.action.executor, "Become a Citizen?", () => new BecomeCitizenEffect(this.action.executor).doNext()).doNext();
    }
}

export class Revelation extends WhenPlayed<Denizen> {
    whenPlayed(): void {
        for (const player of this.game.players) {
            new ChooseNumberAction(
                player, "Burn favor to gain secrets", inclusiveRange(player.byClass(Favor).length),
                (value: number) => {
                    new TransferResourcesEffect(this.game, new ResourceTransferContext(player, this, new ResourceCost([], [[Favor, value]]), undefined)).doNext();
                    new PutResourcesOnTargetEffect(this.game, player, Secret, value).doNext();
                }
            ).doNext();
        }
    }
}

@Accessed
export class VowOfSilence extends ActionModifier<Denizen, ParentToTargetEffect> {
    modifiedAction = ParentToTargetEffect;
    mustUse = true;

    applyAfter(): void {
        for (const object of this.action.objects)
            if (object instanceof Secret && object.parent === this.sourceProxy.ruler?.original)
                this.action.objects.delete(object);
    }
}
@Accessed
export class VowOfSilenceRecover extends ActionModifier<Denizen, RecoverAction> {
    modifiedAction = RecoverAction;
    mustUse = true;

    applyAtStart(): void {
        this.action.selects.targetProxy.filterChoices(e => e !== this.gameProxy.banners.get(BannerKey.DarkestSecret))
    }
}
export class VowOfSilencePitch extends ActionModifier<Denizen, RecoverBannerPitchAction> {
    modifiedAction = RecoverBannerPitchAction;
    mustUse = true;

    applyAfter(): void {
        new PutResourcesOnTargetEffect(this.game, this.sourceProxy.ruler?.original, Secret, this.action.amount).doNext();
    }
}

export class DreamThief extends ActivePower<Denizen> {
    cost = new ResourceCost([[Favor, 2]]);

    usePower(): void {
        const cards = new Set<WorldCard>();
        for (const playerProxy of this.gameProxy.players) {
            if (playerProxy === this.action.playerProxy || playerProxy.site !== this.action.playerProxy.site) continue;
            for (const adviserProxy of playerProxy.advisers)
                if (adviserProxy.original.facedown && !(adviserProxy instanceof Denizen && adviserProxy.activelyLocked))
                    cards.add(adviserProxy.original);
        }

        new ChooseCardsAction(
            this.action.player, "Swap two facedown advisers", [cards], 
            (cards: WorldCard[]) => {
                if (!cards[0] || !cards[1]) return;  // Done this way so Typescript is happy
                const player1 = cards[0].owner as OathPlayer;
                const player2 = cards[1].owner as OathPlayer;
                new MoveWorldCardToAdvisersEffect(this.game, player2, cards[0]).doNext();
                new MoveWorldCardToAdvisersEffect(this.game, player1, cards[1]).doNext();
            },
            [[2]]
        ).doNext();
    }
}


@Accessed
export class GreatSpire extends ActionModifier<Edifice, SearchAction> {
    modifiedAction = SearchAction;
    cost = new ResourceCost([[Secret, 1]]);

    applyAtEnd(): void {
        const denizens = [...this.action.cards].filter(e => e instanceof Denizen);
        new ChooseCardsAction(
            this.action.player, "Swap cards with the Dispossessed", [denizens],
            (cards: Denizen[]) => {
                for (const card of cards) {
                    new GetRandomCardFromDispossessed(this.game, this.action.player).doNext(newCard => {
                        new PutDenizenIntoDispossessedEffect(this.game, this.action.player, card).doNext();
                        new PeekAtCardEffect(this.action.player, newCard).doNext();
    
                        this.action.cards.delete(card);
                        this.action.cards.add(newCard);
                    });
                }
            },
            [[0, denizens.length]]
        ).doNext();
    }
}

export class FallenSpire extends ActivePower<Edifice> {
    cost = new ResourceCost([[Secret, 1]], [[Secret, 1]]);

    usePower(): void {
        const discard = this.action.playerProxy.site.region?.discard.original;
        if (!discard) return;

        new ChooseNumberAction(
            this.action.player, "Swap cards from your region's discard with the Dispossessed", inclusiveRange(1, Math.min(discard.children.length, 5)),
            (value: number) => {
                const discardOptions = new DiscardOptions(discard);
                let skip = 0;
                while (value > 0) {
                    const card = discard.children[skip];
                    if (!card) break;
                    if (!(card instanceof Denizen)) {
                        new DiscardCardEffect(this.action.player, card, discardOptions).doNext();
                        skip++;
                        continue;
                    }
                    
                    new GetRandomCardFromDispossessed(this.game, this.action.player).doNext(newCard => {
                        new PutDenizenIntoDispossessedEffect(this.game, this.action.player, card).doNext();
                        new DiscardCardEffect(this.action.player, newCard, discardOptions).doNext();
                    });
                    value--;
                }
            }
        ).doNext();
    }
}