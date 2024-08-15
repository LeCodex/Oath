import { OathPower } from "../powers/powers";
import { BookOfRecords, BrassHorse, CircletOfCommand, CrackedHorn, CupOfPlenty, CursedCauldronAttack, CursedCauldronDefense, DowsingSticks, DragonskinDrum, MapRelic, ObsidianCageActive, ObsidianCageAttack, ObsidianCageDefense, OracularPig, RingOfDevotionMuster, RingOfDevotionRestriction, SkeletonKey, TruthfulHarp } from "../powers/relics";
import { Constructor } from "../utils";
import { Relic } from "./cards";

export const relicsData: Record<string, [number, Constructor<OathPower<Relic>>[]]> = {
    CircletOfCommand:   [1, [CircletOfCommand]],
    DragonskinDrum:     [2, [DragonskinDrum]],
    CupOfPlenty:        [2, [CupOfPlenty]],
    BookOfRecords:      [2, [BookOfRecords]],
    OracularPig:        [2, [OracularPig]],
    BrassHorse:         [2, [BrassHorse]],
    StickyFire:         [2, []],
    TruthfulHarp:       [2, [TruthfulHarp]],
    GrandMask:          [2, []],
    HornedMask:         [2, []],
    Whistle:            [2, []],
    CrackedHorn:        [2, [CrackedHorn]],
    IvoryEye:           [2, []],
    ObsidianCage:       [2, [ObsidianCageAttack, ObsidianCageDefense, ObsidianCageActive]],
    RingOfDevotion:     [3, [RingOfDevotionMuster, RingOfDevotionRestriction]],
    CursedCauldron:     [3, [CursedCauldronAttack, CursedCauldronDefense]],
    SkeletonKey:        [3, [SkeletonKey]],
    Map:                [3, [MapRelic]],
    DowsingSticks:      [3, [DowsingSticks]],
    BanditCrown:        [3, []],
}