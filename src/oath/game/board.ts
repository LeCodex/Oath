import { Denizen, Site, WorldCard } from "./cards/cards";
import { Discard } from "./cards/decks";
import { CardRestriction, RegionName } from "./enums";
import { OathGame } from "./game";
import { OathGameObject } from "./gameObject";


export class OathBoard extends OathGameObject {
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

    serialize(): Record<string, any> {
        return {
            regions: Object.fromEntries(Object.entries(this.regions).map(([k, v]) => [k, v.serialize()])),
            travelCosts: Object.fromEntries([...this.travelCosts.entries()].map(([k, v]) => [k, Object.fromEntries([...v.entries()])])),
        }
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
            site.region = this;

            if (i == 0) {
                site.reveal();
                const cards: WorldCard[] = [];
                while (true) {
                    const card = this.game.worldDeck.drawSingleCard(true);
                    if (!card) break;
                    
                    if (card instanceof Denizen && card.restriction !== CardRestriction.Adviser) {
                        card.reveal();
                        card.putAtSite(site);
                        break;
                    } else {
                        cards.push(card);
                    }
                }
                
                while (cards.length) {
                    const card = cards.pop();
                    if (card) this.game.worldDeck.putCard(card, true);
                }
            }
        }

        const fromBottom = this.game.worldDeck.drawSingleCard(true);
        if (fromBottom) this.discard.putCard(fromBottom);
    }

    serialize(): Record<string, any> {
        return {
            name: this.name,
            discard: this.discard.serialize(),
            sites: this.sites.map(e => e.serialize())
        };
    }
}