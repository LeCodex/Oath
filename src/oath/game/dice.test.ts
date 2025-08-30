import { AttackDie, AttackDieSymbol, D6, RollResult } from "./dice";
import { PRNG } from "./utils";

const rolls = 100_000;
describe("d6", () => {
    it("rolls expected results", () => {
        const result = new RollResult(new PRNG(), new D6());
        result.roll(rolls);
        expect(result.get(6) / rolls).toBeCloseTo(1 / 6);
        expect(result.get(5) / rolls).toBeCloseTo(1 / 6);
        expect(result.get(4) / rolls).toBeCloseTo(1 / 6);
        expect(result.get(3) / rolls).toBeCloseTo(1 / 6);
        expect(result.get(2) / rolls).toBeCloseTo(1 / 6);
        expect(result.get(1) / rolls).toBeCloseTo(1 / 6);
        expect(result.value / rolls).toBeCloseTo(3.5);
    });

    it("ignores faces correctly", () => {
        const result = new RollResult(new PRNG(), new D6());
        result.ignore.add(1);
        result.roll(rolls);
        expect(result.get(1)).toBe(0);
        expect(result.value / rolls).toBeCloseTo(10 / 3);
    });
});

describe("attack die", () => {
    it("rolls expected results", () => {
        const result = new RollResult(new PRNG(), new AttackDie());
        result.roll(rolls);
        expect(result.get(AttackDieSymbol.HollowSword) / rolls).toBeCloseTo(1 / 2);
        expect(result.get(AttackDieSymbol.Sword) / rolls).toBeCloseTo(1 / 3);
        expect(result.get(AttackDieSymbol.TwoSwords) / rolls).toBeCloseTo(1 / 6);
        expect(result.get(AttackDieSymbol.Skull) / rolls).toBeCloseTo(1 / 6);
        expect(result.value / rolls).toBeCloseTo(5.5 / 6);
    });
});

describe("defense die", () => {
    it.todo("rolls expected results");
});