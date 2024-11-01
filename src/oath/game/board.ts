import { Site } from "./cards/cards";
import { Discard } from "./cards/decks";
import { RegionName } from "./enums";
import { Container, OathGameObject } from "./gameObject";


export class OathBoard extends Container<Region, "board"> {
    travelCosts = new Map<RegionName, Map<RegionName, number>>([
        [RegionName.Cradle, new Map([[RegionName.Cradle, 1], [RegionName.Provinces, 2], [RegionName.Hinterland, 4]])],
        [RegionName.Provinces, new Map([[RegionName.Cradle, 2], [RegionName.Provinces, 2], [RegionName.Hinterland, 2]])],
        [RegionName.Hinterland, new Map([[RegionName.Cradle, 4], [RegionName.Provinces, 2], [RegionName.Hinterland, 3]])],
    ]);
    nextRegionName = new Map<RegionName, RegionName>([
        [RegionName.Cradle, RegionName.Provinces],
        [RegionName.Provinces, RegionName.Hinterland],
        [RegionName.Hinterland, RegionName.Cradle],
    ]);

    constructor() {
        super("board", Region);
    }

    nextRegion(region: Region) {
        const name = this.nextRegionName.get(region.regionName);
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
            travelCosts: Object.fromEntries([...this.travelCosts.entries()].map(([k, v]) => [k, Object.fromEntries([...v.entries()])])),
            ...obj
        }
    }
}


export class Region extends OathGameObject<RegionName> {
    name: string;
    size: number;
    regionName: RegionName;
    discard: Discard;

    constructor(name: string, size: number, regionName: RegionName) {
        super(regionName);
        this.name = name;
        this.size = size;
        this.regionName = regionName;
        this.discard = this.addChild(new Discard(regionName));
    }

    get sites() { return this.byClass(Site); }
}