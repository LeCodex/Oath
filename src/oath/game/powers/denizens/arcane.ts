import { CampaignAttackAction, CampaignDefenseAction, TakeFavorFromBankAction, TradeAction, TravelAction, MakeDecisionAction, RestAction, ChooseCardsAction, SearchPlayOrDiscardAction, ChoosePlayersAction, ChooseSitesAction, ChooseNumberAction, SearchAction, KillWarbandsOnTargetAction, MusterAction, RecoverAction, RecoverBannerPitchAction, ChooseTsAction, ChooseRnWsAction } from "../../actions/actions";
import { InvalidActionResolution } from "../../actions/base";
import { Conspiracy, Denizen, Edifice, Relic, Site, WorldCard } from "../../cards/cards";
import { DiscardOptions } from "../../cards/decks";
import { AttackDie, DefenseDie, DieSymbol, RollResult } from "../../dice";
import { RegionDiscardEffect, PutResourcesOnTargetEffect, RollDiceEffect, BecomeCitizenEffect, DiscardCardEffect, PeekAtCardEffect, MoveResourcesToTargetEffect, PutDenizenIntoDispossessedEffect, GetRandomCardFromDispossessed, MoveWorldCardToAdvisersEffect, ParentToTargetEffect, BurnResourcesEffect } from "../../actions/effects";
import { BannerKey, OathSuit } from "../../enums";
import { OathPlayer } from "../../player";
import { Favor, OathResourceType, ResourceCost, ResourcesAndWarbands, Secret } from "../../resources";
import { ActionModifier, AttackerBattlePlan, DefenderBattlePlan, ActivePower, WhenPlayed, AccessedActionModifier, EnemyAttackerCampaignModifier, EnemyDefenderCampaignModifier } from "../powers";
import { inclusiveRange } from "../../utils";
import { WithPowers } from "../../interfaces";
import { DarkestSecret } from "../../banks";


export class FireTalkersAttack extends AttackerBattlePlan<Denizen> {
    name = "Fire Talkers";
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerKey.DarkestSecret);
        if (darkestSecretProxy?.owner !== this.activatorProxy) return;
        this.action.campaignResult.atkPool += 3;
    }
}
export class FireTalkersDefense extends DefenderBattlePlan<Denizen> {
    name = "Fire Talkers";
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerKey.DarkestSecret);
        if (darkestSecretProxy?.owner !== this.activatorProxy) return;
        this.action.campaignResult.atkPool -= 3;
    }
}

export class BillowingFogAttack extends AttackerBattlePlan<Denizen> {
    name = "Billowing Fog";
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.attackerKillsNoWarbands = true;
    }
}
export class BillowingFogDefense extends DefenderBattlePlan<Denizen> {
    name = "Billowing Fog";
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.defenderKillsNoWarbands = true;
    }
}

export class KindredWarriorsAttack extends AttackerBattlePlan<Denizen> {
    name = "Kindred Warriors";
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkRoll.ignore.add(DieSymbol.Skull);
        this.action.campaignResult.atkPool += (this.activator.ruledSuits - 1);
    }
}
export class KindredWarriorsDefense extends DefenderBattlePlan<Denizen> {
    name = "Kindred Warriors";
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool -= (this.activator.ruledSuits - 1);
    }
}

export class CrackingGroundAttack extends AttackerBattlePlan<Denizen> {
    name = "Cracking Ground";
    cost = new ResourceCost([], [[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool += [...this.action.campaignResult.targets].filter(e => e instanceof Site).length;
    }
}
export class CrackingGroundDefense extends DefenderBattlePlan<Denizen> {
    name = "Cracking Ground";
    cost = new ResourceCost([], [[Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool -= [...this.action.campaignResult.targets].filter(e => e instanceof Site).length;
    }
}

export class RustingRay extends DefenderBattlePlan<Denizen> {
    name = "Rusting Ray";
    cost = new ResourceCost([[Secret, 1]]);

    applyBefore(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerKey.DarkestSecret);
        if (darkestSecretProxy?.owner !== this.activatorProxy) return;
        this.action.campaignResult.atkRoll.ignore.add(DieSymbol.HollowSword);
    }
}

export class GleamingArmorAttack extends EnemyAttackerCampaignModifier<Denizen> {
    name = "Gleaming Armor";

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, CampaignAttackAction>>): Iterable<ActionModifier<WithPowers, CampaignAttackAction>> {
        for (const modifier of modifiers)
            if (modifier instanceof AttackerBattlePlan)
                modifier.cost.add(new ResourceCost([[Secret, 1]]));

        return [];
    }
}
export class GleamingArmorDefense extends EnemyDefenderCampaignModifier<Denizen> {
    name = "Gleaming Armor";
    
    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, CampaignDefenseAction>>): Iterable<ActionModifier<WithPowers, CampaignDefenseAction>> {
        for (const modifier of modifiers)
            if (modifier instanceof DefenderBattlePlan)
                modifier.cost.add(new ResourceCost([[Secret, 1]]));

        return [];
    }
}

export class SpiritSnare extends ActivePower<Denizen> {
    name = "Spirit Snare";
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new TakeFavorFromBankAction(this.action.player, 1).doNext();
    }
}

export class Dazzle extends WhenPlayed<Denizen> {
    name = "Dazzle";

    whenPlayed(): void {
        new RegionDiscardEffect(this.action.executor, [OathSuit.Hearth, OathSuit.Order], this.source).doNext();
    }
}

export class Tutor extends ActivePower<Denizen> {
    name = "Tutor";
    cost = new ResourceCost([[Favor, 1], [Secret, 1]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.player, Secret, 1).doNext();
    }
}

export class Alchemist extends ActivePower<Denizen> {
    name = "Alchemist";
    cost = new ResourceCost([[Secret, 1]], [[Secret, 1]]);

    usePower(): void {
        for (let i = 0; i < 4; i++) new TakeFavorFromBankAction(this.action.player, 1).doNext();
    }
}

export class WizardSchool extends ActivePower<Denizen> {
    name = "Wizard School";
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.player, Secret, 1).doNext();
        new RestAction(this.action.player).doNext();
    }
}

export class TamingCharm extends ActivePower<Denizen> {
    name = "Taming Charm";
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        new ChooseCardsAction(
            this.action.player, "Discard to gain 2 favor", [[...this.action.player.site.denizens].filter(e => e.suit === OathSuit.Beast || e.suit === OathSuit.Nomad && !e.activelyLocked)],
            (cards: Denizen[]) => {
                if (!cards[0]) return;
                const bank = this.game.favorBank(cards[0].suit);
                if (bank) new ParentToTargetEffect(this.game, this.action.player, bank.get(2)).doNext();
                new DiscardCardEffect(this.action.player, cards[0]).doNext();
            }
        ).doNext();
    }
}

export class Inquisitor extends ActivePower<Denizen> {
    name = "Inquisitor";
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
                    new MoveResourcesToTargetEffect(this.game, this.action.player, Favor, 1, card.owner, this.source).doNext();
            }
        ).doNext();
    }
}

export class TerrorSpells extends ActivePower<Denizen> {
    name = "Terror Spells";
    cost = new ResourceCost([[Secret, 1]]);

    usePower(amount: number = 2): void {
        if (this.gameProxy.banners.get(BannerKey.DarkestSecret)?.owner !== this.action.playerProxy) return;

        const targets: ResourcesAndWarbands[] = [];
        for (const siteProxy of this.gameProxy.board.sites())
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
    name = "Plague Engines";
    cost = new ResourceCost([[Secret, 1]], [[Secret, 1]]);

    usePower(): void {
        for (const playerProxy of this.gameProxy.players)
            new ParentToTargetEffect(this.game, playerProxy.original, playerProxy.original.byClass(Favor).max(playerProxy.ruledSites), this.game.favorBank(OathSuit.Arcane)).doNext();
    }
}

export class ForgottenVault extends ActivePower<Denizen> {
    name = "Forgotten Vault";
    cost = new ResourceCost([[Favor, 1]]);

    usePower(): void {
        const banner = this.game.banners.get(BannerKey.DarkestSecret);
        if (!banner) return;

        new MakeDecisionAction(
            this.action.player, "Put or remove a secret from the Darkest Secret?",
            () => new PutResourcesOnTargetEffect(this.game, this.action.player, Secret, 1, banner).doNext(),
            () => new BurnResourcesEffect(this.game, this.action.player, Secret, 1, banner).doNext(),
            ["Put", "Remove"]
        ).doNext();
    }
}

export class BloodPact extends ActivePower<Denizen> {
    name = "Blood Pact"
    cost = new ResourceCost([[Secret, 1]]);

    usePower(): void {
        const leader = this.action.playerProxy.leader.original;
        new ChooseNumberAction(
            this.action.player, "Sacrifice pairs of warbands to get secrets", inclusiveRange(1, Math.floor(this.action.player.getWarbandsAmount(leader.key) / 2)),
            (value: number) => {
                new ParentToTargetEffect(this.game, this.action.player, this.action.player.getWarbands(leader.key, 2 * value), leader.bag).doNext();
                new PutResourcesOnTargetEffect(this.game, this.action.player, Secret, value).doNext();
            }
        ).doNext();
    }
}

export class ActingTroupe extends AccessedActionModifier<Denizen, TradeAction> {
    name = "Acting Troupe";
    modifiedAction = TradeAction;

    applyBefore(): void {
        if (this.action.cardProxy.suit === OathSuit.Order || this.action.cardProxy.suit === OathSuit.Beast)
            this.sourceProxy.suit = this.action.cardProxy.suit;
    }
}

export class Jinx extends ActionModifier<Denizen, RollDiceEffect> {
    name = "Jinx";
    modifiedAction = RollDiceEffect;
    cost = new ResourceCost([[Secret, 1]]);

    canUse(): boolean {
        return !!this.action.executorProxy && this.action.executorProxy.rules(this.sourceProxy) && !(!this.sourceProxy.empty && this.gameProxy.currentPlayer === this.action.executorProxy);
    }

    applyAfter(): void {
        const result = this.action.result;
        const player = this.action.executor;
        if (!player) return;
        if (this.action.die !== AttackDie || this.action.die !== DefenseDie) return;

        const dieResult = result.dice.get(this.action.die)
        if (!dieResult) return;

        new MakeDecisionAction(player, "Reroll " + [...dieResult.values()].join(", ") + "?", () => {
            this.payCost(player, success => {
                if (!success) return;
                result.dice.set(this.action.die, new RollResult(this.game.random).roll(this.action.die, this.action.amount).dice.get(this.action.die)!)
            });
        }).doNext();
    }
}

export class Portal extends AccessedActionModifier<Denizen, TravelAction> {
    name = "Portal";
    modifiedAction = TravelAction;
    cost = new ResourceCost([[Secret, 1]]);

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TravelAction>>): Iterable<ActionModifier<WithPowers, TravelAction>> {
        return [...modifiers].filter(e => e.source instanceof Site);
    }

    applyBefore(): void {
        if (this.activatorProxy.site !== this.sourceProxy.site && this.action.siteProxy !== this.sourceProxy.site)
            throw new InvalidActionResolution("When using the Portal, you must travel to or from its site");

        this.action.noSupplyCost = true;
    }
}

export class SecretSignal extends AccessedActionModifier<Denizen, TradeAction> {
    name = "Secret Signal";
    modifiedAction = TradeAction;
    
    applyAfter(): void {
        const bank = this.game.favorBank(this.action.cardProxy.suit);
        if (bank && this.action.getting.get(Favor) === 1)
            new ParentToTargetEffect(this.game, this.action.player, bank.get(1)).doNext();
    }
}

export class InitiationRite extends AccessedActionModifier<Denizen, MusterAction> {
    name = "Initiation Rite";
    modifiedAction = MusterAction;
    mustUse = true;
    
    applyBefore(): void {
        this.action.using = Secret;
    }
}

export class SealingWard extends EnemyAttackerCampaignModifier<Denizen> {
    name = "Sealing Ward";
    
    applyAfter(): void {
        for (const target of this.action.campaignResult.targets)
            if (target instanceof Relic && target.owner === this.sourceProxy.ruler?.original)
                this.action.campaignResult.defPool += 1;
    }
}

export class Augury extends AccessedActionModifier<Denizen, SearchAction> {
    name = "Augury";
    modifiedAction = SearchAction;
    
    applyBefore(): void {
        this.action.amount++;
    }
}

export class Observatory extends AccessedActionModifier<Denizen, SearchAction> {
    name = "Observatory";
    modifiedAction = SearchAction;
    
    applyAtStart(): void {
        if (this.action.playerProxy.site === this.sourceProxy.site)
            for (const region of Object.values(this.game.board.children))
                this.action.selects.deck.choices.set(region.name, region.discard);
    }
}

export class MagiciansCode extends AccessedActionModifier<Denizen, RecoverBannerPitchAction> {
    name = "Magician's Code";
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

export class MapLibrary extends AccessedActionModifier<Denizen, TradeAction> {
    name = "Map Library";
    modifiedAction = TradeAction;
    
    applyAtStart(): void {
        if (this.action.playerProxy.site === this.sourceProxy.site && this.sourceProxy.site.region)
            for (const siteProxy of this.sourceProxy.site.region.sites)
                for (const denizenProxy of siteProxy.denizens)
                    this.action.selects.card.choices.set(denizenProxy.name, denizenProxy);
    }
}

export class MasterOfDisguise extends AccessedActionModifier<Denizen,TradeAction> {
    name = "Master of Disguise";
    modifiedAction = TradeAction;

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, TradeAction>>): Iterable<ActionModifier<WithPowers, TradeAction>> {
        // Ignore all other modifiers, since we are going to select them again anyways
        // TODO: Have a flag for all the "act as if" powers? Currently, if you choose two of them, they cancel each other out
        return [...modifiers].filter(e => e !== this);
    }

    applyWhenApplied(): boolean {
        new ChoosePlayersAction(
            this.activator, "Act as if you have another player's advisers instead",
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
    name = "Witch's Bargain";
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
                                giftedResource = Secret, takenResource = Favor;
                                giving = -value, taking = -value * 2;
                            }
                            
                            new MoveResourcesToTargetEffect(this.game, this.action.player, giftedResource, giving, player).doNext(amount => {
                                if (amount > 0) return;
                                new MoveResourcesToTargetEffect(this.game, this.action.player, takenResource, taking, this.action.player, player).doNext();
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
    name = "Bewitch";

    whenPlayed(): void {
        if (this.action.executorProxy.getAllResources(Secret) > this.gameProxy.chancellor.byClass(Secret).length)
            new MakeDecisionAction(this.action.executor, "Become a Citizen?", () => new BecomeCitizenEffect(this.action.executor).doNext());
    }
}

export class Revelation extends WhenPlayed<Denizen> {
    name = "Revelation";

    whenPlayed(): void {
        for (const player of this.game.players) {
            new ChooseNumberAction(
                player, "Burn favor to gain secrets", inclusiveRange(player.byClass(Favor).length),
                (value: number) => {
                    new BurnResourcesEffect(this.game, player, Favor, value).doNext();
                    new PutResourcesOnTargetEffect(this.game, player, Secret, value).doNext();
                }
            ).doNext();
        }
    }
}

export class VowOfSilence extends AccessedActionModifier<Denizen, ParentToTargetEffect> {
    name = "Vow of Silence";
    modifiedAction = ParentToTargetEffect;
    mustUse = true;

    applyAfter(): void {
        for (const object of this.action.objects)
            if (object instanceof Secret && object.parent === this.sourceProxy.ruler?.original)
                this.action.objects.delete(object);
    }
}
export class VowOfSilenceRecover extends AccessedActionModifier<Denizen, RecoverAction> {
    name = "Vow of Silence";
    modifiedAction = RecoverAction;
    mustUse = true;

    applyBefore(): void {
        if (this.action.targetProxy === this.gameProxy.banners.get(BannerKey.DarkestSecret))
            throw new InvalidActionResolution("Cannot recover the Darkest Secret with the Vow of Silence");
    }
}
export class VowOfSilencePitch extends ActionModifier<Denizen, RecoverBannerPitchAction> {
    name = "Vow of Silence";
    modifiedAction = RecoverBannerPitchAction;
    mustUse = true;

    applyAfter(): void {
        new PutResourcesOnTargetEffect(this.game, this.sourceProxy.ruler?.original, Secret, this.action.amount).doNext();
    }
}

export class DreamThief extends ActivePower<Denizen> {
    name = "Dream Thief";
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


export class GreatSpire extends AccessedActionModifier<Edifice, SearchAction> {
    name = "Great Spire";
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
    
                        // TODO: Put this in an effect
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
    name = "Fallen Spire";
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
        )
    }
}