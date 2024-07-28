import { PlayerColor } from "../enums";
import { OathGame } from "../game";
import { OathGameObject } from "../gameObject";
import { OathPlayer } from "../player";
import { getCopyWithOriginal } from "../utils";
import { ResolveEffectAction } from "./resolution";
import { EffectModifier } from "./modifiers";


export abstract class OathEffect<T> extends OathGameObject {
    readonly playerColor: PlayerColor | undefined;
    modifiers: EffectModifier<any>[] = [];

    constructor(game: OathGame, player: OathPlayer | undefined, dontCopyGame: boolean = false) {
        super(dontCopyGame ? game : getCopyWithOriginal(game.original));
        this.playerColor = player?.color;
    }

    get player() { return this.playerColor !== undefined ? this.game.players[this.playerColor] : undefined; }

    doNext() {
        new ResolveEffectAction(this.player || this.game.currentPlayer, this).doNext();
    }

    do(): T {
        this.applyModifiers();

        // Whenever we resolve an effect, we add it to the stack
        this.game.actionManager.currentEffectsStack.push(this);
        let result = this.resolve();
        this.afterResolution(result);

        return result;
    }

    applyModifiers() {
        for (const [source, modifier] of this.game.getPowers((EffectModifier<any>))) {
            const instance = new modifier(source, this);
            if (this instanceof instance.modifiedEffect && instance.canUse()) { // All Effect Modifiers are must-use
                this.modifiers.push(instance);
                instance.applyDuring();
            }
        };
    }

    abstract resolve(): T;

    afterResolution(result: T) {
        for (const modifier of this.modifiers) modifier.applyAfter(result);
    };

    abstract revert(): void;
}

export abstract class PlayerEffect<T> extends OathEffect<T> {
    readonly playerColor: PlayerColor;

    constructor(player: OathPlayer, dontCopyGame: boolean = false) {
        super(player.game, player, dontCopyGame);
    }

    get player() { return this.game.players[this.playerColor]; }
}
