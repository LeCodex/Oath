import { TakeFavorFromBankAction, TakeResourceFromPlayerAction } from "../../actions/actions";
import { Denizen, Relic, Site, WorldCard } from "../../cards/cards";
import { DefenseDie } from "../../dice";
import { TakeOwnableObjectEffect, TakeWarbandsIntoBagEffect, PutWarbandsFromBagEffect, PutResourcesOnTargetEffect, MoveResourcesToTargetEffect, SetNewOathkeeperEffect, RollDiceEffect, GamblingHallEffect } from "../../effects";
import { OathResource, OathSuit } from "../../enums";
import { OathPlayer } from "../../player";
import { ResourceCost } from "../../resources";
import { EnemyEffectModifier, WhenPlayed, CapacityModifier, ActivePower, RestPower } from "../powers";


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

        new PutWarbandsFromBagEffect(this.effect.player, 1, this.source.site).do();
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
        new PutResourcesOnTargetEffect(this.action.game, this.action.player, OathResource.Secret, 1).do();
    }
}

export class SilverTongue extends RestPower<Denizen> {
    name = "Silver Tongue";

    applyAfter(): void {
        const suits: Set<OathSuit> = new Set();
        for (const denizenProxy of this.action.playerProxy.site.denizens) suits.add(denizenProxy.suit);
        new TakeFavorFromBankAction(this.action.player, 1, suits).doNext();
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
            new MoveResourcesToTargetEffect(this.action.game, this.action.player, OathResource.Favor, 1, this.action.player, this.action.game.chancellor).do();
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
