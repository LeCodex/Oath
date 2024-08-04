import { OathPower } from "../powers/powers";
import { BookOfRecords, CircletOfCommand, CupOfPlenty, CursedCauldronAttack, CursedCauldronDefense, DragonskinWardrum, MapRelic, RingOfDevotionMuster, RingOfDevotionRestriction, SkeletonKey } from "../powers/relics";
import { Constructor } from "../utils";
import { Relic } from "./cards";

export const relicsData: Record<string, [string, Constructor<OathPower<Relic>>[], number]> = {
    "CircletOfCommand":     ["Circlet of Command",  [CircletOfCommand],                                 1],
    "DragonskinWardrum":    ["Dragonskin Wardrum",  [DragonskinWardrum],                                2],
    "CupOfPlenty":          ["Cup of Plenty",       [CupOfPlenty],                                      2],
    "BookOfRecords":        ["Book of Records",     [BookOfRecords],                                    2],
    "RingOfDevotion":       ["Ring of Devotion",    [RingOfDevotionMuster, RingOfDevotionRestriction],  2],
    "CursedCauldron":       ["Cursed Cauldron",     [CursedCauldronAttack, CursedCauldronDefense],      3],
    "SkeletonKey":          ["Skeleton Key",        [SkeletonKey],                                      3],
    "Map":                  ["Map",                 [MapRelic],                                         3],
}