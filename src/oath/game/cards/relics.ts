import { BookOfRecords, CircletOfCommand, CupOfPlenty, DragonskinWardrum, OathPower } from "../power";
import { Constructor, StringObject } from "../utils";
import { Relic } from "./cards";

export const relicsData: StringObject<[string, Constructor<OathPower<Relic>>[], number]> = {
    "DragonskinWardrum":    ["Dragonskin Wardrum",  [DragonskinWardrum],    2],
    "CupOfPlenty":          ["Cup of Plenty",       [CupOfPlenty],          2],
    "CircletOfCommand":     ["Circlet of Command",  [CircletOfCommand],     1],
    "BookOfRecords":        ["Book of Records",     [BookOfRecords],        2]
}