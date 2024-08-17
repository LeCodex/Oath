import { SearchAction, CampaignAttackAction, CampaignDefenseAction, TradeAction, TakeFavorFromBankAction, InvalidActionResolution, ActAsIfAtSiteAction, MakeDecisionAction, CampaignAction, ChoosePlayersAction, ChooseCardsAction, ChooseSuitsAction, KillWarbandsOnTargetAction } from "../../actions/actions";
import { Denizen, GrandScepter, Relic, Site } from "../../cards/cards";
import { BecomeCitizenEffect, DrawFromDeckEffect, MoveAdviserEffect, MoveBankResourcesEffect, MoveResourcesToTargetEffect, MoveWorldCardToAdvisersEffect, PutWarbandsFromBagEffect, RegionDiscardEffect, TakeOwnableObjectEffect, TakeWarbandsIntoBagEffect } from "../../effects";
import { OathResource, OathSuit } from "../../enums";
import { OathPlayer } from "../../player";
import { ResourceCost } from "../../resources";
import { AccessedActionModifier, ActionModifier, AttackerBattlePlan, DefenderBattlePlan, WhenPlayed, RestPower, ActivePower } from "../powers";


export class NatureWorshipAttack extends AttackerBattlePlan<Denizen> {
    name = "Nature Worship";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool += this.activator.suitAdviserCount(OathSuit.Beast);
    }
}
export class NatureWorshipDefense extends DefenderBattlePlan<Denizen> {
    name = "Nature Worship";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool -= this.activator.suitAdviserCount(OathSuit.Beast);
    }
}

export class Rangers extends AttackerBattlePlan<Denizen> {
    name = "Rangers";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.ignoreSkulls = true;
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

export class Bracken extends AccessedActionModifier<Denizen> {
    name = "Bracken";
    modifiedAction = SearchAction;
    action: SearchAction;

    applyBefore(): void {
        // TODO: Action to change the discard options
    }
}

export class InsectSwarmAttack extends ActionModifier<Denizen> {
    name = "Insect Swarm";
    modifiedAction = CampaignAttackAction;
    action: CampaignAttackAction;
    mustUse = true;

    canUse(): boolean {
        return this.action.campaignResult.defender === this.sourceProxy.ruler?.original;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        for (const modifier of modifiers)
            if (modifier instanceof AttackerBattlePlan)
                modifier.cost.add(new ResourceCost([], [[OathResource.Favor, 1]]));

        return [];
    }
}
export class InsectSwarmDefense extends ActionModifier<Denizen> {
    name = "Insect Swarm";
    modifiedAction = CampaignDefenseAction;
    action: CampaignDefenseAction;
    mustUse = true;

    canUse(): boolean {
        return this.action.campaignResult.attacker === this.sourceProxy.ruler?.original;
    }

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
        for (const modifier of modifiers)
            if (modifier instanceof DefenderBattlePlan)
                modifier.cost.add(new ResourceCost([], [[OathResource.Favor, 1]]));

        return [];
    }
}

export class ThreateningRoar extends WhenPlayed<Denizen> {
    name = "Threatening Roar";

    whenPlayed(): void {
        new RegionDiscardEffect(this.effect.player, [OathSuit.Beast, OathSuit.Nomad], this.source).do();
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

        new PutWarbandsFromBagEffect(this.effect.playerProxy.leader.original, amount, this.effect.player).do();
    }
}

export class VowOfPoverty extends AccessedActionModifier<Denizen> {
    name = "Vow of Poverty";
    modifiedAction = TradeAction;
    action: TradeAction;
    mustUse = true;

    applyBefore(): void {
        this.action.getting.set(OathResource.Favor, -Infinity);
    }
}
export class VowOfPovertyRest extends RestPower<Denizen> {
    name = "Vow of Poverty";

    applyAfter(): void {
        if (this.activatorProxy.getResources(OathResource.Favor) === 0)
            new TakeFavorFromBankAction(this.activator, 2).doNext();
    }
}

export class PiedPiper extends ActivePower<Denizen> {
    name = "Pied Piper";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        new ChoosePlayersAction(
            this.action.player, "Send the Pied Piper to steal 2 favor",
            (targets: OathPlayer[]) => {
                if (!targets.length) return;
                new MoveResourcesToTargetEffect(this.game, this.action.player, OathResource.Favor, 2, this.action.player, targets[0]).do();
                const adviser = new MoveAdviserEffect(this.game, this.action.player, this.source).do();
                new MoveWorldCardToAdvisersEffect(this.game, this.action.player, adviser, targets[0]).do();
            }
        ).doNext();
    }
}

export class SmallFriends extends AccessedActionModifier<Denizen> {
    name = "Small Friends";
    modifiedAction = TradeAction;
    action: TradeAction;

    applyImmediately(modifiers: Iterable<ActionModifier<any>>): Iterable<ActionModifier<any>> {
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

export class LongLostHeir extends WhenPlayed<Denizen> {
    name = "Long-Lost Heir";

    whenPlayed(): void {
        new MakeDecisionAction(this.effect.player, "Become a Citizen?", () => new BecomeCitizenEffect(this.effect.player).doNext());
    }
}

export class WildAllies extends ActivePower<Denizen> {
    name = "Wild Allies";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        const campaignAction = new CampaignAction(this.action.player);
        campaignAction._noSupplyCost = true;

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
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        new ChoosePlayersAction(
            this.action.player, "Kill a warband",
            (targets: OathPlayer[]) => { if (targets.length) new KillWarbandsOnTargetAction(this.action.player, targets[0], 1).doNext(); },
            [Object.values(this.game.players)]
        ).doNext();
    }
}

export class FaeMerchant extends ActivePower<Denizen> {
    name = "Fae Merchant";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        const relic = new DrawFromDeckEffect(this.action.player, this.game.relicDeck, 1).do()[0];
        if (!relic) return;
        
        new TakeOwnableObjectEffect(this.game, this.action.player, relic).do();
        new ChooseCardsAction(
            this.action.player, "Discard a relic", [[...this.action.playerProxy.relics].filter(e => !(e instanceof GrandScepter)).map(e => e.original)],
            (cards: Relic[]) => { if (cards.length) cards[0].putOnBottom(this.action.player); }
        ).doNext();
    }
}

export class SecondChance extends ActivePower<Denizen> {
    name = "SecondChance";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    usePower(): void {
        const players = new Set<OathPlayer>();
        for (const playerProxy of Object.values(this.gameProxy.players)) {
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
                if (!targets.length) return;
                new KillWarbandsOnTargetAction(this.action.player, targets[0], 1).doNext();
                new PutWarbandsFromBagEffect(this.action.playerProxy.leader.original, 1, this.action.player).do();
            },
            [players]
        ).doNext();
    }
}

export class MemoryOfNature extends ActivePower<Denizen> {
    name = "Memory Of Nature";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

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
                if (!suits.length) return;
                const from = this.game.favorBanks.get(suits[0]);
                const to = this.game.favorBanks.get(OathSuit.Beast);
                if (!from || !to) return;
                new MoveBankResourcesEffect(this.game, this.action.player, from, to, amount).do();
                if (--amount) this.moveFavor(amount);
            }
        ).doNext();
    }
}
