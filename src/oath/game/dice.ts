export enum DieSymbol {
    Sword = 1,
    TwoSword = 2,
    HollowSword = 0.5,
    Skull = 0,
    Shield = 1,
    TwoShield = 2,
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
        [DieSymbol.TwoSword, DieSymbol.Skull]
    ];
}

export class DefenseDie extends Die {
    static readonly faces = [
        [],
        [],
        [DieSymbol.Shield],
        [DieSymbol.Shield],
        [DieSymbol.TwoShield],
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
    dice: Map<typeof Die, Map<number, number>> = new Map();
    ignore: Set<number> = new Set();

    get symbols(): Map<number, number> {
        const res = new Map<number, number>();
        for (const symbols of this.dice.values())
            for (const [symbol, amount] of symbols)
                res.set(symbol, (res.get(symbol) || 0) + amount);
        
        return res;
    }

    get value(): number {
        let total = 0;
        for (const [die, symbols] of this.dice) total += die.getValue(symbols, this.ignore);
        return total;
    }

    roll(die: typeof Die, amount: number): this {
        for (let i = 0; i < amount; i++) {
            const symbols = die.faces[Math.floor(Math.random() * die.faces.length)]!;
            const symbolCount = this.dice.get(die) || new Map<number, number>();
            for (const symbol of symbols) symbolCount.set(symbol, (symbolCount.get(symbol) || 0) + 1);
            this.dice.set(die, symbolCount);
        }
        return this;
    }

    get(key: number): number {
        if (this.ignore.has(key)) return 0;
        return this.symbols.get(key) || 0;
    }
}
