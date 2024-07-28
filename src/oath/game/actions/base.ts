import { OathGameObject } from "../gameObject";
import { OathPlayer } from "../player";
import { getCopyWithOriginal, InvalidActionResolution } from "../utils";


////////////////////////////////////////////
//               SELECTORS                //
////////////////////////////////////////////
export class SelectNOf<T> {
    choices: Map<string, T>;
    min: number;
    max: number;

    constructor(choices: Iterable<[string, T]>, min: number = -1, max?: number, exact: boolean = true) {
        this.choices = new Map(choices);

        if (max === undefined) max = min == -1 ? this.choices.size : min;
        if (min > max) throw new InvalidActionResolution("Min is above max");
        if (this.choices.size < min && exact) throw new InvalidActionResolution(`Not enough choices`);

        this.min = min === -1 ? 0: min;
        this.max = max;
    }

    parse(input: Iterable<string>): T[] {
        const values = new Set<T>();
        for (const val of input) {
            if (!this.choices.has(val)) throw new InvalidActionResolution(`Invalid choice for select: ${val}`);
            const obj = this.choices.get(val);
            values.add(obj as T);  // We know the value exists, and if it's undefined, then we want that
        }
        if (values.size < this.min || values.size > this.max) throw new InvalidActionResolution(`Invalid number of values for select`);

        return [...values];
    }

    serialize(): Record <string, any> {
        return {
            choices: [...this.choices.keys()],
            min: this.min,
            max: this.max
        };
    }
}

export class SelectBoolean extends SelectNOf<boolean> {
    constructor(text: [string, string]) {
        super([[text[0], true], [text[1], false]], 1);
    }
}

export class SelectNumber extends SelectNOf<number> {
    constructor(values: number[], min: number = 1, max?: number) {
        const choices = new Map<string, number>();
        for (const i of values) choices.set(String(i), i);
        super(choices, min, max);
    }
}

//////////////////////////////////////////////////
//                BASE CLASSES                  //
//////////////////////////////////////////////////
export abstract class OathAction extends OathGameObject {
    readonly player: OathPlayer;
    readonly selects: Record<string, SelectNOf<any>> = {};
    readonly parameters: Record<string, any> = {};
    readonly autocompleteSelects: boolean = true;
    abstract readonly message: string;

    constructor(player: OathPlayer, dontCopyGame: boolean = false) {
        super(dontCopyGame ? player.game : getCopyWithOriginal(player.game.original));
        this.player = dontCopyGame ? player : this.game.players[player.color];
    }

    doNext(): void {
        this.game.original.actionManager.futureActionsList.unshift(this);
    }

    parse(data: Record<string, string[]>): Record<string, any[]> {
        const values: Record<string, any[]> = {};
        for (const [k, select] of Object.entries(this.selects)) {
            if (!(k in data)) throw new InvalidActionResolution(`Missing choice for select ${k}`);
            values[k] = select.parse(data[k]);
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
        const values: Record<string, string[]> = {};
        if (this.autocompleteSelects) {
            for (const [key, select] of Object.entries(this.selects)) {
                if (select.choices.size <= select.min) {
                    this.parameters[key] = [...select.choices.values()];
                    delete this.selects[key];
                }
            }
        }

        // If all needed parameters were filled out (or there are no selects), just execute immediately
        return Object.keys(this.selects).length === 0;
    }

    abstract execute(): void;

    serialize(): Record<string, any> {
        return {
            message: this.message,
            player: this.player.color,
            selects: Object.fromEntries(Object.entries(this.selects).map(([k, v]) => [k, v.serialize()])),
        }
    }
}


