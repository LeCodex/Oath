import { recordExecutionTime, recordMethodExecutionTime, recordInstantiationTime } from "../../utils";
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
export type ParametersType<T extends OathAction> = { [K in keyof T["selects"]]: SelectType<T["selects"][K]>[] };

@recordInstantiationTime.skip
export abstract class OathAction {
    game: OathGame;
    readonly selects: Record<string, SelectNOf<any>> = {};
    readonly parameters = {} as ParametersType<this>;
    readonly autocompleteSelects: boolean = true;
    abstract readonly message: string;

    maskProxyManager = new MaskProxyManager();

    constructor(
        public actionManager: OathActionManager,
        public player: OathPlayer | undefined
    ) {
        this.game = actionManager.game;
    }

    get gameProxy(): this["game"] { return this.maskProxyManager.get(this.game); } // Effects and powers are allowed to modify the proxies to "lie" to the action
    get playerProxy(): this["player"] { return this.maskProxyManager.get(this.player); } // This is a simple reference for simplicity

    @recordMethodExecutionTime.skip()
    doNext(): void {
        this.actionManager.addFutureAction(this);
    }

    @recordMethodExecutionTime.skip()
    start(): boolean {
        // NOTE: Setup the selects before
        for (const [key, select] of Object.entries(this.selects) as [keyof ParametersType<this>, SelectNOf<any>][]) {
            if (select.choices.size === 0 || this.autocompleteSelects && select.choices.size <= select.min) {
                this.parameters[key] = [...select.choices.values()];
                delete this.selects[key as string];
            }
        }

        // No player will make the choices: try and auto-fill with default choices
        if (!this.player) {
            for (const [key, values] of Object.entries(this.defaultChoices) as [keyof ParametersType<this>, any][]) {
                if (!values) continue;
                this.parameters[key] = values;
                delete this.selects[key as string];
            }
            if (Object.keys(this.selects).length > 0) {
                throw new InvalidActionResolution(`Missing default choice for selects ${Object.keys(this.selects).join(", ")} in action ${this.constructor.name}`);
            }
        }

        // If all needed parameters were filled out (or there are no selects), just execute immediately
        if (Object.keys(this.selects).length === 0) {
            this.applyParameters({});
            return true;
        }

        return false;
    }

    /** Choices made in case {@link player} is undefined. In most cases it's never called and doesn't need to be defined. */
    get defaultChoices() {
        return {};
    }

    @recordMethodExecutionTime.skip()
    parse(data: Record<string, string[]>): Record<string, any[]> {
        const values: Record<string, any[]> = {};
        for (const [key, select] of Object.entries(this.selects)) {
            if (!data[key]) throw new InvalidActionResolution(`Missing choice for select ${key} in action ${this.constructor.name}`);
            values[key] = select.parse(data[key]);
        }

        return values;
    }

    @recordMethodExecutionTime.skip()
    applyParameters(values: Partial<ParametersType<this>>) {
        for (const [key, value] of Object.entries(values) as [keyof ParametersType<this>, any[]][]) {
            this.parameters[key] = value;
        }
    }

    abstract execute(): void;

    @recordMethodExecutionTime.skip()
    serialize(): Record<string, any> {
        return {
            message: this.message,
            player: this.player?.id,
            selects: Object.fromEntries(Object.entries(this.selects).map(([k, v]) => [k, v.serialize()])),
        };
    }
}

export abstract class PlayerAction extends OathAction {
    declare player: OathPlayer;

    constructor(actionManager: OathActionManager, player: OathPlayer) {
        super(actionManager, player);
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

    doNext(callback?: (e: T) => void): void {
        this.callback = callback;
        super.doNext();
    }

    execute(): void {
        this.actionManager.currentEffectsStack.push(this);
        recordExecutionTime.skip(`${this.constructor.name}.resolve`, this.resolve.bind(this));
        if (this.callback) new ResolveCallbackEffect(this.actionManager, () => { this.callback!(this.result); }).doNext();
    }

    abstract resolve(): void;

    serialize() {
        return {
            ...super.serialize(),
            effect: this.constructor.name,
            message: undefined,
            selects: undefined,
            modifiers: undefined
        };
    }
}

export abstract class PlayerEffect<T = never> extends OathEffect<T> {
    declare player: OathPlayer;

    constructor(actionManager: OathActionManager, player: OathPlayer) {
        super(actionManager, player);
    }
}

export class ResolveCallbackEffect extends OathAction {
    readonly message = "";
    callback: () => void;

    constructor(actionManager: OathActionManager, callback: () => void) {
        super(actionManager, undefined);
        this.callback = callback;
    }

    execute(): void {
        this.callback();
    }
}
