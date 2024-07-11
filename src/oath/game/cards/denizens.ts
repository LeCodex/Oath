import { CardRestriction } from "../enums";
import { Alchemist, Assassin, AwaitedReturn, BookBinders, Bracken, ChaosCult, CharmingFriend, Curfew, Dazzle, Elders, FabledFeast, ForcedLabor, GamblingHall, GleamingArmorAttack, GleamingArmorDefense, HeartsAndMinds, Herald, InsectSwarmAttack, InsectSwarmDefense, Insomnia, KeyToTheCity, LongbowArchersAttack, LongbowArchersDefense, LostTongue, LostTongueCampaign, MarriageAction, MarriageEffect, Naysayers, OathPower, OnlyTwoAdvisers, PiedPiper, PiedPiperActive, RelicThief, RoyalTax, SaddleMakers, ShieldWall, SilverTongue, SleightOfHand, SpellBreaker, SpellBreakerActive, SpiritSnare, ThreateningRoar, TollRoads, Tutor, VowOfObedience, VowOfPoverty, VowOfPovertyRest, WayStation } from "../power";
import { Denizen } from "./cards";

export const denizenData: StringObject<[string, Constructor<OathPower<Denizen>>[], CardRestriction?, boolean?]> = {
    "RelicThief":       ["Relic Thief",         [RelicThief]],
    "KeyToTheCity":     ["Key to the City",     [KeyToTheCity], CardRestriction.Site],
    "Assassin":         ["Assassin",            [OnlyTwoAdvisers, Assassin], CardRestriction.Adviser, true],
    "Insomina":         ["Insomnia",            [OnlyTwoAdvisers, Insomnia], CardRestriction.Adviser, true],
    "SilverTongue":     ["Silver Tongue",       [OnlyTwoAdvisers, SilverTongue], CardRestriction.Adviser, true],
    "SleightOfHand":    ["Sleight of Hand",     [SleightOfHand], CardRestriction.Adviser],
    "Naysayers":        ["Naysayers",           [Naysayers], CardRestriction.Adviser],
    "ChaosCult":        ["Chaos Cult",          [ChaosCult], CardRestriction.Adviser],
    "GamblingHall":     ["Gambling Hall",       [GamblingHall], CardRestriction.Site],

    "GleamingArmor":    ["Gleaming Armor",      [GleamingArmorAttack, GleamingArmorDefense]],
    "SpiritSnare":      ["Spirit Snare",        [SpiritSnare]],
    "Dazzle":           ["Dazzle",              [Dazzle]],
    "Tutor":            ["Tutor",               [Tutor], CardRestriction.Adviser],
    "Alchemist":        ["Alchemist",           [Alchemist]],
    
    "LongbowArchers":   ["Longbow Archers",     [LongbowArchersAttack, LongbowArchersDefense]],
    "ShieldWall":       ["Shield Wall",         [ShieldWall]],
    "Curfew":           ["Curfew",              [Curfew], CardRestriction.Site],
    "TollRoads":        ["Toll Roads",          [TollRoads], CardRestriction.Site],
    "ForcedLabor":      ["Forced Labor",        [ForcedLabor], CardRestriction.Site],
    "RoyalTax":         ["Royal Tax",           [RoyalTax]],
    "VowOfObedience":   ["Vow of Obedience",    [VowOfObedience, VowOfPovertyRest], CardRestriction.Adviser, true],

    "HeartsAndMinds":   ["Hearts and Minds",    [HeartsAndMinds], CardRestriction.Site],
    "AwaitedReturn":    ["AwaitedReturn",       [AwaitedReturn]],
    "CharmingFriend":   ["Charming Friend",     [CharmingFriend], CardRestriction.Adviser],
    "FabledFeast":      ["Fabled Feast",        [FabledFeast]],
    "BookBinders":      ["Book Binders",        [BookBinders], CardRestriction.Adviser],
    "SaddleMakers":     ["Saddle Makers",       [SaddleMakers], CardRestriction.Adviser],
    "Herald":           ["Herald",              [Herald], CardRestriction.Adviser],
    "Marriage":         ["Marriage",            [MarriageAction, MarriageEffect], CardRestriction.Adviser, true],

    "WayStation":       ["Way Station",         [WayStation], CardRestriction.Site],
    "LostTongue":       ["Lost Tongue",         [LostTongue, LostTongueCampaign], CardRestriction.Adviser],
    "Elders":           ["Elders",              [Elders]],
    "SpellBreaker":     ["Spell Breaker",       [SpellBreaker, SpellBreakerActive], CardRestriction.Site],

    "Bracken":          ["Bracken",             [Bracken]],
    "InsectSwarm":      ["Insect Swarm",        [InsectSwarmAttack, InsectSwarmDefense]],
    "ThreateningRoar":  ["Threatening Roar",    [ThreateningRoar]],
    "VowOfPoverty":     ["Vow of Poverty",      [VowOfPoverty, VowOfPovertyRest], CardRestriction.Adviser, true],
    "PiedPiper":        ["PiedPiper",           [PiedPiper, PiedPiperActive], CardRestriction.Adviser],
}