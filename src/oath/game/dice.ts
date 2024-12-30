import { PRNG } from "./utils";

export class Die<T extends number> {
    readonly faces: T[][];

    getValue(symbols: Map<T, number>, ignore?: Set<T>): number {
        let total = 0;
        for (const [symbol, amount] of symbols.entries())
            if (!ignore?.has(symbol))
                total += symbol * amount;
        
        return Math.floor(total);
    }
}

export enum AttackDieSymbol {
    Sword = 1,
    TwoSwords = 2,
    HollowSword = 0.5,
    Skull = 0,
};

export class AttackDie extends Die<AttackDieSymbol> {
    readonly faces = [
        [AttackDieSymbol.HollowSword], 
        [AttackDieSymbol.HollowSword], 
        [AttackDieSymbol.HollowSword], 
        [AttackDieSymbol.Sword], 
        [AttackDieSymbol.Sword], 
        [AttackDieSymbol.TwoSwords, AttackDieSymbol.Skull]
    ];
}

export enum DefenseDieSymbol {
    Shield = 1,
    TwoShields = 2,
    DoubleShield = -1,
}

export class DefenseDie extends Die<DefenseDieSymbol> {
    readonly faces = [
        [],
        [],
        [DefenseDieSymbol.Shield],
        [DefenseDieSymbol.Shield],
        [DefenseDieSymbol.TwoShields],
        [DefenseDieSymbol.DoubleShield],
    ];

    getValue(symbols: Map<DefenseDieSymbol, number>, ignore?: Set<DefenseDieSymbol>): number {
        let total = 0, mult = 1;
        for (const [symbol, amount] of symbols.entries()) {
            if (ignore?.has(symbol)) continue;
            if (symbol === DefenseDieSymbol.DoubleShield)
                mult *= 2;
            else
                total += amount * symbol;
        }
        return total * mult;
    }
}

export class D6 extends Die<number> {
    static readonly faces = [[1], [2], [3], [4], [5], [6]];
}

export type SymbolType<T extends Die<number>> = T extends Die<infer U> ? U : never;

/** 
 * The result of rolling some dice. Has an internal Map, with an ignore Set that forces the number and value of those faces to 0.
 * 
 * get() returns 0 instead of undefined if a key isn't found.
 */
export class RollResult<T extends Die<number>> {
    rolls: SymbolType<T>[][] = [];
    ignore: Set<SymbolType<T>> = new Set();

    constructor(public random: PRNG, public die: T) { }

    get symbols(): Map<SymbolType<T>, number> {
        const res = new Map<SymbolType<T>, number>();
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
            const roll = this.random.pick(this.die.faces) as SymbolType<T>[];
            this.rolls.push(roll);
        }
        return this;
    }

    get(key: SymbolType<T>): number {
        if (this.ignore.has(key)) return 0;
        return this.symbols.get(key) ?? 0;
    }
}
