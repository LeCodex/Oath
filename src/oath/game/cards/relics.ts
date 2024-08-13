import { OathPower } from "../powers/powers";
import { BookOfRecords, BrassHorse, CircletOfCommand, CupOfPlenty, CursedCauldronAttack, CursedCauldronDefense, DragonskinWardrum, MapRelic, OracularPig, RingOfDevotionMuster, RingOfDevotionRestriction, SkeletonKey } from "../powers/relics";
import { Constructor } from "../utils";
import { Relic } from "./cards";

export const relicsData: Record<string, [number, Constructor<OathPower<Relic>>[]]> = {
    CircletOfCommand:       [1, [CircletOfCommand]],
    DragonskinWardrum:      [2, [DragonskinWardrum]],
    CupOfPlenty:            [2, [CupOfPlenty]],
    BookOfRecords:          [2, [BookOfRecords]],
    RingOfDevotion:         [2, [RingOfDevotionMuster, RingOfDevotionRestriction]],
    OracularPig:            [2, [OracularPig]],
    BrassHorse:             [2, [BrassHorse]],
    CursedCauldron:         [3, [CursedCauldronAttack, CursedCauldronDefense]],
    SkeletonKey:            [3, [SkeletonKey]],
    Map:                    [3, [MapRelic]],
}