import type { OathGame } from "../model/game";
import type { WithPowers } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import type { ActionModifier } from "../powers";
import { MaskProxyManager } from "../utils";
import type { OathActionManager } from "./manager";
import type { SelectNOf } from "./selects";
import { InvalidActionResolution } from "./utils";


//////////////////////////////////////////////////
//                   ACTIONS                    //
//////////////////////////////////////////////////
export abstract class OathAction {
    game: OathGame;
    readonly selects: Record<string, SelectNOf<any>> = {};
    readonly parameters: Record<string, any> = {};
    readonly autocompleteSelects: boolean = true;
    abstract readonly message: string;

    constructor(
        public actionManager: OathActionManager,
        public player: OathPlayer
    ) {
        this.game = actionManager.game;
    }

    doNext(): void {
        this.actionManager.futureActionsList.unshift(this);
    }

    parse(data: Record<string, string[]>): Record<string, any[]> {
        const values: Record<string, any[]> = {};
        for (const [key, select] of Object.entries(this.selects)) {
            if (!data[key]) throw new InvalidActionResolution(`Missing choice for select ${key}`);
            values[key] = select.parse(data[key]);
        }

        return values;
    }

    applyParameters(values: Record<string, any[]>) {
        for (const [key, value] of Object.entries(values)) {
            this.parameters[key] = value;
        }
    }

    start(): boolean {
        // NOTE: Setup the selects before
        for (const [key, select] of Object.entries(this.selects)) {
            if (this.autocompleteSelects && select.choices.size <= select.min || select.choices.size === 0) {
                this.parameters[key] = [...select.choices.values()];
                delete this.selects[key];
            }
        }

        // If all needed parameters were filled out (or there are no selects), just execute immediately
        return Object.keys(this.selects).length === 0;
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

export abstract class ActionWithProxy extends OathAction {
    modifiers: ActionModifier<WithPowers, this>[] = [];
    maskProxyManager: MaskProxyManager;
    gameProxy: OathGame; // Effects and powers are allowed to modify the proxies to "lie" to the action
    playerProxy: OathPlayer; // This is a simple reference for simplicity

    constructor(actionManager: OathActionManager, player: OathPlayer) {
        super(actionManager, player);
        this.maskProxyManager = new MaskProxyManager();
        this.gameProxy = this.maskProxyManager.get(player.game);
        this.playerProxy = this.maskProxyManager.get(player);
    }

    start(): boolean {
        for (const modifier of this.modifiers) modifier.applyAtStart();
        return super.start();
    }

    execute() {
        new ResolveCallbackEffect(this.actionManager, () => { this.modifiedExecution(); });
    }

    abstract modifiedExecution(): void;

    serialize(): Record<string, any> | undefined {
        return {
            ...super.serialize(),
            modifiers: this.modifiers.map(e => e.serialize())
        };
    }
}

//////////////////////////////////////////////////
//                   EFFECTS                    //
//////////////////////////////////////////////////
export abstract class OathEffect<T = never> extends ActionWithProxy {
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
        new ResolveCallbackEffect(this.actionManager, () => { if (this.callback) this.callback(this.result); }).doNext();
    }

    modifiedExecution(): void {
        this.actionManager.currentEffectsStack.push(this);
        this.resolve();
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
