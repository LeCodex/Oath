import { Site } from "./cards/cards";
import { Discard } from "./cards/decks";
import { RegionKey, RegionSize, isEnumKey } from "./enums";
import { Container, OathGameObject } from "./gameObject";


export class OathMap extends Container<Region, string> {
    type = "map";
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
        super("map", Region);
    }

    get key() { return this.id; }

    nextRegion(region: Region | undefined) {
        if (!region) return undefined;
        const name = this.nextRegionKey.get(region.key);
        if (name === undefined) return undefined;
        return this.byClass(Region).byKey(name)[0];
    }

    *sites() {
        for (const region of this.children)
            for (const site of region.byClass(Site))
                yield site;
    }

    constSerialize(): Record<`_${string}`, any> {
        return {
            ...super.constSerialize(),
            _travelCosts: [...this.travelCosts.entries()].map(([k, v]) => [k, [...v.entries()]])
        }
    }
}


export class Region extends OathGameObject<RegionKey> {
    type = "region";
    readonly id: keyof typeof RegionKey;
    size: number;
    discard: Discard;

    constructor(id: keyof typeof RegionKey) {
        if (!isEnumKey(id, RegionKey)) throw TypeError(`${id} is not a valid region key`);
        super(id);
        this.size = RegionSize[this.key];
    }

    get name() { return this.id; }
    get key() { return RegionKey[this.id]; }
    get sites() { return this.byClass(Site); }
}