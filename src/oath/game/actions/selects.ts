import { InvalidActionResolution } from "./actions";


export class SelectNOf<T> {
    name: string;
    choices: Map<string, T>;
    min: number;
    max: number;

    constructor(name: string, choices: Iterable<[string, T]>, min: number = -1, max?: number, exact: boolean = true) {
        this.name = name;
        this.choices = new Map(choices);
        
        if (max === undefined) max = min == -1 ? this.choices.size : min;
        min = Math.max(min, 0);
        
        if (min > max) throw new InvalidActionResolution(`Min is above max for select ${this.name}`);
        if (this.choices.size < min && exact) throw new InvalidActionResolution(`Not enough choices for select ${this.name}`);

        this.min = min;
        this.max = Math.min(max, this.choices.size);
    }

    parse(input: Iterable<string>): T[] {
        const values = new Set<T>();
        for (const val of input) {
            if (!this.choices.has(val)) throw new InvalidActionResolution(`Invalid choice for select ${this.name}: ${val}`);
            const obj = this.choices.get(val);
            values.add(obj as T); // We know the value exists, and if it's undefined, then we want it to be
        }
        if (values.size < this.min || values.size > this.max) throw new InvalidActionResolution(`Invalid number of values for select ${this.name}`);

        return [...values];
    }

    serialize(): Record<string, any> {
        return {
            name: this.name,
            choices: [...this.choices.keys()],
            min: this.min,
            max: this.max
        };
    }
}

export class SelectBoolean extends SelectNOf<boolean> {
    constructor(name: string, text: [string, string]) {
        super(name, [[text[0], true], [text[1], false]], 1);
    }
}

export class SelectNumber extends SelectNOf<number> {
    constructor(name: string, values: Iterable<number>, min: number = 1, max?: number) {
        const choices = new Map<string, number>();
        for (const i of values) choices.set(i.toString(), i);
        super(name, choices, min, max);
    }
}
