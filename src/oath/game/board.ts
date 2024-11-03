import { Site } from "./cards/cards";
import { Discard } from "./cards/decks";
import { RegionKey } from "./enums";
import { Container, OathGameObject } from "./gameObject";


export class OathBoard extends Container<Region, "board"> {
    type = "board";
    travelCosts = new Map<RegionKey, Map<RegionKey, number>>([
        [RegionKey.Cradle, new Map([[RegionKey.Cradle, 1], [RegionKey.Provinces, 2], [RegionKey.Hinterland, 4]])],
        [RegionKey.Provinces, new Map([[RegionKey.Cradle, 2], [RegionKey.Provinces, 2], [RegionKey.Hinterland, 2]])],
        [RegionKey.Hinterland, new Map([[RegionKey.Cradle, 4], [RegionKey.Provinces, 2], [RegionKey.Hinterland, 3]])],
    ]);
    nextRegionKey = new Map<RegionKey, RegionKey>([
        [RegionKey.Cradle, RegionKey.Provinces],
        [RegionKey.Provinces, RegionKey.Hinterland],
        [RegionKey.Hinterland, RegionKey.Cradle],
    ]);

    constructor() {
        super("board", Region);
    }

    nextRegion(region: Region) {
        const name = this.nextRegionKey.get(region.regionKey);
        if (name === undefined) return undefined;
        return this.byClass(Region).byId(name)[0];
    }

    *sites() {
        for (const region of this.children)
            for (const site of region.byClass(Site))
                yield site; 
    }

    serialize(): Record<string, any> {
        const obj = super.serialize();
        return {
            ...obj,
            travelCosts: Object.fromEntries([...this.travelCosts.entries()].map(([k, v]) => [k, Object.fromEntries([...v.entries()])]))
        }
    }
}


export class Region extends OathGameObject<RegionKey> {
    type = "region";
    name: string;
    size: number;
    regionKey: RegionKey;
    discard: Discard;

    constructor(name: string, size: number, regionKey: RegionKey) {
        super(regionKey);
        this.name = name;
        this.size = size;
        this.regionKey = regionKey;
        this.discard = this.addChild(new Discard(this));
    }

    get sites() { return this.byClass(Site); }

    serialize(): Record<string, any> | undefined {
        const obj = super.serialize();
        return {
            ...obj,
            name: this.name
        }
    }
}