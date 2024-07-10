import { CardRestriction } from "../enums";
import { Assassin, AwaitedReturn, Bracken, Curfew, Dazzle, Elders, ForcedLabor, GleamingArmorAttack, GleamingArmorDefense, HeartsAndMinds, InsectSwarmAttack, InsectSwarmDefense, Insomnia, KeyToTheCity, LongbowArchersAttack, LongbowArchersDefense, LostTongue, LostTongueCampaign, OathPower, OnlyTwoAdvisers, RelicThief, ShieldWall, SilverTongue, SpellBreaker, SpellBreakerActive, SpiritSnare, ThreateningRoar, TollRoads, WayStation } from "../power";
import { Denizen } from "./cards";

export const denizenData: StringObject<[string, Constructor<OathPower<Denizen>>[], CardRestriction?, boolean?]> = {
    "LongbowArchers":   ["Longbow Archers",     [LongbowArchersAttack, LongbowArchersDefense]],
    "ShieldWall":       ["Shield Wall",         [ShieldWall]],
    "Curfew":           ["Curfew",              [Curfew], CardRestriction.Site],
    "TollRoads":        ["Toll Roads",          [TollRoads], CardRestriction.Site],
    "ForcedLabor":      ["Forced Labor",        [ForcedLabor], CardRestriction.Site],

    "GleamingArmor":    ["Gleaming Armor",      [GleamingArmorAttack, GleamingArmorDefense]],
    "SpiritSnare":      ["Spirit Snare",        [SpiritSnare]],
    "Dazzle":           ["Dazzle",              [Dazzle]],

    "HeartsAndMinds":   ["Hearts and Minds",    [HeartsAndMinds], CardRestriction.Site],
    "AwaitedReturn":    ["AwaitedReturn",       [AwaitedReturn]],

    "WayStation":       ["Way Station",         [WayStation], CardRestriction.Site],
    "LostTongue":       ["Lost Tongue",         [LostTongue, LostTongueCampaign], CardRestriction.Adviser],
    "Elders":           ["Elders",              [Elders]],
    "SpellBreaker":     ["Spell Breaker",       [SpellBreaker, SpellBreakerActive], CardRestriction.Site],

    "RelicThief":       ["Relic Thief",         [RelicThief]],
    "KeyToTheCity":     ["Key to the City",     [KeyToTheCity], CardRestriction.Site],
    "Assassin":         ["Assassin",            [OnlyTwoAdvisers, Assassin], CardRestriction.Adviser, true],
    "Insomina":         ["Insomnia",            [OnlyTwoAdvisers, Insomnia], CardRestriction.Adviser, true],
    "SilverTongue":     ["Silver Tongue",       [OnlyTwoAdvisers, SilverTongue], CardRestriction.Adviser, true],

    "Bracken":          ["Bracken",             [Bracken]],
    "InsectSwarm":      ["Insect Swarm",        [InsectSwarmAttack, InsectSwarmDefense]],
    "ThreateningRoar":  ["Threatening Roar",    [ThreateningRoar]]
}