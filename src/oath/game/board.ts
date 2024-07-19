import { Site } from "./cards/cards";
import { Discard } from "./cards/decks";
import { RegionName } from "./enums";
import { OathGame } from "./game";
import { OathGameObject } from "./gameObject";


export class OathBoard extends OathGameObject {
    travelCosts: Map<RegionName, Map<RegionName, number>>;
    nextRegionName = new Map<RegionName, RegionName>([
        [RegionName.Cradle, RegionName.Provinces],
        [RegionName.Provinces, RegionName.Hinterland],
        [RegionName.Hinterland, RegionName.Cradle],
    ]);
    regions: Record<RegionName, Region> = {
        [RegionName.Cradle]: new Region(this.game, "Cradle", 2, RegionName.Cradle),
        [RegionName.Provinces]: new Region(this.game, "Provinces", 3, RegionName.Provinces),
        [RegionName.Hinterland]: new Region(this.game, "Hinterland", 3, RegionName.Hinterland),
    };

    nextRegion(region: Region): Region {
        const name = this.nextRegionName.get(region.regionName);
        if (!name) throw new Error(`Couldn't find the next region of ${region.name}`);
        return this.regions[name];
    }

    *sites() {
        for (const region of Object.values(this.regions))
            for (const site of region.sites)
                yield site; 
    }
}


export class Region extends OathGameObject {
    name: string;
    regionName: RegionName;
    sites: Site[];
    discard = new Discard(this.game);

    constructor(game: OathGame, name: string, size: number, regionName: RegionName) {
        super(game);
        this.name = name;
        this.regionName = regionName;

        this.sites = [];
        // TEMP: Get random sites and flip the top ones
        for (let i = 0; i < size; i++) {
            const site = this.game.siteDeck.drawSingleCard();
            if (!site) return;
            this.sites.push(site);
            if (i == 0) site.reveal();
        }
    }
}