import { Site } from "./cards/cards";
import { CardDeck, Discard } from "./cards/decks";
import { sitesData } from "./cards/sites";
import { RegionName } from "./enums";
import { OathGame, OathGameObject } from "./game";

export class OathBoard extends OathGameObject {
    regions = {
        [RegionName.Cradle]: new Region(this.game, "Cradle", 2, RegionName.Cradle),
        [RegionName.Provinces]: new Region(this.game, "Provinces", 3, RegionName.Provinces),
        [RegionName.Hinterland]: new Region(this.game, "Hinterland", 3, RegionName.Hinterland),
    };
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
    siteDeck = new CardDeck<Site>(this.game);

    constructor(game: OathGame) {
        super(game);
        for (const data of Object.values(sitesData))
            this.siteDeck.putCard(new Site(this.game, ...data));
    }

    *sites() {
        for (const region of Object.values(this.regions))
            for (const site of region.sites)
                yield site; 
    }

    nextRegion(region: Region): Region {
        const name = this.nextRegionName.get(region.regionName);
        if (!name) throw new Error(`Couldn't find the next region of ${region.name}`);
        return this.regions[name];
    }
}

export class Region extends OathGameObject {
    name: string;
    sites: Site[];
    discard = new Discard(this.game);
    regionName: RegionName;

    constructor(game: OathGame, name: string, size: number, regionName: RegionName) {
        super(game);
        this.name = name;
        this.regionName = regionName;

        this.sites = [];
        // TEMP: Get random sites and flip the top ones
        for (let i = 0; i < size; i++) {
            const site = this.game.board.siteDeck.drawSingleCard();
            if (!site) return;
            this.sites.push(site);
            if (i == 0) site.reveal();
        }
    }
}