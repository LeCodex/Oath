import { DarkestSecret, FavorBank, PeoplesFavor } from "./banks";
import { OathMap, Region } from "./map";
import { Conspiracy, Denizen, Edifice, GrandScepter, Relic, Site, Vision } from "./cards";
import { Discard, RelicDeck, WorldDeck } from "./decks";
import { Oathkeeper } from "./oaths";
import { Reliquary, ReliquarySlot } from "./reliquary";
import { Favor, Warband, Secret } from "./resources";
import { ChancellorBoard, ExileBoard, VisionSlot } from "./player";

export default {
    FavorBank,
    PeoplesFavor,
    DarkestSecret,
    OathMap,
    Region,
    Relic,
    GrandScepter,
    Site,
    Denizen,
    Edifice,
    Vision,
    Conspiracy,
    WorldDeck,
    RelicDeck,
    Discard,
    Oathkeeper: Oath,
    ChancellorBoard,
    Reliquary,
    ReliquarySlot,
    ExileBoard,
    VisionSlot,
    Favor,
    Secret,
    Warband
};