import { CircletOfCommand, CupOfPlenty, DragonskinWardrum, OathPower } from "../power";
import { Relic } from "./cards";

export const relicsData: StringObject<[string, Constructor<OathPower<Relic>>[], number]> = {
    "DragonskinWardrum":    ["Dragonskin Wardrum",  [DragonskinWardrum],    2],
    "CupOfPlenty":          ["Cup of Plenty",       [CupOfPlenty],          2],
    "CircletOfCommand":     ["Circlet of Command",  [CircletOfCommand],     1]
}