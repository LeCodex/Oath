import { TravelAction, InvalidActionResolution, CampaignAtttackAction, MakeDecisionAction, ChooseRegionAction, SearchPlayAction } from "../../actions/actions";
import { Region } from "../../board";
import { Denizen, Edifice, Site, VisionBack, WorldCard } from "../../cards/cards";
import { DiscardOptions } from "../../cards/decks";
import { PayCostToTargetEffect, TakeOwnableObjectEffect, PutResourcesOnTargetEffect, PayPowerCost, BecomeCitizenEffect, GiveOwnableObjectEffect, DrawFromDeckEffect, FlipEdificeEffect, MoveResourcesToTargetEffect, DiscardCardEffect } from "../../effects";
import { BannerName, OathResource, OathSuit } from "../../enums";
import { OwnableObject, isOwnable } from "../../interfaces";
import { OathPlayer } from "../../player";
import { ResourceCost } from "../../resources";
import { ActionModifier, EnemyEffectModifier, EnemyActionModifier, ActivePower, CapacityModifier, AttackerBattlePlan, DefenderBattlePlan, WhenPlayed } from "../powers";


export class HorseArchersAttack extends AttackerBattlePlan<Denizen> {
    name = "Horse Archers";

    applyBefore(): void {
        this.action.campaignResult.atkPool += 3;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}
export class HorseArchersDefense extends DefenderBattlePlan<Denizen> {
    name = "Horse Archers";

    applyBefore(): void {
        this.action.campaignResult.atkPool -= 3;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class RivalKhanAttack extends AttackerBattlePlan<Denizen> {
    name = "Rival Khan";

    applyBefore(): void {
        if (this.action.campaignResult.defender?.suitAdviserCount(OathSuit.Nomad)) this.action.campaignResult.atkPool += 4;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}
export class RivalKhanDefense extends DefenderBattlePlan<Denizen> {
    name = "Rival Khan";

    applyBefore(): void {
        if (this.action.campaignResult.attacker?.suitAdviserCount(OathSuit.Nomad)) this.action.campaignResult.atkPool -= 4;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class GreatCrusadeAttack extends AttackerBattlePlan<Denizen> {
    name = "Great Crusade";

    applyBefore(): void {
        this.action.campaignResult.atkPool += this.activator.suitRuledCount(OathSuit.Nomad);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}
export class GreatCrusadeDefense extends DefenderBattlePlan<Denizen> {
    name = "Great Crusade";

    applyBefore(): void {
        this.action.campaignResult.atkPool -= this.activator.suitRuledCount(OathSuit.Nomad);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class MountainGiantAttack extends AttackerBattlePlan<Denizen> {
    name = "Mountain Giant";
    cost = new ResourceCost([[OathResource.Secret, 1]]);

    applyBefore(): void {
        new MakeDecisionAction(this.activator, "±1, or ±3 and discard at end?", () => {
            this.action.campaignResult.atkPool++;
        }, () => {
            this.action.campaignResult.atkPool += 3;
            this.action.campaignResult.discardAtEnd(this.source);
        }, ["±1", "±3"]);
    }
}
export class MountainGiantDefense extends DefenderBattlePlan<Denizen> {
    name = "Mountain Giant";

    applyBefore(): void {
        new MakeDecisionAction(this.activator, "±1, or ±3 and discard at end?", () => {
            this.action.campaignResult.atkPool--;
        }, () => {
            this.action.campaignResult.atkPool -= 3;
            this.action.campaignResult.discardAtEnd(this.source);
        }, ["±1", "±3"]);
    }
}

export class StormCaller extends DefenderBattlePlan<Denizen> {
    name = "Storm Caller";

    applyBefore(): void {
        this.action.campaignResult.defPool += 2;
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class MountedPatrol extends DefenderBattlePlan<Denizen> {
    name = "Mounted Patrol";

    applyBefore(): void {
        this.action.campaignResult.atkPool = Math.floor(this.action.campaignResult.atkPool / 2);
        this.action.campaignResult.discardAtEnd(this.source);
    }
}

export class WayStation extends ActionModifier<Denizen> {
    name = "Way Station";
    modifiedAction = TravelAction;
    action: TravelAction;

    applyBefore(): void {
        if (!this.sourceProxy.site) return;
        if (this.action.siteProxy === this.sourceProxy.site) {
            if (!this.activatorProxy.rules(this.sourceProxy)) return;
            if (!new PayCostToTargetEffect(this.action.game, this.activator, new ResourceCost([[OathResource.Favor, 1]]), this.sourceProxy.ruler?.original).do()) return;
            this.action.noSupplyCost = true;
        }
    }
}

function lostTongueCheckOwnable(sourceProxy: Denizen, targetProxy: OwnableObject, playerProxy: OathPlayer | undefined) {
    if (!sourceProxy.ruler) return;
    if (!playerProxy) return;
    if (targetProxy.owner !== sourceProxy.ruler) return;

    if (playerProxy.suitRuledCount(OathSuit.Nomad) < 1)
        throw new InvalidActionResolution(`Cannot target or take objects from ${sourceProxy.ruler.name} without understanding the Lost Tongue.`);
}
export class LostTongue extends EnemyEffectModifier<Denizen> {
    name = "Lost Tongue";
    modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect;

    applyBefore(): void {
        const targetProxy = this.effect.maskProxyManager.get(this.effect.target);
        lostTongueCheckOwnable(this.sourceProxy, targetProxy, this.effect.playerProxy);
    }
}
export class LostTongueCampaign extends EnemyActionModifier<Denizen> {
    name = "Lost Tongue";
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (isOwnable(target)) {
                const targetProxy = this.action.maskProxyManager.get(target);
                lostTongueCheckOwnable(this.sourceProxy, targetProxy, this.activatorProxy);
            }
        }
    }
}

export class Elders extends ActivePower<Denizen> {
    name = "Elders";
    cost = new ResourceCost([[OathResource.Favor, 2]]);

    usePower(): void {
        new PutResourcesOnTargetEffect(this.action.game, this.action.player, OathResource.Secret, 1).do();
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
                for (const card of new DrawFromDeckEffect(this.action.player, region.discard, Infinity, true).do())
                    new DiscardCardEffect(this.action.player, card, new DiscardOptions(this.action.playerProxy.site.region.discard.original)).do();
            }
        )
    }
}

export class Oracle extends ActivePower<Denizen> {
    name = "Oracle";
    cost = new ResourceCost([[OathResource.Secret, 2]]);

    usePower(): void {
        for (const [index, card] of this.game.worldDeck.cards.entries()) {
            if (card instanceof VisionBack) {
                const vision = new DrawFromDeckEffect(this.action.player, this.game.worldDeck, 1, false, index).do()[0];
                new SearchPlayAction(this.action.player, vision).doNext();
            }
        }
    }
}

export class SpellBreaker extends EnemyEffectModifier<Denizen> {
    name = "Spell Breaker";
    modifiedEffect = PayPowerCost;
    effect: PayPowerCost;

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
            // TODO: Take a Reliquary relic
            new GiveOwnableObjectEffect(this.game, this.game.chancellor, darkestSecretProxy.original).do();
            new BecomeCitizenEffect(this.effect.player).do();
        });
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
        );
    }
}

export class BrokenForge extends ActivePower<Edifice> {
    name = "Broken Forge";
    cost = new ResourceCost([[OathResource.Favor, 2], [OathResource.Secret, 2]]);

    usePower(): void {
        new FlipEdificeEffect(this.source).do();
    }
}