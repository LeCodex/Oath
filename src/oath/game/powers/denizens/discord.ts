import { AskForPermissionAction, TakeFavorFromBankAction, TakeResourceFromPlayerAction } from "../../actions/actions";
import { Denizen, Relic, Site, WorldCard } from "../../cards/cards";
import { D6, DefenseDie } from "../../dice";
import { TakeOwnableObjectEffect, TakeWarbandsIntoBagEffect, PutWarbandsFromBagEffect, PutResourcesOnTargetEffect, MoveResourcesToTargetEffect, SetNewOathkeeperEffect, RollDiceEffect, GamblingHallEffect, TakeResourcesFromBankEffect, DiscardCardEffect, BecomeCitizenEffect } from "../../effects";
import { BannerName, OathResource, OathSuit } from "../../enums";
import { OathPlayer } from "../../player";
import { ResourceCost } from "../../resources";
import { EnemyEffectModifier, WhenPlayed, CapacityModifier, ActivePower, RestPower, AttackerBattlePlan, DefenderBattlePlan, EffectModifier } from "../powers";


export class MercenariesAttack extends AttackerBattlePlan<Denizen> {
    name = "Mercenaries";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool += 3;
        this.action.campaignResult.onSuccessful(false, () => new DiscardCardEffect(this.activator, this.source).do());
    }
}
export class MercenariesDefense extends DefenderBattlePlan<Denizen> {
    name = "Mercenaries";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.atkPool -= 3;
        this.action.campaignResult.onSuccessful(true, () => new DiscardCardEffect(this.activator, this.source).do());
    }
}

export class CrackedSageAttack extends AttackerBattlePlan<Denizen> {
    name = "Disgraced Captain";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Favor, 1]]);

    applyBefore(): void {
        if (!this.action.campaignResult.defender) return;
        for (const adviser of this.action.campaignResult.defender.advisers) {
            if (!(adviser instanceof Denizen) || adviser.suit !== OathSuit.Arcane) continue;
            this.action.campaignResult.atkPool += 4;
            break;
        }
    }
}
export class CrackedSageDefense extends DefenderBattlePlan<Denizen> {
    name = "Disgraced Captain";
    cost = new ResourceCost([[OathResource.Secret, 1]], [[OathResource.Favor, 1]]);

    applyBefore(): void {
        for (const adviser of this.action.campaignResult.attacker.advisers) {
            if (!(adviser instanceof Denizen) || adviser.suit !== OathSuit.Arcane) continue;
            this.action.campaignResult.atkPool -= 4;
            break;
        }
    }
}

export class DisgracedCaptain extends AttackerBattlePlan<Denizen> {
    name = "Disgraced Captain";
    cost = new ResourceCost([[OathResource.Favor, 1]], [[OathResource.Favor, 1]]);

    applyBefore(): void {
        for (const target of this.action.campaignResult.targets) {
            if (!(target instanceof Site)) continue;
            for (const denizenProxy of this.action.maskProxyManager.get(target).denizens) {
                if (denizenProxy.suit !== OathSuit.Order) continue;
                this.action.campaignResult.atkPool += 4;
                break;
            }
        }
    }
}

export class BookBurning extends AttackerBattlePlan<Denizen> {
    name = "Book Burning";

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, () => {
            const defender = this.action.campaignResult.loser;
            if (!defender) return;
            new MoveResourcesToTargetEffect(this.game, defender, OathResource.Secret, defender.getResources(OathResource.Secret) - 1, undefined).do()
        });
    }
}

export class Slander extends AttackerBattlePlan<Denizen> {
    name = "Slander";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    applyBefore(): void {
        this.action.campaignResult.onSuccessful(true, () => {
            const defender = this.action.campaignResult.loser;
            if (!defender) return;
            new MoveResourcesToTargetEffect(this.game, defender, OathResource.Favor, Infinity, undefined).do()
        });
    }
}

export class RelicThief extends EnemyEffectModifier<Denizen> {
    name = "Relic Thief";
    modifiedEffect = TakeOwnableObjectEffect;
    effect: TakeOwnableObjectEffect;

    applyAfter(result: void): void {
        if (!this.sourceProxy.ruler?.original) return;
        if (this.effect.target instanceof Relic && this.effect.playerProxy?.site.region === this.sourceProxy.ruler?.site.region) {
            // Roll dice and do stuff, probably after an action to pay the cost
        }
    }
}

export class KeyToTheCity extends WhenPlayed<Denizen> {
    name = "Key to the City";

    whenPlayed(): void {
        if (!this.source.site || !this.sourceProxy.site) return;
        if (this.sourceProxy.site.ruler?.site === this.sourceProxy.site) return;

        for (const [player, amount] of this.source.site.warbands)
            new TakeWarbandsIntoBagEffect(player, amount, this.source.site).do();

        new PutWarbandsFromBagEffect(this.effect.player.leader, 1, this.source.site).do();
    }
}

export class OnlyTwoAdvisers extends CapacityModifier<Denizen> {
    name = "Only Two Advisers";

    canUse(player: OathPlayer, site?: Site): boolean {
        return player === this.source.ruler && !site;
    }

    updateCapacityInformation(targetProxy: Set<WorldCard>): [number, Iterable<WorldCard>] {
        return [2, []];
    }
}

export class Assassin extends ActivePower<Denizen> {
    name = "Assassin";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        // Action to choose a player to discard from
    }
}

export class Insomnia extends RestPower<Denizen> {
    name = "Insomnia";

    applyAfter(): void {
        new PutResourcesOnTargetEffect(this.action.game, this.activator, OathResource.Secret, 1).do();
    }
}

export class SilverTongue extends RestPower<Denizen> {
    name = "Silver Tongue";

    applyAfter(): void {
        const suits: Set<OathSuit> = new Set();
        for (const denizenProxy of this.activatorProxy.site.denizens) suits.add(denizenProxy.suit);
        new TakeFavorFromBankAction(this.activator, 1, suits).doNext();
    }
}

export class SleightOfHand extends ActivePower<Denizen> {
    name = "Sleight of Hand";
    cost = new ResourceCost([[OathResource.Favor, 1]]);

    usePower(): void {
        const players = Object.values(this.gameProxy.players).filter(e => e.site === this.action.playerProxy.site).map(e => e.original);
        new TakeResourceFromPlayerAction(this.action.player, OathResource.Secret, 1, players).doNext();
    }
}

export class Naysayers extends RestPower<Denizen> {
    name = "Naysayers";

    applyAfter(): void {
        if (!this.action.game.oathkeeper.isImperial)
            new MoveResourcesToTargetEffect(this.action.game, this.activator, OathResource.Favor, 1, this.activator, this.action.game.chancellor).do();
    }
}

export class ChaosCult extends EnemyEffectModifier<Denizen> {
    name = "Chaos Cult";
    modifiedEffect = SetNewOathkeeperEffect;
    effect: SetNewOathkeeperEffect;

    applyAfter(result: void): void {
        new MoveResourcesToTargetEffect(this.effect.game, this.source.ruler, OathResource.Favor, 1, this.source.ruler, this.effect.player).do();
    }
}

export class GamblingHall extends ActivePower<Denizen> {
    name = "Gambling Hall";
    cost = new ResourceCost([[OathResource.Favor, 2]]);

    usePower(): void {
        const faces = new RollDiceEffect(this.action.game, this.action.player, DefenseDie, 4).do();
        new GamblingHallEffect(this.action.player, faces).doNext();
    }
}

export class Charlatan extends WhenPlayed<Denizen> {
    name = "Charlatan";

    whenPlayed(): void {
        new TakeResourcesFromBankEffect(this.game, this.effect.player, this.game.banners.get(BannerName.DarkestSecret), Infinity, undefined);
    }
}

export class Dissent extends WhenPlayed<Denizen> {
    name = "Dissent";

    whenPlayed(): void {
        const peoplesFavorProxy = this.gameProxy.banners.get(BannerName.PeoplesFavor);
        for (const playerProxy of Object.values(this.gameProxy.players))
            if (peoplesFavorProxy?.owner !== playerProxy)
                new MoveResourcesToTargetEffect(this.game, playerProxy.original, OathResource.Favor, playerProxy.ruledSuits, this.source);
    }
}

export class ASmallFavor extends WhenPlayed<Denizen> {
    name = "ASmallFavor";

    whenPlayed(): void {
        new PutWarbandsFromBagEffect(this.effect.player.leader, 4).do();
    }
}

export class RoyalAmbitions extends WhenPlayed<Denizen> {
    name = "Royal Ambitions";

    whenPlayed(): void {
        if (this.effect.playerProxy.ruledSites > this.gameProxy.chancellor.ruledSites)
            new AskForPermissionAction(this.effect.player, "Become a Citizen?", () => {
                // TODO: Take a reliquary relic
                new BecomeCitizenEffect(this.effect.player).do(); 
            });
    }
}


export class SqualidDistrict extends EffectModifier<Denizen> {
    name = "Squalid District";
    modifiedEffect = RollDiceEffect;
    effect: RollDiceEffect;

    canUse(): boolean {
        return !!this.effect.playerProxy && this.effect.playerProxy === this.sourceProxy.ruler;
    }

    applyAfter(result: number[]): void {
        const player = this.effect.player;
        if (!player) return;
        if (this.effect.die !== D6) return;

        new AskForPermissionAction(player, "Add +1 or -1 to " + result[0] + "?", () => result[0]++, () => result[0]--, ["+1", "-1"]).doNext();
    }
}