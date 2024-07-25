import { OathPower } from "../powers/powers";
import { BookOfRecords, CircletOfCommand, CupOfPlenty, CursedCauldronAttack, CursedCauldronDefense, DragonskinWardrum } from "../powers/relics";
import { Constructor } from "../utils";
import { Relic } from "./cards";

export const relicsData: Record<string, [string, Constructor<OathPower<Relic>>[], number]> = {
    "DragonskinWardrum":    ["Dragonskin Wardrum",  [DragonskinWardrum],                            2],
    "CupOfPlenty":          ["Cup of Plenty",       [CupOfPlenty],                                  2],
    "CircletOfCommand":     ["Circlet of Command",  [CircletOfCommand],                             1],
    "BookOfRecords":        ["Book of Records",     [BookOfRecords],                                2],
    "CursedCauldron":       ["Cursed Cauldron",     [CursedCauldronAttack, CursedCauldronDefense],  3]
}