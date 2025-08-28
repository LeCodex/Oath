import { TreeLeaf, TreeNode, TreeRoot } from "./utils";

class ConcreteRoot extends TreeRoot<ConcreteRoot> {
    override classIndex = {
        ConcreteNode,
        ConcreteNodeChild,
        ConcreteLeaf
    };
    override name = "root";
}

class ConcreteNode extends TreeNode<ConcreteRoot, string> {
    override name = "node";
    override readonly type = "foo";
    get key() { return this.id; }
}

class ConcreteNodeChild extends ConcreteNode {
    override name = "child";
    override readonly type = "foo";
    override get hidden() { return true; }
}

class ConcreteLeaf extends TreeLeaf<ConcreteRoot, string> {
    override name = "leaf";
    override readonly type = "bar";
    get key() { return this.id; }
}

describe("test tree structure", () => {
    let tree: ConcreteRoot;
    let nodes: Array<TreeNode<ConcreteRoot>>;
    beforeEach(() => {
        tree = new ConcreteRoot();
        nodes = [];
        nodes.push(new ConcreteNode("1").parentTo(tree));
        nodes.push(...tree.addChildren([new ConcreteNodeChild("2"), new ConcreteLeaf("1")]));
        nodes.push(nodes[0]!.addChild(new ConcreteLeaf("2")));
    });

    it("built and serializes the tree correctly", () => {
        expect(tree.children.length).toBe(3);
        expect(nodes[0]?.children.length).toBe(1);
        expect(nodes[1]?.children.length).toBe(0);
        expect(nodes[2]?.children.length).toBe(0);
        expect(nodes[3]?.children.length).toBe(0);
        expect(tree.serialize(true)).toEqual({
            type: "root",
            class: "ConcreteRoot",
            id: "root",
            children: [
                {
                    type: "foo",
                    class: "ConcreteNode",
                    id: "1",
                    children: [
                        {
                            type: "bar",
                            class: "ConcreteLeaf",
                            id: "2"
                        }
                    ]
                },
                {
                    type: "bar",
                    class: "ConcreteLeaf",
                    id: "1"
                },
                {
                    type: "foo",
                    class: "ConcreteNodeChild",
                    id: "2"
                },
            ]
        });
        expect(tree.serialize()).toMatchObject({
            type: "root",
            class: "ConcreteRoot",
            _name: "root",
            _hidden: false,
            id: "root",
            children: [
                {
                    type: "foo",
                    class: "ConcreteNode",
                    _name: "node",
                    _hidden: false,
                    id: "1",
                    children: [
                        {
                            type: "bar",
                            class: "ConcreteLeaf",
                            _name: "leaf",
                            _hidden: false,
                            id: "2"
                        }
                    ]
                },
                {
                    type: "bar",
                    class: "ConcreteLeaf",
                    _name: "leaf",
                    _hidden: false,
                    id: "1"
                },
                {
                    type: "foo",
                    class: "ConcreteNodeChild",
                    _name: "child",
                    _hidden: true,
                    id: "2"
                },
            ]
        });
    });

    it("searches the tree", () => {
        expect(tree.search("foo", "1")).toBe(nodes[0]);
        expect(tree.search("bar", "1")).toBe(nodes[1]);
        expect(tree.search("foo", "2")).toBe(nodes[2]);
        expect(tree.search("bar", "2")).toBe(nodes[3]);
        expect(tree.search("far", "1")).toBeUndefined();
        expect(tree.searchOrCreate<ConcreteNodeChild>("ConcreteNodeChild", "foo", "3")).toBeDefined();
    });

    it("unparents", () => {
        nodes[3]!.unparent();

        expect(tree.serialize(true)).toMatchObject({
            type: "root",
            id: "root",
            children: [
                {
                    type: "foo",
                    id: "1"
                },
                {
                    type: "bar",
                    id: "1"
                },
                {
                    type: "foo",
                    id: "2"
                },
                {
                    type: "bar",
                    id: "2"
                }
            ]
        });
        expect(tree.search("bar", "2")).toBe(nodes[3]);
    });

    it("prunes", () => {
        nodes[3]!.prune();

        expect(tree.serialize(true)).toMatchObject({
            type: "root",
            id: "root",
            children: [
                {
                    type: "foo",
                    id: "1"
                },
                {
                    type: "bar",
                    id: "1"
                },
                {
                    type: "foo",
                    id: "2"
                }
            ]
        });
        expect(tree.search("bar", "2")).toBeUndefined();
    });

    it("filters children", () => {
        expect(tree.byClass(ConcreteNode).length).toBe(2);
        expect(tree.byClass("ConcreteNode").length).toBe(1);
        expect(tree.byClass(ConcreteNodeChild).length).toBe(1);
        new ConcreteLeaf("4").parentTo(tree, true);
        expect(tree.byClass(ConcreteLeaf).length).toBe(2);
        expect(tree.children.hasOfClass(ConcreteLeaf)).toBe(true);
        expect(nodes[0]!.children.hasOfClass(ConcreteLeaf)).toBe(true);
        expect(nodes[0]!.children.hasOfClass(ConcreteNodeChild)).toBe(false);
        expect(tree.children.by("type", "foo").length).toBe(2);
        expect(tree.children.by("type", "bar").length).toBe(2);
        expect(tree.children.byKey("1").length).toBe(2);
        expect(tree.byClass(ConcreteNode).max(1).length).toBe(1);
    });

    it("filters parents", () => {
        expect(nodes[3]!.typedParent(ConcreteNode)).toBe(nodes[0]);
        expect(nodes[3]!.typedParent(ConcreteNodeChild)).toBeUndefined();
        expect(nodes[3]!.typedParent(ConcreteRoot)).toBeUndefined();
    });

    it("parses serialized data", () => {
        const copyTree = new ConcreteRoot().parse(tree.serialize(), { allowCreation: true });
        expect(copyTree.serialize()).toEqual(tree.serialize());
    });

    it("reorganizes but doesn't create", () => {
        const newStructure = {
            type: "root",
            class: "ConcreteRoot",
            id: "root",
            children: [
                {
                    type: "foo",
                    class: "ConcreteNode",
                    id: "1"
                },
                {
                    type: "foo",
                    class: "ConcreteNodeChild",
                    id: "2",
                    children: [
                        {
                            type: "bar",
                            class: "ConcreteLeaf",
                            id: "2"
                        }
                    ]
                },
            ]
        };
        tree.parse(newStructure);
        expect(tree.serialize(true)).toEqual(newStructure);
    });

    it("fails to create during parse if not allowed", () => {
        expect(() => tree.parse({
            type: "root", class: "ConcreteRoot", id: "root", children: [{ id: "4", type: "foo", class: "ConcreteNode" }]
        })).toThrow(TypeError);
    });

    it("fails to create during parse if type mismatches", () => {
        expect(() => tree.parse({
            type: "root", class: "ConcreteRoot", id: "root", children: [{ id: "4", type: "bar", class: "ConcreteNode" }]
        }, { allowCreation: true })).toThrow(TypeError);
    });

    it("fails to create unindexed classes", () => {
        expect(() => tree.parse({
            type: "root", class: "ConcreteRoot", id: "root", children: [{ id: "4", type: "foo", class: "InexistantNode" }]
        }, { allowCreation: true })).toThrow(TypeError);
    });

    it("fails to add duplicate id/type pairs", () => {
        expect(() => new ConcreteLeaf("2").parentTo(tree)).toThrow(TypeError);
    });

    it("fails to add children to leaves", () => {
        expect(() => new ConcreteLeaf("4").parentTo(nodes[3]!)).toThrow(TypeError);
    });

    it("fails to prune or parent a root node", () => {
        expect(() => tree.prune()).toThrow(TypeError);
        expect(() => tree.parentTo(nodes[0]!)).toThrow(TypeError);
    });

    it("fails to parent nodes to themselves", () => {
        expect(() => nodes[0]!.parentTo(nodes[0]!)).toThrow(TypeError);
    });
})