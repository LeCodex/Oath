import { OathAction } from "../actions/base";
import { UsePowerAction } from "../actions/minor";
import { OwnableCard, WorldCard } from "../cards/base";
import { Site } from "../cards/sites";
import { ResourceCost } from "../resources";
import { PayPowerCost, PlayWorldCardEffect } from "../effects/basic";
import { OathPlayer } from "../player";
import { OathGameObject } from "../gameObject";


//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export abstract class OathPower<T extends OathGameObject> extends OathGameObject {
    abstract name: string;
    source: T;
    cost: ResourceCost = new ResourceCost();

    constructor(source: T) {
        super(source.game);
        this.source = source;
    }

    payCost(player: OathPlayer): boolean {
        return new PayPowerCost(player, this).do();
    }
}

export abstract class WhenPlayed<T extends WorldCard> extends OathPower<T> {
    modifiedEffect = PlayWorldCardEffect;

    abstract whenPlayed(effect: PlayWorldCardEffect): void;
}

export abstract class CapacityModifier<T extends WorldCard> extends OathPower<T> {
    canUse(player: OathPlayer, site?: Site): boolean {
        return true;
    }
    
    // Updates the information to calculate capacity in the group the source is in/being played to
    // First return is the update to capacity (min of all values), second is a set of cards that don't count towards capacity
    updateCapacityInformation(source: Set<WorldCard>): [number, Iterable<WorldCard>] { return [Infinity, []]; }

    ignoreCapacity(card: WorldCard, facedown: boolean = card.facedown): boolean { return false; }
}

export abstract class ActionPower<T extends OathGameObject> extends OathPower<T> {
    action: OathAction;

    constructor(source: T, action: OathAction) {
        super(source);
        this.action = action;
    }

    abstract canUse(): boolean;
}

export abstract class ActivePower<T extends OwnableCard> extends ActionPower<T> {
    action: UsePowerAction;

    canUse(): boolean {
        return this.source.accessibleBy(this.action.player) && this.source.empty;
    }

    abstract usePower(action: UsePowerAction): void;
}
