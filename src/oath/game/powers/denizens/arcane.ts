import { CampaignAttackAction, CampaignDefenseAction, TakeFavorFromBankAction, TradeAction, TravelAction, InvalidActionResolution, MakeDecisionAction, RestAction, ChooseCardsAction, SearchPlayOrDiscardAction, ChoosePlayersAction, ChooseSitesAction, ChooseNumberAction, SearchAction, KillWarbandsOnTargetAction, MusterAction, RecoverAction, RecoverBannerPitchAction } from "../../actions/actions";
import { Conspiracy, Denizen, Edifice, Relic, Site, WorldCard } from "../../cards/cards";
import { DiscardOptions } from "../../cards/decks";
import { AttackDie, DefenseDie, DieSymbol, RollResult } from "../../dice";
import { RegionDiscardEffect, PutResourcesOnTargetEffect, RollDiceEffect, BecomeCitizenEffect, DiscardCardEffect, TakeResourcesFromBankEffect, PeekAtCardEffect, MoveAdviserEffect, MoveResourcesToTargetEffect, TakeWarbandsIntoBagEffect, PutResourcesIntoBankEffect, DrawFromDeckEffect, PutDenizenIntoDispossessedEffect, GetRandomCardFromDispossessed, MoveWorldCardToAdvisersEffect } from "../../effects";
import { BannerName, OathResource, OathSuit } from "../../enums";
import { OathPlayer } from "../../player";
import { ResourceCost } from "../../resources";
import { ActionModifier, AttackerBattlePlan, DefenderBattlePlan, ActivePower, WhenPlayed, AccessedActionModifier, EffectModifier, AccessedEffectModifier, EnemyAttackerCampaignModifier, EnemyDefenderCampaignModifier } from "../powers";
import { AbstractConstructor, inclusiveRange } from "../../utils";
import { WithPowers } from "../../interfaces";
import { DarkestSecret } from "../../banks";


export class FireTalkersAttack extends AttackerBattlePlan<Denizen> {
    name = "Fire Talkers";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerName.DarkestSecret);
        if (darkestSecretProxy?.owner !== this.activatorProxy) return;
        this.action.campaignResult.params.atkPool += 3;
    }
}
export class FireTalkersDefense extends DefenderBattlePlan<Denizen> {
    name = "Fire Talkers";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerName.DarkestSecret);
        if (darkestSecretProxy?.owner !== this.activatorProxy) return;
        this.action.campaignResult.params.atkPool -= 3;
    }
}

export class BillowingFogAttack extends AttackerBattlePlan<Denizen> {
    name = "Billowing Fog";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.params.attackerKillsNoWarbands = true;
    }
}
export class BillowingFogDefense extends DefenderBattlePlan<Denizen> {
    name = "Billowing Fog";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.params.defenderKillsNoWarbands = true;
    }
}

export class KindredWarriorsAttack extends AttackerBattlePlan<Denizen> {
    name = "Kindred Warriors";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.params.atkRoll.ignore.add(DieSymbol.Skull);
        this.action.campaignResult.params.atkPool += (this.activator.ruledSuits - 1);
    }
}
export class KindredWarriorsDefense extends DefenderBattlePlan<Denizen> {
    name = "Kindred Warriors";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.params.atkPool -= (this.activator.ruledSuits - 1);
    }
}

export class CrackingGroundAttack extends AttackerBattlePlan<Denizen> {
    name = "Cracking Ground";
    cost = new ResourceCost([], [[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.params.atkPool += [...this.action.campaignResult.params.targets].filter(e => e instanceof Site).length;
    }
}
export class CrackingGroundDefense extends DefenderBattlePlan<Denizen> {
    name = "Cracking Ground";
    cost = new ResourceCost([], [[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.params.atkPool -= [...this.action.campaignResult.params.targets].filter(e => e instanceof Site).length;
    }
}

export class RustingRay extends DefenderBattlePlan<Denizen> {
    name = "Rusting Ray";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerName.DarkestSecret);
        if (darkestSecretProxy?.owner !== this.activatorProxy) return;
        this.action.campaignResult.params.atkRoll.ignore.add(DieSymbol.HollowSword);
    }
}

export class GleamingArmorAttack extends EnemyAttackerCampaignModifier<Denizen> {
    name = "Gleaming Armor";

    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, CampaignAttackAction>>): Iterable<ActionModifier<WithPowers, CampaignAttackAction>> {
        for (const modifier of modifiers)
            if (modifier instanceof AttackerBattlePlan)
                modifier.cost.add(new ResourceCost([[OathResource.Secret, 1]]));

        return [];
    }
}
export class GleamingArmorDefense extends EnemyDefenderCampaignModifier<Denizen> {
    name = "Gleaming Armor";
    
    applyImmediately(modifiers: Iterable<ActionModifier<WithPowers, CampaignDefenseAction>>): Iterable<ActionModifier<WithPowers, CampaignDefenseAction>> {
        for (const modifier of modifiers)
            if (modifier instanceof DefenderBattlePlan)
                modifier.cost.add(new ResourceCost([[OathResource.Secret, 1]]));

        return [];
    }
}

export class SpiritSnare extends ActivePower<Denizen> {
    name = "Spirit Snare";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        new TakeFavorFromBankAction(this.action.player, 1).doNext();
    }
}

export class Dazzle extends WhenPlayed<Denizen> {
    name = "Dazzle";

    whenPlayed(): void {
        new RegionDiscardEffect(this.effect.player, [OathSuit.Hearth, OathSuit.Order], this.source).do();
    }
}

export class Tutor extends ActivePower<Denizen> {
    name = "Tutor";
    cost = new ResourceCost([[OathResource.Favor, 1], [OathResource.Secret, 1]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.player, OathResource.Secret, 1).do();
    }
}

export class Alchemist extends ActivePower<Denizen> {
    name = "Alchemist";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Secret, 1]]);

    usePower(): void {
        for (let i = 0; i < 4; i++) new TakeFavorFromBankAction(this.action.player, 1).doNext();
    }
}

export class WizardSchool extends ActivePower<Denizen> {
    name = "Wizard School";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.player, OathResource.Secret, 1).do();
        new RestAction(this.action.player).doNext();
    }
}

export class TamingCharm extends ActivePower<Denizen> {
    name = "Taming Charm";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        new ChooseCardsAction(
            this.action.player, "Discard to gain 2 favor", [[...this.action.player.site.denizens].filter(e => e.suit === OathSuit.Beast || e.suit === OathSuit.Nomad && !e.activelyLocked)],
            (cards: Denizen[]) => {
                if (!cards.length) return;
                new TakeResourcesFromBankEffect(this.game, this.action.player, this.game.favorBanks.get(cards[0].suit), 2).do();
                new DiscardCardEffect(this.action.player, cards[0]).do();
            }
        ).doNext();
    }
}

export class Inquisitor extends ActivePower<Denizen> {
    name = "Inquisitor";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        const cards = new Set<WorldCard>();
        for (const playerProxy of Object.values(this.gameProxy.players)) {
            if (playerProxy === this.action.playerProxy || playerProxy.site !== this.action.playerProxy.site) continue;
            for (const adviserProxy of playerProxy.advisers)
                if (adviserProxy.original.facedown) cards.add(adviserProxy.original);
        }

        new ChooseCardsAction(
            this.action.player, "Peek at an adviser", [cards],
            (cards: WorldCard[]) => {
                const card = cards[0];
                if (!card) return;
                new PeekAtCardEffect(this.action.player, card).do();

                if (card instanceof Conspiracy)
                    new SearchPlayOrDiscardAction(this.action.player, new MoveAdviserEffect(this.game, this.action.player, card).do()).doNext();
                else
                    new MoveResourcesToTargetEffect(this.game, this.action.player, OathResource.Favor, 1, card.owner, this.source).do();
            }
        ).doNext();
    }
}

export class TerrorSpells extends ActivePower<Denizen> {
    name = "Terror Spells";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(amount: number = 2): void {
        if (this.gameProxy.banners.get(BannerName.DarkestSecret)?.owner !== this.action.playerProxy) return;

        new MakeDecisionAction(
            this.action.player, "Kill at site or on boards? (" + amount + " left)",
            () => new ChooseSitesAction(
                this.action.player, "Kill a warband (" + amount + " left)",
                (sites: Site[]) => { 
                    if (sites[0]) new KillWarbandsOnTargetAction(this.action.player, sites[0], 1).doNext();
                    if (--amount) this.usePower(amount);
                },
                [this.action.playerProxy.site.region.original.sites.filter(e => e.totalWarbands)]
            ).doNext(),
            () => new ChoosePlayersAction(
                this.action.player, "Kill a warband (" + amount + " left)",
                (targets: OathPlayer[]) => {
                    if (targets[0]) new KillWarbandsOnTargetAction(this.action.player, targets[0], 1).doNext();
                    if (--amount) this.usePower(amount);
                },
                [Object.values(this.gameProxy.players).filter(e => e.site.region === this.action.playerProxy.site.region && e.original.totalWarbands > 0).map(e => e.original)]
            ).doNext(),
            ["At sites", "On boards"]
        ).doNext();
    }
}

export class PlagueEngines extends ActivePower<Denizen> {
    name = "Plague Engines";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Secret, 1]]);

    usePower(): void {
        for (const playerProxy of Object.values(this.gameProxy.players))
            new PutResourcesIntoBankEffect(this.game, playerProxy.original, this.game.favorBanks.get(OathSuit.Arcane), playerProxy.ruledSites).do();
    }
}

export class ForgottenVault extends ActivePower<Denizen> {
    name = "Forgotten Vault";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        new MakeDecisionAction(
            this.action.player, "Put or remove a secret from the Darkest Secret?",
            () => new PutResourcesIntoBankEffect(this.game, undefined, this.game.banners.get(BannerName.DarkestSecret), 1).do(),
            () => new TakeResourcesFromBankEffect(this.game, undefined, this.game.banners.get(BannerName.DarkestSecret), 1).do(),
            ["Put", "Remove"]
        ).doNext();
    }
}

export class BloodPact extends ActivePower<Denizen> {
    name = "Blood Pact"
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        new ChooseNumberAction(
            this.action.player, "Sacrifice pairs of warbands to get secrets", inclusiveRange(1, Math.floor(this.action.player.getWarbands(this.action.playerProxy.leader.original) / 2)),
            (value: number) => {
                new TakeWarbandsIntoBagEffect(this.action.playerProxy.leader.original, 2 * value, this.action.player).do();
                new PutResourcesOnTargetEffect(this.game, this.action.player, OathResource.Secret, value).do();
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

export class Jinx extends EffectModifier<Denizen, RollDiceEffect> {
    name = "Jinx";
    modifiedEffect = RollDiceEffect;
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    canUse(): boolean {
        return !!this.effect.playerProxy && this.effect.playerProxy.rules(this.sourceProxy) && !(!this.sourceProxy.empty && this.gameProxy.currentPlayer === this.effect.playerProxy);
    }

    applyAfter(result: RollResult): void {
        const player = this.effect.player;
        if (!player) return;
        if (this.effect.die !== AttackDie || this.effect.die !== DefenseDie) return;

        const dieResult = result.dice.get(this.effect.die)
        if (!dieResult) return;

        new MakeDecisionAction(player, "Reroll " + [...dieResult.values()].join(", ") + "?", () => {
            if (!this.payCost(player)) return;
            result.dice.set(this.effect.die, new RollResult().roll(this.effect.die, this.effect.amount).dice.get(this.effect.die)!)
        }).doNext();
    }
}

export class Portal extends AccessedActionModifier<Denizen, TravelAction> {
    name = "Portal";
    modifiedAction = TravelAction;
    cost = new ResourceCost([[OathResource.Secret, 1]]);

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
        if (this.action.getting.get(OathResource.Favor) === 1)
            new TakeResourcesFromBankEffect(this.game, this.action.player, this.game.favorBanks.get(this.action.cardProxy.suit), 1).do();
    }
}

export class InitiationRite extends AccessedActionModifier<Denizen, MusterAction> {
    name = "Initiation Rite";
    modifiedAction = MusterAction;
    
    applyBefore(): void {
        this.action.using = OathResource.Secret;
    }
}

export class SealingWard extends EnemyAttackerCampaignModifier<Denizen> {
    name = "Sealing Ward";
    
    applyAfter(): void {
        for (const target of this.action.campaignResult.params.targets)
            if (target instanceof Relic && target.owner === this.sourceProxy.ruler?.original)
                this.action.campaignResult.params.defPool += 1;
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
            for (const region of Object.values(this.game.board.regions))
                this.action.selects.deck.choices.set(region.name, region.discard);
    }
}

export class MagiciansCode extends AccessedActionModifier<Denizen, RecoverBannerPitchAction> {
    name = "Magician's Code";
    modifiedAction = RecoverBannerPitchAction;  // Technically should be chosen at the time you recover, but this is way simpler
    cost = new ResourceCost([[OathResource.Favor, 2]]);

    canUse(): boolean {
        return super.canUse() && this.action.banner instanceof DarkestSecret;
    }

    applyAtStart(): void {
        const amounts = [this.action.banner.amount];
        if (this.action.banner.amount > 0) amounts.unshift(this.action.banner.amount - 1);
        for (const amount of amounts) this.action.selects.amount.choices.set(amount.toString(), amount);
    }
    
    applyBefore(): void {
        new PutResourcesOnTargetEffect(this.game, this.action.player, OathResource.Secret, 2).do();
        this.action.amount += 2;
    }
}

export class MapLibrary extends AccessedActionModifier<Denizen, TradeAction> {
    name = "Map Library";
    modifiedAction = TradeAction;
    
    applyAtStart(): void {
        if (this.action.playerProxy.site === this.sourceProxy.site)
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
            this.activator, "Act as if you have another player's advisers",
            (players: OathPlayer[]) => {
                if (!players[0]) return;
                this.action.playerProxy.advisers = new Set(players[0].advisers);
                this.action.doNext();  // Allow the player to choose other new modifiers
            }
        ).doNext();
        return false;
    }
}

export class WitchsBargain extends ActivePower<Denizen> {
    name = "Witch's Bargain";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        new ChoosePlayersAction(
            this.action.player, "Bargain with players at your site",
            (players: OathPlayer[]) => {
                for (const player of players) {
                    const maxSecrets = this.action.player.getResources(OathResource.Secret);
                    const maxFavors = Math.floor(this.action.player.getResources(OathResource.Favor) / 2);
                    
                    new ChooseNumberAction(
                        this.action.player, "Give favors to take secrets (positive), or vice versa (negative)", inclusiveRange(-maxSecrets, maxFavors),
                        (value: number) => {
                            let giftedResource = OathResource.Favor, takenResource = OathResource.Secret;
                            let giving = value * 2, taking = value;
                            if (value < 0) {
                                giftedResource = OathResource.Secret, takenResource = OathResource.Favor;
                                giving = -value, taking = -value * 2;
                            }
                            
                            if (new MoveResourcesToTargetEffect(this.game, this.action.player, giftedResource, giving, player).do() > 0)
                                new MoveResourcesToTargetEffect(this.game, this.action.player, takenResource, taking, this.action.player, player).do();
                        }
                    ).doNext();
                }
            },
            [Object.values(this.gameProxy.players).filter(e => e.site === this.action.playerProxy.site).map(e => e.original)],
            [[1, Infinity]]
        ).doNext();
    }
}

export class Bewitch extends WhenPlayed<Denizen> {
    name = "Bewitch";

    whenPlayed(): void {
        if (this.effect.playerProxy.getAllResources(OathResource.Secret) > this.gameProxy.chancellor.getResources(OathResource.Secret))
            new MakeDecisionAction(this.effect.player, "Become a Citizen?", () => new BecomeCitizenEffect(this.effect.player).do());
    }
}

export class Revelation extends WhenPlayed<Denizen> {
    name = "Revelation";

    whenPlayed(): void {
        for (const player of Object.values(this.game.players)) {
            new ChooseNumberAction(
                player, "Burn favor to gain secrets", inclusiveRange(player.getResources(OathResource.Favor)),
                (value: number) => {
                    new MoveResourcesToTargetEffect(this.game, player, OathResource.Favor, value, undefined).do();
                    new PutResourcesOnTargetEffect(this.game, player, OathResource.Secret, value).do();
                }
            ).doNext();
        }
    }
}

export class VowOfSilence extends AccessedEffectModifier<Denizen, MoveResourcesToTargetEffect> {
    name = "Vow of Silence";
    modifiedEffect = MoveResourcesToTargetEffect;

    applyAfter(): void {
        if (this.effect.resource === OathResource.Secret && this.effect.source === this.sourceProxy.ruler?.original)
            this.effect.amount = 0;
    }
}
export class VowOfSilenceRecover extends AccessedActionModifier<Denizen, RecoverAction> {
    name = "Vow of Silence";
    modifiedAction = RecoverAction;

    applyBefore(): void {
        if (this.action.targetProxy === this.gameProxy.banners.get(BannerName.DarkestSecret))
            throw new InvalidActionResolution("Cannot recover the Darkest Secret with the Vow of Silence");
    }
}
export class VowOfSilencePitch extends ActionModifier<Denizen, RecoverBannerPitchAction> {
    name = "Vow of Silence";
    modifiedAction = RecoverBannerPitchAction;

    applyAfter(): void {
        new PutResourcesOnTargetEffect(this.game, this.sourceProxy.ruler?.original, OathResource.Secret, this.action.amount).do();
    }
}

export class DreamThief extends ActivePower<Denizen> {
    name = "Dream Thief";
    cost = new ResourceCost([[OathResource.Favor, 2]]);

    usePower(): void {
        const cards = new Set<WorldCard>();
        for (const playerProxy of Object.values(this.gameProxy.players)) {
            if (playerProxy === this.action.playerProxy || playerProxy.site !== this.action.playerProxy.site) continue;
            for (const adviserProxy of playerProxy.advisers)
                if (adviserProxy.original.facedown && !(adviserProxy instanceof Denizen && adviserProxy.activelyLocked))
                    cards.add(adviserProxy.original);
        }

        new ChooseCardsAction(
            this.action.player, "Swap two facedown advisers", [cards], 
            (cards: WorldCard[]) => {
                if (cards.length < 2) return;
                const player1 = cards[0].owner as OathPlayer;
                const player2 = cards[1].owner as OathPlayer;
                new MoveWorldCardToAdvisersEffect(this.game, player2, cards[0]).do();
                new MoveWorldCardToAdvisersEffect(this.game, player1, cards[1]).do();
            },
            [[2]]
        ).doNext();
    }
}


export class GreatSpire extends AccessedActionModifier<Edifice, SearchAction> {
    name = "Great Spire";
    modifiedAction = SearchAction;
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyAtEnd(): void {
        const denizens = [...this.action.cards].filter(e => e instanceof Denizen);
        new ChooseCardsAction(
            this.action.player, "Swap cards with the Dispossessed", [denizens],
            (cards: Denizen[]) => {
                for (const card of cards) {
                    const newCard = new GetRandomCardFromDispossessed(this.game, this.action.player).do();
                    new PutDenizenIntoDispossessedEffect(this.game, this.action.player, card).do();
                    new PeekAtCardEffect(this.action.player, newCard).do();

                    // TODO: Put this in an effect
                    this.action.cards.delete(card);
                    this.action.cards.add(newCard);
                }
            },
            [[0, denizens.length]]
        ).doNext();
    }
}

export class FallenSpire extends ActivePower<Edifice> {
    name = "Fallen Spire";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Secret, 1]]);

    usePower(): void {
        const discard = this.action.playerProxy.site.region.discard.original;
        new ChooseNumberAction(
            this.action.player, "Swap cards from your region's discard with the Dispossessed", inclusiveRange(1, Math.min(discard.cards.length, 5)),
            (value: number) => {
                const discardOptions = new DiscardOptions(discard);
                let skip = 0;
                while (value > 0) {
                    const card = new DrawFromDeckEffect(this.action.player, discard, 1, false, skip).do()[0];
                    if (!card) break;
                    if (!(card instanceof Denizen)) {
                        new DiscardCardEffect(this.action.player, card, discardOptions).do();
                        skip++;
                        continue;
                    }
                    const newCard = new GetRandomCardFromDispossessed(this.game, this.action.player).do();
                    new PutDenizenIntoDispossessedEffect(this.game, this.action.player, card).do();
                    new DiscardCardEffect(this.action.player, newCard, discardOptions).do();
                    value--;
                }
            }
        )
    }
}