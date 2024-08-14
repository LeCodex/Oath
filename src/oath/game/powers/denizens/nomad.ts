import { TravelAction, InvalidActionResolution, CampaignAtttackAction, AskForPermissionAction } from "../../actions/actions";
import { Denizen, Site, WorldCard } from "../../cards/cards";
import { PayCostToTargetEffect, TakeOwnableObjectEffect, PutResourcesOnTargetEffect, PayPowerCost, BecomeCitizenEffect, GiveOwnableObjectEffect } from "../../effects";
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

        new AskForPermissionAction(this.effect.player, "Give Darkest Secret to become a Citizen?", () => {
            // TODO: Take a Reliquary relic
            new GiveOwnableObjectEffect(this.game, this.game.chancellor, darkestSecretProxy.original).do();
            new BecomeCitizenEffect(this.effect.player).do();
        });
    }
}