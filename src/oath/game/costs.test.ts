import { ResourceCost, ResourceTransferContext, SupplyCost, SupplyCostContext } from "./costs";
import { FavorBank } from "./model/banks";
import { Denizen } from "./model/cards";
import { OathPlayer } from "./model/player";
import { Favor, Secret } from "./model/resources";

describe("resource cost", () => {
    it("counts resources", () => {
        const cost = new ResourceCost([[Favor, 1], [Secret, 2]], [[Favor, 3], [Secret, 4]]);
        expect(cost.placedResources.get(Favor)).toBe(1);
        expect(cost.placedResources.get(Secret)).toBe(2);
        expect(cost.burntResources.get(Favor)).toBe(3);
        expect(cost.burntResources.get(Secret)).toBe(4);
        expect(cost.totalResources.get(Favor)).toBe(4);
        expect(cost.totalResources.get(Secret)).toBe(6);
    });

    it("counts as free", () => {
        const cost = new ResourceCost();
        const costPlaces = new ResourceCost([[Favor, 1]]);
        const costBurns = new ResourceCost([], [[Secret, 1]]);
        expect(cost.free).toBe(true);
        expect(cost.placesResources).toBe(false);
        expect(costPlaces.free).toBe(false);
        expect(costPlaces.placesResources).toBe(true);
        expect(costBurns.free).toBe(false);
        expect(costBurns.placesResources).toBe(false);
    });

    it("adds to other costs", () => {
        const cost = new ResourceCost([[Favor, 1]]);
        cost.add(new ResourceCost([[Favor, 1], [Secret, 1]], [[Favor, 3]]));
        expect(cost.placedResources.get(Favor)).toBe(2);
        expect(cost.placedResources.get(Secret)).toBe(1);
        expect(cost.burntResources.get(Favor)).toBe(3);
        expect(cost.burntResources.get(Secret)).toBe(0);
    });

    it("converts to a string", () => {
        const cost = new ResourceCost([[Favor, 1], [Secret, 2]], [[Favor, 2], [Secret, 0]]);
        expect(cost.toString()).toEqual("1 Favor, 2 Secrets placed, 2 Favors burnt");
    });

    it("serializes and parses", () => {
        const cost = new ResourceCost([[Favor, 1], [Secret, 1]], [[Favor, 1], [Secret, 1]]);
        expect(ResourceCost.parse(cost.serialize()).toString()).toEqual(cost.toString());
    });
});

describe("supply cost", () => {
    it("counts supply", () => {
        const cost = new SupplyCost(1, 1, 1, 2);
        expect(cost.free).toBe(false);
        expect(cost.amount).toBe(5);
        expect(cost.base).toBe(1);
    });

    it("counts as free", () => {
        const cost = new SupplyCost(0);
        expect(cost.free).toBe(true);
        expect(cost.amount).toBe(0);
    });
    
    it("adds to other costs", () => {
        const cost = new SupplyCost(1, 2, 0, 3);
        cost.add(new SupplyCost(2));
        expect(cost.amount).toBe(11);
    });

    it("converts to string", () => {
        const cost = new SupplyCost(5);
        expect(cost.toString()).toEqual("5 Supply");
    });
});

describe("resource transfer context", () => {
    it("determines normal validity", () => {
        const player = new OathPlayer("1");
        new Favor().parentTo(player);
        new Secret().parentTo(player);
        new Secret().parentTo(player).flipped = true;
        const target = new FavorBank("Arcane");
        const context1 = new ResourceTransferContext(player, undefined, new ResourceCost([[Favor, 1]]), target);
        const context2 = new ResourceTransferContext(player, undefined, new ResourceCost([[Favor, 2]]), target);
        const context3 = new ResourceTransferContext(player, undefined, new ResourceCost([[Secret, 1]]), target);
        const context4 = new ResourceTransferContext(player, undefined, new ResourceCost([[Secret, 2]]), target);
        expect(context1.valid).toBe(true);
        expect(context2.valid).toBe(false);
        expect(context3.valid).toBe(true);
        expect(context4.valid).toBe(false);
    });

    it("determines validity without a source", () => {
        expect(new ResourceTransferContext(undefined, undefined, new ResourceCost(), undefined).valid).toBe(true);
        expect(new ResourceTransferContext(undefined, undefined, new ResourceCost([], [[Favor, 1]]), undefined).valid).toBe(false);
    });

    it("determines validity with partiality", () => {
        const player = new OathPlayer("1");
        const source = new Denizen("AFastSteed").parentTo(player).addChild(new Favor());
        const target = new FavorBank("Arcane");
        const context1 = new ResourceTransferContext(player, undefined, new ResourceCost([[Favor, 1]]), target, source);
        const context2 = new ResourceTransferContext(player, undefined, new ResourceCost([[Favor, 2]]), target, source);
        const context3 = new ResourceTransferContext(player, undefined, new ResourceCost([[Secret, 1]]), target, source);
        expect(context1.valid).toBe(true);
        expect(context2.valid).toBe(true);
        expect(context3.valid).toBe(true);
    });
});

describe("supply cost context", () => {
    it("determines normal validity", () => {
        const player = new OathPlayer("1");
        const other = new OathPlayer("2");
        player.supply = 4;
        other.supply = 3;
        const context1 = new SupplyCostContext(player, undefined, new SupplyCost(3));
        const context2 = new SupplyCostContext(player, undefined, new SupplyCost(5));
        const context3 = new SupplyCostContext(player, undefined, new SupplyCost(3), other);
        const context4 = new SupplyCostContext(player, undefined, new SupplyCost(5), other);
        expect(context1.valid).toBe(true);
        expect(context2.valid).toBe(false);
        expect(context3.valid).toBe(true);
        expect(context4.valid).toBe(false);
    });

    it("determines validity without a source", () => {
        expect(new SupplyCostContext(undefined, undefined, new SupplyCost(0)).valid).toBe(true);
        expect(new SupplyCostContext(undefined, undefined, new SupplyCost(2)).valid).toBe(false);
    });
});