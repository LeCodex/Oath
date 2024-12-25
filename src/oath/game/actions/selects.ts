import { OathCard } from "../cards/cards";
import { OathPlayer } from "../player";
import { InvalidActionResolution } from "./base";


type SelectParams = {
    min?: number,
    max?: number,
    exact?: boolean,
    defaults?: Iterable<string>
};

export class SelectNOf<T> {
    name: string;
    choices: Map<string, T>;
    defaults: string[];
    min: number;
    max: number;

    /**
     * Default params are: any number (including 0), with exact (must be able to select the demanded number).
     * Min can be negative, if so it's treated as 0. Max can be above the number of choices, if so it's treated as the number of choices.
     * 
     * If only min is specified, then it's used for both min and max. If only max is specified, then it's used with a min of 0.
     */
    constructor(name: string, choices: Iterable<[string, T]>, params: SelectParams = {}) {
        this.name = name;
        this.choices = new Map(choices);

        params.min ??= -1;
        params.exact ??= true;

        this.defaults = params.defaults ? [...params.defaults] : [];
        
        if (params.max === undefined) params.max = params.min == -1 ? this.choices.size : params.min;
        params.min = Math.max(params.min, 0);
        
        if (params.min > params.max) throw new InvalidActionResolution(`Min is above max for select ${this.name}`);
        if (this.choices.size < params.min && params.exact) throw new InvalidActionResolution(`Not enough choices for select ${this.name}`);

        this.min = params.min;
        this.max = Math.min(params.max, this.choices.size);
    }

    filterChoices(condition: (e: T) => boolean) {
        for (const [name, choice] of this.choices)
            if (!condition(choice))
                this.choices.delete(name);
    }

    parse(input: Iterable<string>): T[] {
        const values = new Set<T>();
        for (const val of input) {
            if (!this.choices.has(val)) throw new InvalidActionResolution(`Invalid choice for select ${this.name}: ${val} (Expected one of ${[...this.choices.keys()].join(', ')})`);
            const obj = this.choices.get(val);
            values.add(obj as T); // We know the value exists, and if it's undefined, then we want it to be
        }
        if (values.size < this.min || values.size > this.max) throw new InvalidActionResolution(`Invalid number of values for select ${this.name} (Expected between ${this.min} and ${this.max})`);

        return [...values];
    }

    serialize(): Record<string, any> {
        return {
            name: this.name,
            choices: [...this.choices.keys()],
            min: this.min,
            max: this.max,
            defaults: this.defaults
        };
    }
}

export class SelectBoolean extends SelectNOf<boolean> {
    constructor(name: string, text: [string, string]) {
        super(name, [[text[0], true], [text[1], false]], { min: 1 });
    }
}

export class SelectNumber extends SelectNOf<number> {
    constructor(name: string, values: Iterable<number>, params: SelectParams = {}) {
        const choices = new Map<string, number>();
        for (const i of values) choices.set(i.toString(), i);
        params.min = 1;
        params.max = 1;
        super(name, choices, params);
    }
}

export class SelectWithName<T extends { name: string }> extends SelectNOf<T> {
    constructor(name: string, values: Iterable<T>, params: SelectParams = {}) {
        const choices = new Map<string, T>();
        for (const node of values) choices.set(node.name, node);
        super(name, choices, params);
    }
}

export class SelectCard<T extends OathCard> extends SelectNOf<T> {
    constructor(name: string, player: OathPlayer, values: Iterable<T>, params: SelectParams = {}) {
        const choices = new Map<string, T>();
        for (const card of values) choices.set(card.visualName(player), card);
        super(name, choices, params);
    }
}