import { CardRestriction, OathSuit } from "../enums";
import { OathPower } from "../powers/powers";
import { ActingTroupe, Alchemist, Assassin, AwaitedReturn, BookBinders, Bracken, ChaosCult, CharmingFriend, Curfew, Dazzle, Elders, FabledFeast, FamilyWagon, ForcedLabor, GamblingHall, GleamingArmorAttack, GleamingArmorDefense, HeartsAndMinds, Herald, IgnoresCapacity, InsectSwarmAttack, InsectSwarmDefense, Insomnia, Jinx, KeyToTheCity, LongbowsAttack, LongbowsDefense, LostTongue, LostTongueCampaign, MarriageActionModifier, MarriageEffectModifier, Naysayers, OnlyTwoAdvisers, PiedPiperActive, Portal, RelicThief, RoyalTax, SaddleMakers, ShieldWall, SilverTongue, SleightOfHand, SmallFriends, SpellBreaker, SpiritSnare, ThreateningRoar, TollRoads, Tutor, VowOfObedience, VowOfObedienceRest, VowOfPoverty, VowOfPovertyRest, WayStation } from "../powers/denizens";
import { Constructor } from "../utils";
import { Denizen, Edifice } from "./cards";

export type DenizenData = [OathSuit, Constructor<OathPower<Denizen>>[], CardRestriction?, boolean?];

export const denizenData: Record<string, DenizenData> = {
    RelicThief:         [OathSuit.Discord,  [RelicThief]],
    KeyToTheCity:       [OathSuit.Discord,  [KeyToTheCity], CardRestriction.Site],
    Assassin:           [OathSuit.Discord,  [OnlyTwoAdvisers, Assassin], CardRestriction.Adviser, true],
    Insomina:           [OathSuit.Discord,  [OnlyTwoAdvisers, Insomnia], CardRestriction.Adviser, true],
    SilverTongue:       [OathSuit.Discord,  [OnlyTwoAdvisers, SilverTongue], CardRestriction.Adviser, true],
    SleightOfHand:      [OathSuit.Discord,  [SleightOfHand], CardRestriction.Adviser],
    Naysayers:          [OathSuit.Discord,  [Naysayers], CardRestriction.Adviser],
    ChaosCult:          [OathSuit.Discord,  [ChaosCult], CardRestriction.Adviser],
    GamblingHall:       [OathSuit.Discord,  [GamblingHall], CardRestriction.Site],
    
    GleamingArmor:      [OathSuit.Arcane,   [GleamingArmorAttack, GleamingArmorDefense]],
    SpiritSnare:        [OathSuit.Arcane,   [SpiritSnare]],
    Dazzle:             [OathSuit.Arcane,   [Dazzle]],
    Tutor:              [OathSuit.Arcane,   [Tutor], CardRestriction.Adviser],
    Alchemist:          [OathSuit.Arcane,   [Alchemist]],
    Jinx:               [OathSuit.Arcane,   [Jinx]],
    Portal:             [OathSuit.Arcane,   [Portal], CardRestriction.Site],
    ActingTroupe:       [OathSuit.Arcane,   [ActingTroupe], CardRestriction.Adviser],
    
    Longbows:           [OathSuit.Order,    [LongbowsAttack, LongbowsDefense]],
    ShieldWall:         [OathSuit.Order,    [ShieldWall]],
    Curfew:             [OathSuit.Order,    [Curfew], CardRestriction.Site],
    TollRoads:          [OathSuit.Order,    [TollRoads], CardRestriction.Site],
    ForcedLabor:        [OathSuit.Order,    [ForcedLabor], CardRestriction.Site],
    RoyalTax:           [OathSuit.Order,    [RoyalTax]],
    VowOfObedience:     [OathSuit.Order,    [VowOfObedience, VowOfObedienceRest], CardRestriction.Adviser, true],
    
    HeartsAndMinds:     [OathSuit.Hearth,   [HeartsAndMinds], CardRestriction.Site],
    AwaitedReturn:      [OathSuit.Hearth,   [AwaitedReturn]],
    CharmingFriend:     [OathSuit.Hearth,   [CharmingFriend], CardRestriction.Adviser],
    FabledFeast:        [OathSuit.Hearth,   [FabledFeast]],
    BookBinders:        [OathSuit.Hearth,   [BookBinders], CardRestriction.Adviser],
    SaddleMakers:       [OathSuit.Hearth,   [SaddleMakers], CardRestriction.Adviser],
    Herald:             [OathSuit.Hearth,   [Herald], CardRestriction.Adviser],
    Marriage:           [OathSuit.Hearth,   [MarriageActionModifier, MarriageEffectModifier], CardRestriction.Adviser, true],
    
    SmallFriends:       [OathSuit.Beast,    [SmallFriends], CardRestriction.Adviser],
    Bracken:            [OathSuit.Beast,    [Bracken]],
    InsectSwarm:        [OathSuit.Beast,    [InsectSwarmAttack, InsectSwarmDefense]],
    ThreateningRoar:    [OathSuit.Beast,    [ThreateningRoar]],
    VowOfPoverty:       [OathSuit.Beast,    [VowOfPoverty, VowOfPovertyRest], CardRestriction.Adviser, true],
    PiedPiper:          [OathSuit.Beast,    [IgnoresCapacity, PiedPiperActive], CardRestriction.Adviser],
    
    WayStation:         [OathSuit.Nomad,    [WayStation], CardRestriction.Site],
    LostTongue:         [OathSuit.Nomad,    [LostTongue, LostTongueCampaign], CardRestriction.Adviser],
    Elders:             [OathSuit.Nomad,    [Elders]],
    SpellBreaker:       [OathSuit.Nomad,    [SpellBreaker], CardRestriction.Site],
    FamilyWagon:        [OathSuit.Nomad,    [FamilyWagon], CardRestriction.Adviser],
}

export const edificeData: Record<string, [string, OathSuit, Constructor<OathPower<Edifice>>[]]> = {
    FestivalDistrict:   ["SqualidDistrict",     OathSuit.Discord,  []],
    SqualidDistrict:    ["FestivalDistrict",    OathSuit.None,     []],
    GreatSpire:         ["FallenSpire",         OathSuit.Arcane,   []],
    FallenSpire:        ["GreatSpire",          OathSuit.None,     []],
    SprawlingRampart:   ["BanditRampart",       OathSuit.Order,    []],
    BanditRampart:      ["SprawlingRampart",    OathSuit.None,     []],
    HallOfDebate:       ["HallOfMockery",       OathSuit.Hearth,   []],
    HallOfMockery:      ["HallOfDebate",        OathSuit.None,     []],
    ForestTemple:       ["RuinedTemple",        OathSuit.Beast,    []],
    RuinedTemple:       ["ForestTemple",        OathSuit.None,     []],
    AncientForge:       ["BrokenForge",         OathSuit.Nomad,    []],
    BrokenForge:        ["AncientForge",        OathSuit.None,     []]
}