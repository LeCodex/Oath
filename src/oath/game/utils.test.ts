import { times } from "lodash";
import { allChoices, allCombinations, inclusiveRange, isEnumKey, isExtended, MaskProxyManager, maxInGroup, minInGroup, MurmurHash3, NumberMap, PRNG } from "./utils";
import { WithOriginal } from "./model/utils";

describe("helper functions", () => {
    it("checks if constructor are extended", () => {
        class A { }
        class B extends A { }
        class C { }

        expect(isExtended(A, A)).toBe(true);
        expect(isExtended(B, A)).toBe(true);
        expect(isExtended(A, B)).toBe(false);
        expect(isExtended(C, A)).toBe(false);
    });

    it("checks if a key is in an enum", () => {
        enum A {
            A,
            B,
            C
        }

        expect(isEnumKey("A", A)).toBe(true);
        expect(isEnumKey("B", A)).toBe(true);
        expect(isEnumKey("C", A)).toBe(true);
        expect(isEnumKey("D", A)).toBe(false);
    });

    it("generates all possible choices", () => {
        expect(allChoices([[1, 2], [3, 4]])).toEqual([[1, 3], [1, 4], [2, 3], [2, 4]]);
    });

    it("generates all possible combinations", () => {
        expect(allCombinations([1, 2, 3]).toSorted()).toEqual([[], [1], [2], [3], [1, 2], [2, 3], [1, 3], [1, 2, 3]].toSorted());
    });

    it("generates an inclusive range", () => {
        expect(inclusiveRange(10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(inclusiveRange(3, 10)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
        expect(inclusiveRange(3, 10, 3)).toEqual([3, 6, 9]);
    });

    const group = [{ a: 1, b: 3 }, { a: 2, b: 2 }, { a: 3, b: 1 }];
    it("gets the min in a group", () => {
        expect(minInGroup(group, "a")).toEqual([group[0]]);
        expect(minInGroup(group, "b")).toEqual([group[2]]);
        expect(minInGroup(group, (e) => e.a + e.b)).toEqual(group);
        expect(minInGroup(group, (e) => Math.min(e.a, e.b))).toEqual([group[0], group[2]]);
        expect(minInGroup(group, (e) => Math.max(e.a, e.b))).toEqual([group[1]]);
    });

    it("gets the max in a group", () => {
        expect(maxInGroup(group, "a")).toEqual([group[2]]);
        expect(maxInGroup(group, "b")).toEqual([group[0]]);
        expect(maxInGroup(group, (e) => e.a + e.b)).toEqual(group);
        expect(maxInGroup(group, (e) => Math.max(e.a, e.b))).toEqual([group[0], group[2]]);
        expect(maxInGroup(group, (e) => Math.min(e.a, e.b))).toEqual([group[1]]);
    });
});

describe("number map", () => {
    it("returns 0 on a missing key", () => {
        const map = new NumberMap<string>();
        map.set("a", 1);
        expect(map.get("a")).toBe(1);
        expect(map.get("b")).toBe(0);
    });
});

describe("prng", () => {
    const seed = MurmurHash3("seed");

    it("rolls the same ints with the same seed", () => {
        const prng = new PRNG(seed);
        const results = times(5, () => prng.nextInt(10));
        prng.seed = seed;
        expect(times(5, () => prng.nextInt(10))).toEqual(results);
    });
    
    it("rolls the same doubles with the same seed", () => {
        const prng = new PRNG(seed);
        const results = times(5, () => prng.nextDouble());
        prng.seed = seed;
        expect(times(5, () => prng.nextDouble())).toEqual(results);
    });
    
    it("rolls the same picks with the same seed", () => {
        const choices = [1, 2, 3, 4, 5, 6];
        const prng = new PRNG(seed);
        const results = times(5, () => prng.pick(choices));
        prng.seed = seed;
        expect(times(5, () => prng.pick(choices))).toEqual(results);
    });
    
    it("rolls the same shuffle with the same seed", () => {
        const choicesA = [1, 2, 3, 4, 5, 6];
        const choicesB = [1, 2, 3, 4, 5, 6];
        const prng = new PRNG(seed);
        const resultsA = prng.shuffleArray(choicesA);
        prng.seed = seed;
        const resultsB = prng.shuffleArray(choicesB);
        expect(resultsA).toEqual(resultsB);
    });
});

describe("mask proxy manager", () => {
    class Original extends WithOriginal {
        a = 1;
        b = [1, 2];
        c? = 2;
        d = new Set<number>([1]);
        e = new Map<number, number>([[1, 2]]);
    }
    const maskProxyManager = new MaskProxyManager();
    let original: Original;
    let proxy: Original;
    beforeEach(() => {
        original = new Original();
        proxy = maskProxyManager.get(original);
    });

    describe("masks values but doesn't modify the original", () => {
        it("sets values", () => {
            proxy.a = 3;
            expect(proxy.a).toBe(3);
            expect(original.a).toBe(1);
        });

        it("adds values", () => {
            // TODO: Make push work?
            proxy.b = [1, 2, 3];
            expect(proxy.b).toEqual([1, 2, 3]);
            expect(original.b).toEqual([1, 2]);
        });

        it("deletes values", () => {
            delete proxy.c;
            expect(proxy.c).toBeUndefined();
            expect(original.c).toBe(2);
        });
    });

    it("reflects changes to the original", () => {
        original.a = 3;
        expect(proxy.a).toBe(original.a);

        original.b.push(3);
        expect(proxy.b).toEqual(original.b);

        delete original.c;
        expect(proxy.c).toEqual(original.c);

        original.d.add(2);
        expect(proxy.d.has(2)).toEqual(original.d.has(2));
        original.d.delete(1);
        expect(proxy.d.has(1)).toEqual(original.d.has(1));
        
        original.e.set(2, 3);
        expect(proxy.e.get(2)).toEqual(original.e.get(2));
        original.e.delete(1);
        expect(proxy.e.get(1)).toEqual(original.e.get(1));
    });

    describe("masks a set", () => {
        it("adds values", () => {
            proxy.d.add(2);
            proxy.d.add(3);
            expect(proxy.d.size).toBe(3);
            expect(proxy.d.has(2)).toBe(true);
            expect(proxy.d.has(3)).toBe(true);
            expect(original.d.size).toBe(1);
            expect(original.d.has(2)).toBe(false);
            expect(original.d.has(3)).toBe(false);
        });

        it("removes values", () => {
            proxy.d.delete(1);
            expect(proxy.d.size).toBe(0);
            expect(proxy.d.has(1)).toBe(false);
            expect(original.d.size).toBe(1);
            expect(original.d.has(1)).toBe(true);
        });

        it("clears", () => {
            proxy.d.clear();
            expect(proxy.d.size).toBe(0);
            expect(proxy.d.has(1)).toBe(false);
            expect(original.d.size).toBe(1);
            expect(original.d.has(1)).toBe(true);
        });
    });

    describe("masks a map", () => {
        it("adds values", () => {
            proxy.e.set(2, 3);
            proxy.e.set(3, 4);
            expect(proxy.e.size).toBe(3);
            expect(proxy.e.has(2)).toBe(true);
            expect(proxy.e.get(2)).toBe(3);
            expect(proxy.e.has(3)).toBe(true);
            expect(proxy.e.get(3)).toBe(4);
            expect(original.e.size).toBe(1);
            expect(original.e.has(2)).toBe(false);
            expect(original.e.get(2)).toBeUndefined();
            expect(original.e.has(3)).toBe(false);
            expect(original.e.get(3)).toBeUndefined();
        });

        it("removes values", () => {
            proxy.e.delete(1);
            expect(proxy.e.size).toBe(0);
            expect(proxy.e.has(1)).toBe(false);
            expect(proxy.e.get(1)).toBeUndefined();
            expect(original.e.size).toBe(1);
            expect(original.e.has(1)).toBe(true);
            expect(original.e.get(1)).toBe(2);
        });

        it("clears", () => {
            proxy.e.clear();
            expect(proxy.e.size).toBe(0);
            expect(proxy.e.has(1)).toBe(false);
            expect(proxy.e.get(1)).toBeUndefined();
            expect(original.e.size).toBe(1);
            expect(original.e.has(1)).toBe(true);
            expect(original.e.get(1)).toBe(2);
        });
    });

    it("can get back the original from the proxy", () => {
        expect(proxy.original).toBe(original);
    });

    it("doesn't proxy proxies", () => {
        expect(maskProxyManager.get(proxy)).toBe(proxy);
    });

    it("doesn't accept masked sets and maps from other managers", () => {
        const otherManager = new MaskProxyManager();
        const set = new Set();
        const map = new Map();
        const setProxy = maskProxyManager.get(set);
        const mapProxy = maskProxyManager.get(map);
        expect(maskProxyManager.get(setProxy)).toBe(setProxy);
        expect(maskProxyManager.get(mapProxy)).toBe(mapProxy);
        expect(() => otherManager.get(setProxy)).toThrow(TypeError);
        expect(() => otherManager.get(mapProxy)).toThrow(TypeError);
    });
})