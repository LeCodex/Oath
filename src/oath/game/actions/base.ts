import type { OathGame } from "../model/game";
import type { WithPowers } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import type { ActionModifier } from "../powers";
import type { Constructor} from "../utils";
import { allCombinations, MaskProxyManager } from "../utils";
import { SelectNOf } from "./selects";
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

    player: OathPlayer; // This is the original player. Modifying it modifies the game state

    constructor(player: OathPlayer) {
        this.game = player.game;
        this.player = player;
    }

    doNext(): void {
        this.game.actionManager.futureActionsList.unshift(this);
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

export class ChooseModifiers<T extends ModifiableAction> extends OathAction {
    declare readonly selects: { modifiers: SelectNOf<ActionModifier<WithPowers, T>[]>; };
    declare readonly parameters: { modifiers: ActionModifier<WithPowers, T>[][]; };
    readonly action: T;
    readonly next: T | ChooseModifiers<T>;
    readonly message = "Choose modifiers";

    constructor(next: T | ChooseModifiers<T>, chooser: OathPlayer = next.player) {
        super(chooser);
        this.next = next;
        this.action = next instanceof ChooseModifiers ? next.action : next;
    }

    start() {
        const defaults: string[] = [];
        const persistentModifiers = new Set<ActionModifier<WithPowers, T>>();
        const optionalModifiers = new Set<ActionModifier<WithPowers, T>>();
        for (const modifier of this.game.gatherActionModifiers(this.action, this.player)) {
            if (modifier.mustUse) {
                persistentModifiers.add(modifier);
            } else {
                optionalModifiers.add(modifier);
            }
        }

        // TODO: Change to permutations to handle order (maybe have order agnosticity as a property)
        const choices = new Map<string, ActionModifier<WithPowers, T>[]>();
        for (const combination of allCombinations(optionalModifiers)) {
            // const totalContext = new MultiResourceTransferContext(this.player, this, [...persistentModifiers, ...combination].map(e => e.costContext));
            // if (!totalContext.payableCostsWithModifiers(this.action.maskProxyManager).length)
            //     choices.set(combination.map(e => e.name).join(", "), combination);
        }
        this.selects.modifiers = new SelectNOf("Modifiers", choices, { defaults });

        return super.start();
    }

    execute() {
        const modifiers = new Set(this.parameters.modifiers[0]);

        // NOTE: For ignore loops, all powers in the loop are ignored.
        const ignore = new Set<ActionModifier<WithPowers, T>>();
        for (const modifier of modifiers)
            for (const toIgnore of modifier.applyImmediately(modifiers))
                ignore.add(toIgnore);
        for (const modifier of ignore) modifiers.delete(modifier);

        if (this.action.applyModifiers(modifiers)) {
            if (this.next instanceof ModifiableAction) {
                this.next.doNextWithoutModifiers();
            } else {
                this.next.doNext();
            }
        }
    }
}

export abstract class ModifiableAction extends OathAction {
    modifiers: ActionModifier<WithPowers, this>[] = [];
    maskProxyManager: MaskProxyManager;
    gameProxy: OathGame;  // Effects and powers are allowed to modify the proxies to "lie" to the action
    playerProxy: OathPlayer;  // This is a simple reference for simplicity

    constructor(player: OathPlayer) {
        super(player);
        this.maskProxyManager = new MaskProxyManager();
        this.gameProxy = this.maskProxyManager.get(player.game);
        this.playerProxy = this.maskProxyManager.get(player);
    }

    doNext(): void {
        new ChooseModifiers(this).doNext();
    }

    doNextWithoutModifiers(): void {
        super.doNext();
    }

    applyModifiers(modifiers: Iterable<ActionModifier<WithPowers, this>>) {
        this.modifiers.push(...modifiers);

        let shouldContinue = true;
        for (const modifier of modifiers) {
            modifier.payCost(success => {
                if (!success) throw modifier.cost.cannotPayError;
            });

            if (!modifier.applyWhenApplied()) shouldContinue = false;

            // Modifiers can only be applied once
            modifier.sourceProxy.powers.delete(modifier.constructor as Constructor<ActionModifier<WithPowers, this>>);
        }

        return shouldContinue;
    }

    start(): boolean {
        for (const modifier of this.modifiers) modifier.applyAtStart();
        return super.start();
    }

    execute() {
        for (const modifier of this.modifiers) modifier.applyBefore();
        new ResolveCallbackEffect(this.game, () => {  // This allows actions to be slotted before the actual resolution of the ac tion
            this.modifiedExecution()
            for (const modifier of this.modifiers) modifier.applyAfter();
        }).doNext();
        new ResolveCallbackEffect(this.game, () => { for (const modifier of this.modifiers) modifier.applyAtEnd(); }).doNext();
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
export abstract class OathEffect<T = never> extends ModifiableAction {
    selects: Record<string, never> = {};
    readonly message = "";

    executor: OathPlayer | undefined;
    callback?: (e: T) => void;
    result: T;
    executorProxy: OathPlayer | undefined;

    constructor(game: OathGame, executor: OathPlayer | undefined) {
        super(executor ?? game.currentPlayer);
        this.executor = executor;
        this.maskProxyManager = new MaskProxyManager();
        this.executorProxy = executor && this.maskProxyManager.get(executor);
    }

    doNext(callback?: (e: T) => void): void {
        this.callback = callback;
        super.doNext();
    }

    execute(): void {
        super.execute();
        new ResolveCallbackEffect(this.game, () => { if (this.callback) this.callback(this.result); }).doNext();
    }

    modifiedExecution(): void {
        this.game.actionManager.currentEffectsStack.push(this);
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

    constructor(player: OathPlayer) {
        super(player.game, player);
    }
}

export class ResolveCallbackEffect extends OathAction {
    readonly message = "";
    callback: () => void;

    constructor(game: OathGame, callback: () => void) {
        super(game.currentPlayer);
        this.callback = callback;
    }

    execute(): void {
        this.callback();
    }
}
