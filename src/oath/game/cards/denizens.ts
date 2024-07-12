import { CardRestriction, OathSuit } from "../enums";
import { ActingTroupe, Alchemist, Assassin, AwaitedReturn, BookBinders, Bracken, ChaosCult, CharmingFriend, Curfew, Dazzle, Elders, FabledFeast, ForcedLabor, GamblingHall, GleamingArmorAttack, GleamingArmorDefense, HeartsAndMinds, Herald, InsectSwarmAttack, InsectSwarmDefense, Insomnia, KeyToTheCity, LongbowArchersAttack, LongbowArchersDefense, LostTongue, LostTongueCampaign, MarriageAction, MarriageEffect, Naysayers, OathPower, OnlyTwoAdvisers, PiedPiper, PiedPiperActive, RelicThief, RoyalTax, SaddleMakers, ShieldWall, SilverTongue, SleightOfHand, SpellBreaker, SpellBreakerActive, SpiritSnare, ThreateningRoar, TollRoads, Tutor, VowOfObedience, VowOfPoverty, VowOfPovertyRest, WayStation } from "../power";
import { Constructor, StringObject } from "../utils";
import { Denizen } from "./cards";

export const denizenData: StringObject<[string, OathSuit, Constructor<OathPower<Denizen>>[], CardRestriction?, boolean?]> = {
    "RelicThief":       ["Relic Thief",         OathSuit.Discord,   [RelicThief]],
    "KeyToTheCity":     ["Key to the City",     OathSuit.Discord,   [KeyToTheCity], CardRestriction.Site],
    "Assassin":         ["Assassin",            OathSuit.Discord,   [OnlyTwoAdvisers, Assassin], CardRestriction.Adviser, true],
    "Insomina":         ["Insomnia",            OathSuit.Discord,   [OnlyTwoAdvisers, Insomnia], CardRestriction.Adviser, true],
    "SilverTongue":     ["Silver Tongue",       OathSuit.Discord,   [OnlyTwoAdvisers, SilverTongue], CardRestriction.Adviser, true],
    "SleightOfHand":    ["Sleight of Hand",     OathSuit.Discord,   [SleightOfHand], CardRestriction.Adviser],
    "Naysayers":        ["Naysayers",           OathSuit.Discord,   [Naysayers], CardRestriction.Adviser],
    "ChaosCult":        ["Chaos Cult",          OathSuit.Discord,   [ChaosCult], CardRestriction.Adviser],
    "GamblingHall":     ["Gambling Hall",       OathSuit.Discord,   [GamblingHall], CardRestriction.Site],

    "GleamingArmor":    ["Gleaming Armor",      OathSuit.Arcane,    [GleamingArmorAttack, GleamingArmorDefense]],
    "SpiritSnare":      ["Spirit Snare",        OathSuit.Arcane,    [SpiritSnare]],
    "Dazzle":           ["Dazzle",              OathSuit.Arcane,    [Dazzle]],
    "Tutor":            ["Tutor",               OathSuit.Arcane,    [Tutor], CardRestriction.Adviser],
    "Alchemist":        ["Alchemist",           OathSuit.Arcane,    [Alchemist]],
    "ActingTroupe":     ["Acting Troupe",       OathSuit.Arcane,    [ActingTroupe], CardRestriction.Adviser],
    
    "LongbowArchers":   ["Longbow Archers",     OathSuit.Order,     [LongbowArchersAttack, LongbowArchersDefense]],
    "ShieldWall":       ["Shield Wall",         OathSuit.Order,     [ShieldWall]],
    "Curfew":           ["Curfew",              OathSuit.Order,     [Curfew], CardRestriction.Site],
    "TollRoads":        ["Toll Roads",          OathSuit.Order,     [TollRoads], CardRestriction.Site],
    "ForcedLabor":      ["Forced Labor",        OathSuit.Order,     [ForcedLabor], CardRestriction.Site],
    "RoyalTax":         ["Royal Tax",           OathSuit.Order,     [RoyalTax]],
    "VowOfObedience":   ["Vow of Obedience",    OathSuit.Order,     [VowOfObedience, VowOfPovertyRest], CardRestriction.Adviser, true],

    "HeartsAndMinds":   ["Hearts and Minds",    OathSuit.Hearth,    [HeartsAndMinds], CardRestriction.Site],
    "AwaitedReturn":    ["AwaitedReturn",       OathSuit.Hearth,    [AwaitedReturn]],
    "CharmingFriend":   ["Charming Friend",     OathSuit.Hearth,    [CharmingFriend], CardRestriction.Adviser],
    "FabledFeast":      ["Fabled Feast",        OathSuit.Hearth,    [FabledFeast]],
    "BookBinders":      ["Book Binders",        OathSuit.Hearth,    [BookBinders], CardRestriction.Adviser],
    "SaddleMakers":     ["Saddle Makers",       OathSuit.Hearth,    [SaddleMakers], CardRestriction.Adviser],
    "Herald":           ["Herald",              OathSuit.Hearth,    [Herald], CardRestriction.Adviser],
    "Marriage":         ["Marriage",            OathSuit.Hearth,    [MarriageAction, MarriageEffect], CardRestriction.Adviser, true],

    "WayStation":       ["Way Station",         OathSuit.Nomad,     [WayStation], CardRestriction.Site],
    "LostTongue":       ["Lost Tongue",         OathSuit.Nomad,     [LostTongue, LostTongueCampaign], CardRestriction.Adviser],
    "Elders":           ["Elders",              OathSuit.Nomad,     [Elders]],
    "SpellBreaker":     ["Spell Breaker",       OathSuit.Nomad,     [SpellBreaker, SpellBreakerActive], CardRestriction.Site],

    "Bracken":          ["Bracken",             OathSuit.Beast,     [Bracken]],
    "InsectSwarm":      ["Insect Swarm",        OathSuit.Beast,     [InsectSwarmAttack, InsectSwarmDefense]],
    "ThreateningRoar":  ["Threatening Roar",    OathSuit.Beast,     [ThreateningRoar]],
    "VowOfPoverty":     ["Vow of Poverty",      OathSuit.Beast,     [VowOfPoverty, VowOfPovertyRest], CardRestriction.Adviser, true],
    "PiedPiper":        ["PiedPiper",           OathSuit.Beast,     [PiedPiper, PiedPiperActive], CardRestriction.Adviser],
}