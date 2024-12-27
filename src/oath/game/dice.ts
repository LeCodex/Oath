import { PRNG } from "./utils";

export enum DieSymbol {
    Sword = 1,
    TwoSwords = 2,
    HollowSword = 0.5,
    Skull = 0,
    Shield = 1,
    TwoShields = 2,
    DoubleShield = -1
};

export abstract class Die {
    static readonly faces: number[][];

    static getValue(symbols: Map<number, number>, ignore?: Set<number>): number {
        let total = 0;
        for (const [symbol, amount] of symbols.entries())
            if (!ignore?.has(symbol))
                total += symbol * amount;
        
        return Math.floor(total);
    }
}

export class AttackDie extends Die {
    static readonly faces = [
        [DieSymbol.HollowSword], 
        [DieSymbol.HollowSword], 
        [DieSymbol.HollowSword], 
        [DieSymbol.Sword], 
        [DieSymbol.Sword], 
        [DieSymbol.TwoSwords, DieSymbol.Skull]
    ];
}

export class DefenseDie extends Die {
    static readonly faces = [
        [],
        [],
        [DieSymbol.Shield],
        [DieSymbol.Shield],
        [DieSymbol.TwoShields],
        [DieSymbol.DoubleShield],
    ]

    static getValue(symbols: Map<number, number>, ignore?: Set<number>): number {
        let total = 0, mult = 1;
        for (const [symbol, amount] of symbols.entries()) {
            if (ignore?.has(symbol)) continue;
            if (symbol === DieSymbol.DoubleShield)
                mult *= 2;
            else
                total += amount * symbol;
        }
        return total * mult;
    }
}

export class D6 extends Die {
    static readonly faces = [[1], [2], [3], [4], [5], [6]];
}

/** 
 * The result of rolling some dice. Has an internal Map, with an ignore Set that forces the number and value of those faces to 0.
 * 
 * get() returns 0 instead of undefined if a key isn't found.
 */
export class RollResult {
    rolls: number[][] = [];
    ignore: Set<number> = new Set();

    constructor(public random: PRNG, public die: typeof Die) { }

    get symbols(): Map<number, number> {
        const res = new Map<number, number>();
        for (const roll of this.rolls)
            for (const symbol of roll)
                res.set(symbol, (res.get(symbol) ?? 0) + 1);
        
        return res;
    }

    get value(): number {
        return this.die.getValue(this.symbols, this.ignore);
    }

    roll(amount: number): this {
        for (let i = 0; i < amount; i++) {
            const roll = this.random.pick(this.die.faces);
            this.rolls.push(roll);
        }
        return this;
    }

    get(key: number): number {
        if (this.ignore.has(key)) return 0;
        return this.symbols.get(key) ?? 0;
    }
}
