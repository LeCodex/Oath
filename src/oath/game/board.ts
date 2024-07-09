import { Site, WorldCard } from "./cards/cards";
import { Discard } from "./cards/decks";
import { RegionName } from "./enums";
import { OathGameObject } from "./game";

export class OathBoard extends OathGameObject {
    regions: Map<RegionName, Region>;
}

export class Region extends OathGameObject {
    name: string;
    sites: Site[];
    discard: Discard;
    nextRegion: Region;
    travelCosts: Map<Region, number>;

    discardFromHere(card: WorldCard) {
        this.nextRegion.discard.putCard(card);
    }
}