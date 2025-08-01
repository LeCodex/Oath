import type { OathGame } from "../model/game";
import type { OathPlayer } from "../model/player";
import { MaskProxyManager } from "../utils";
import type { OathActionManager } from "./manager";
import type { SelectNOf } from "./selects";
import { InvalidActionResolution } from "./utils";


//////////////////////////////////////////////////
//                   ACTIONS                    //
//////////////////////////////////////////////////
type SelectType<T> = T extends SelectNOf<infer U> ? U : never;
export type ParametersType<T extends OathAction> = { [k in keyof T["selects"]]: SelectType<T["selects"][k]>[] };

export abstract class OathAction {
    game: OathGame;
    readonly selects: Record<string, SelectNOf<any>> = {};
    readonly parameters = {} as ParametersType<this>;
    readonly autocompleteSelects: boolean = true;
    abstract readonly message: string;

    maskProxyManager = new MaskProxyManager();
    gameProxy: OathGame; // Effects and powers are allowed to modify the proxies to "lie" to the action
    playerProxy: OathPlayer; // This is a simple reference for simplicity

    constructor(
        public actionManager: OathActionManager,
        public player: OathPlayer
    ) {
        this.game = actionManager.game;
        this.gameProxy = this.maskProxyManager.get(actionManager.game);
        this.playerProxy = this.maskProxyManager.get(player);
    }

    doNext(): void {
        this.actionManager.addFutureAction(this);
    }

    start(): boolean {
        // NOTE: Setup the selects before
        for (const [key, select] of Object.entries(this.selects) as [keyof ParametersType<this>, SelectNOf<any>][]) {
            if (this.autocompleteSelects && select.choices.size <= select.min || select.choices.size === 0) {
                this.parameters[key] = [...select.choices.values()];
                delete this.selects[key as string];
            }
        }

        // If all needed parameters were filled out (or there are no selects), just execute immediately
        if (Object.keys(this.selects).length === 0) {
            this.applyParameters({});
            return true;
        }

        return false;
    }

    parse(data: Record<string, string[]>): Record<string, any[]> {
        const values: Record<string, any[]> = {};
        for (const [key, select] of Object.entries(this.selects)) {
            if (!data[key]) throw new InvalidActionResolution(`Missing choice for select ${key}`);
            values[key] = select.parse(data[key]);
        }

        return values;
    }

    applyParameters(values: Partial<ParametersType<this>>) {
        for (const [key, value] of Object.entries(values) as [keyof ParametersType<this>, any[]][]) {
            this.parameters[key] = value;
        }
    }

    abstract execute(): void;

    serialize(): Record<string, any> | undefined {
        return {
            message: this.message,
            player: this.player.id,
            selects: Object.fromEntries(Object.entries(this.selects).map(([k, v]) => [k, v.serialize()])),
        };
    }
}

//////////////////////////////////////////////////
//                   EFFECTS                    //
//////////////////////////////////////////////////
export abstract class OathEffect<T = never> extends OathAction {
    selects: Record<string, never> = {};
    readonly message = "";

    callback?: (e: T) => void;
    result: T;
    executorProxy: OathPlayer | undefined;

    constructor(actionManager: OathActionManager, public executor: OathPlayer | undefined) {
        super(actionManager, executor ?? actionManager.game.currentPlayer);
        this.executorProxy = executor && this.maskProxyManager.get(executor);
    }

    doNext(callback?: (e: T) => void): void {
        this.callback = callback;
        super.doNext();
    }

    execute(): void {
        this.actionManager.currentEffectsStack.push(this);
        this.resolve();
        new ResolveCallbackEffect(this.actionManager, () => { if (this.callback) this.callback(this.result); }).doNext();
    }

    abstract resolve(): void;

    serialize() {
        const data = {
            ...super.serialize(),
            effect: this.constructor.name,
            player: this.executor?.id,
            message: undefined,
            selects: undefined,
            modifiers: undefined
        };
        return data;
    }
}

export abstract class PlayerEffect<T = never> extends OathEffect<T> {
    declare executor: OathPlayer;
    declare executorProxy: OathPlayer;

    constructor(actionManager: OathActionManager, player: OathPlayer) {
        super(actionManager, player);
    }
}

export class ResolveCallbackEffect extends OathAction {
    readonly message = "";
    callback: () => void;

    constructor(actionManager: OathActionManager, callback: () => void) {
        super(actionManager, actionManager.game.currentPlayer);
        this.callback = callback;
    }

    execute(): void {
        this.callback();
    }
}
