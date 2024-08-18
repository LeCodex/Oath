import { CampaignAttackAction, CampaignDefenseAction, TakeFavorFromBankAction, TradeAction, TravelAction, InvalidActionResolution, MakeDecisionAction, RestAction, ChooseCardsAction, SearchPlayOrDiscardAction, ChoosePlayersAction, ChooseSitesAction, ChooseNumberAction, SearchAction, SearchChooseAction, KillWarbandsOnTargetAction } from "../../actions/actions";
import { Conspiracy, Denizen, Edifice, Site, WorldCard } from "../../cards/cards";
import { DiscardOptions } from "../../cards/decks";
import { AttackDie, DefenseDie } from "../../dice";
import { RegionDiscardEffect, PutResourcesOnTargetEffect, RollDiceEffect, BecomeCitizenEffect, DiscardCardEffect, TakeResourcesFromBankEffect, PeekAtCardEffect, MoveAdviserEffect, MoveResourcesToTargetEffect, TakeWarbandsIntoBagEffect, PutResourcesIntoBankEffect, DrawFromDeckEffect, PutDenizenIntoDispossessedEffect, GetRandomCardFromDispossessed } from "../../effects";
import { BannerName, OathResource, OathSuit } from "../../enums";
import { OathPlayer } from "../../player";
import { ResourceCost } from "../../resources";
import { ActionModifier, AttackerBattlePlan, DefenderBattlePlan, ActivePower, WhenPlayed, AccessedActionModifier, EffectModifier } from "../powers";
import { inclusiveRange } from "../../utils";
import { min } from "lodash";


export class FireTalkersAttack extends AttackerBattlePlan<Denizen> {
    name = "Fire Talkers";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerName.DarkestSecret);
        if (darkestSecretProxy?.owner !== this.activatorProxy) return;
        this.action.campaignResult.atkPool += 3;
    }
}
export class FireTalkersDefense extends DefenderBattlePlan<Denizen> {
    name = "Fire Talkers";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        const darkestSecretProxy = this.gameProxy.banners.get(BannerName.DarkestSecret);
        if (darkestSecretProxy?.owner !== this.activatorProxy) return;
        this.action.campaignResult.atkPool -= 3;
    }
}

export class BillowingFogAttack extends AttackerBattlePlan<Denizen> {
    name = "Billowing Fog";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.attackerKillsNoWarbands = true;
    }
}
export class BillowingFogDefense extends DefenderBattlePlan<Denizen> {
    name = "Billowing Fog";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.defenderKillsNoWarbands = true;
    }
}

export class KindredWarriorsAttack extends AttackerBattlePlan<Denizen> {
    name = "Kindred Warriors";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.ignoreSkulls = true;
        this.action.campaignResult.atkPool += (this.activator.ruledSuits - 1);
    }
}
export class KindredWarriorsDefense extends DefenderBattlePlan<Denizen> {
    name = "Kindred Warriors";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool -= (this.activator.ruledSuits - 1);
    }
}

export class CrackingGroundAttack extends AttackerBattlePlan<Denizen> {
    name = "Cracking Ground";
    cost = new ResourceCost([], [[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool += [...this.action.campaignResult.targets].filter(e => e instanceof Site).length;
    }
}
export class CrackingGroundDefense extends DefenderBattlePlan<Denizen> {
    name = "Cracking Ground";
    cost = new ResourceCost([], [[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool -= [...this.action.campaignResult.targets].filter(e => e instanceof Site).length;
    }
}

export class GleamingArmorAttack extends ActionModifier<Denizen> {
    name = "Gleaming Armor";
    modifiedAction = CampaignAttackAction;
    action: CampaignAttackAction;
    mustUse = true;

    canUse(): boolean {
        return this.action.campaignResult.defender === this.sourceProxy.ruler?.original;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        for (const modifier of modifiers)
            if (modifier instanceof AttackerBattlePlan)
                modifier.cost.add(new ResourceCost([[OathResource.Secret, 1]]));

        return [];
    }
}
export class GleamingArmorDefense extends ActionModifier<Denizen> {
    name = "Gleaming Armor";
    modifiedAction = CampaignDefenseAction;
    action: CampaignDefenseAction;
    mustUse = true;

    canUse(): boolean {
        return this.action.campaignResult.attacker === this.sourceProxy.ruler?.original;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
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
        new PutResourcesOnTargetEffect(this.action.game, this.action.player, OathResource.Secret, 1).do();
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

export class ActingTroupe extends AccessedActionModifier<Denizen> {
    name = "Acting Troupe";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyBefore(): void {
        if (this.action.cardProxy.suit === OathSuit.Order || this.action.cardProxy.suit === OathSuit.Beast)
            this.sourceProxy.suit = this.action.cardProxy.suit;
    }
}

export class Jinx extends EffectModifier<Denizen> {
    name = "Jinx";
    modifiedEffect = RollDiceEffect;
    effect: RollDiceEffect;
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    canUse(): boolean {
        return !!this.effect.playerProxy && this.effect.playerProxy.rules(this.sourceProxy) && !(!this.sourceProxy.empty && this.gameProxy.currentPlayer === this.effect.playerProxy);
    }

    applyAfter(result: number[]): void {
        const player = this.effect.player;
        if (!player) return;
        if (this.effect.die !== AttackDie || this.effect.die !== DefenseDie) return;

        new MakeDecisionAction(player, "Reroll " + result.join(",") + "?", () => {
            if (!this.payCost(player)) return;
            for (const [i, face] of this.effect.die.roll(result.length).entries()) result[i] = face;
        }).doNext();
    }
}

export class Portal extends AccessedActionModifier<Denizen> {
    name = "Portal";
    modifiedAction = TravelAction;
    action: TravelAction;
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        return [...modifiers].filter(e => e.source instanceof Site);
    }

    applyBefore(): void {
        if (this.activatorProxy.site !== this.sourceProxy.site && this.action.siteProxy !== this.sourceProxy.site)
            throw new InvalidActionResolution("When using the Portal, you must travel to or from its site");

        this.action.noSupplyCost = true;
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


export class GreatSpire extends AccessedActionModifier<Edifice> {
    name = "Great Spire";
    modifiedAction = SearchAction;
    action: SearchAction;
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyAtEnd(): void {
        const denizens = [...this.action.cards].filter(e => e instanceof Denizen);
        new ChooseCardsAction(
            this.action.player, "Swap cards with the Dispossessed", [denizens],
            (cards: Denizen[]) => {
                for (const card of cards) {
                    const newCard = new GetRandomCardFromDispossessed(this.game, this.action.player).do();
                    new PutDenizenIntoDispossessedEffect(this.game, this.action.player, card).do();

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