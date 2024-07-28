import { OwnableCard } from "../cards/base";
import { OathGameObject } from "../gameObject";
import { OathPower } from "../powers/base";
import { AbstractConstructor } from "../utils";
import { OathEffect } from "./base";


export abstract class EffectModifier<T extends OathGameObject> extends OathPower<T> {
    modifiedEffect: AbstractConstructor<OathEffect<any>>;
    effect: OathEffect<any>;

    constructor(source: T, effect: OathEffect<any>) {
        super(source);
        this.effect = effect;
    }

    canUse(): boolean {
        return true;
    }

    applyDuring(): void { } // Applied right before the resolution of the effect
    applyAfter(result: any): void { } // Applied after the resolution of the effect
}

export abstract class EnemyEffectModifier<T extends OwnableCard> extends EffectModifier<T> {
    mustUse = true;

    canUse(): boolean {
        return this.source.ruler === undefined || this.source.ruler.enemyWith(this.effect.player);
    }
}

export abstract class AccessedEffectModifier<T extends OwnableCard> extends EffectModifier<T> {
    canUse(): boolean {
        return !!this.effect.player && this.source.accessibleBy(this.effect.player);
    }
}
