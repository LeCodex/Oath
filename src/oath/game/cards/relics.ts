import type { RelicName } from "../parser/interfaces";
import type { RelicPowerName } from "../powers/classIndex";

export type RelicName = keyof typeof RelicName;
export const relicsData: Record<RelicName, [number, RelicPowerName[]]> = {
    CircletOfCommand:   [1, ["CircletOfCommand"]],
    DragonskinDrum:     [2, ["DragonskinDrum"]],
    CupOfPlenty:        [2, ["CupOfPlenty"]],
    BookOfRecords:      [2, ["BookOfRecords"]],
    OracularPig:        [2, ["OracularPig"]],
    BrassHorse:         [2, ["BrassHorse"]],
    StickyFire:         [2, ["StickyFireAttack", "StickyFireDefense"]],
    TruthfulHarp:       [2, ["TruthfulHarp"]],
    GrandMask:          [2, ["GrandMask"]],
    HornedMask:         [2, ["HornedMask"]],
    Whistle:            [2, ["Whistle"]],
    CrackedHorn:        [2, ["CrackedHorn"]],
    IvoryEye:           [2, ["IvoryEye"]],
    ObsidianCage:       [2, ["ObsidianCageAttack", "ObsidianCageDefense", "ObsidianCageActive"]],
    RingOfDevotion:     [3, ["RingOfDevotionMuster", "RingOfDevotionRestriction"]],
    CursedCauldron:     [3, ["CursedCauldronAttack", "CursedCauldronDefense"]],
    SkeletonKey:        [3, ["SkeletonKey"]],
    Map:                [3, ["MapRelic"]],
    DowsingSticks:      [3, ["DowsingSticks"]],
    BanditCrown:        [3, ["BanditCrown"]],

    // TODO: Add allowing peeking for other players
    GrandScepter:       [5, ["GrandScepterSeize", "GrandScepterRest", "GrandScepterPeek", "GrandScepterGrantCitizenship", "GrandScepterExileCitizen"]]
}
