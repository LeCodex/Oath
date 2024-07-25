import { CardRestriction, OathSuit } from "../enums";
import { ActingTroupe, Alchemist, Assassin, AwaitedReturn, BookBinders, Bracken, ChaosCult, CharmingFriend, Curfew, Dazzle, Elders, FabledFeast, FamilyWagon, ForcedLabor, GamblingHall, GleamingArmorAttack, GleamingArmorDefense, HeartsAndMinds, Herald, IgnoresCapacity, InsectSwarmAttack, InsectSwarmDefense, Insomnia, Jinx, KeyToTheCity, LongbowArchersAttack, LongbowArchersDefense, LostTongue, LostTongueCampaign, MarriageActionModifier, MarriageEffectModifier, Naysayers, OathPower, OnlyTwoAdvisers, PiedPiperActive, Portal, RelicThief, RoyalTax, SaddleMakers, ShieldWall, SilverTongue, SleightOfHand, SmallFriends, SpellBreaker, SpiritSnare, ThreateningRoar, TollRoads, Tutor, VowOfObedience, VowOfObedienceRest, VowOfPoverty, VowOfPovertyRest, WayStation } from "../powers";
import { Constructor } from "../utils";
import { Denizen, Edifice } from "./cards";

export type DenizenData = [OathSuit, string, Constructor<OathPower<Denizen>>[], CardRestriction?, boolean?];

export const denizenData: Record<string, DenizenData> = {
    "RelicThief":       [OathSuit.Discord,  "Relic Thief",          [RelicThief]],
    "KeyToTheCity":     [OathSuit.Discord,  "Key to the City",      [KeyToTheCity], CardRestriction.Site],
    "Assassin":         [OathSuit.Discord,  "Assassin",             [OnlyTwoAdvisers, Assassin], CardRestriction.Adviser, true],
    "Insomina":         [OathSuit.Discord,  "Insomnia",             [OnlyTwoAdvisers, Insomnia], CardRestriction.Adviser, true],
    "SilverTongue":     [OathSuit.Discord,  "Silver Tongue",        [OnlyTwoAdvisers, SilverTongue], CardRestriction.Adviser, true],
    "SleightOfHand":    [OathSuit.Discord,  "Sleight of Hand",      [SleightOfHand], CardRestriction.Adviser],
    "Naysayers":        [OathSuit.Discord,  "Naysayers",            [Naysayers], CardRestriction.Adviser],
    "ChaosCult":        [OathSuit.Discord,  "Chaos Cult",           [ChaosCult], CardRestriction.Adviser],
    "GamblingHall":     [OathSuit.Discord,  "Gambling Hall",        [GamblingHall], CardRestriction.Site],

    "GleamingArmor":    [OathSuit.Arcane,   "Gleaming Armor",       [GleamingArmorAttack, GleamingArmorDefense]],
    "SpiritSnare":      [OathSuit.Arcane,   "Spirit Snare",         [SpiritSnare]],
    "Dazzle":           [OathSuit.Arcane,   "Dazzle",               [Dazzle]],
    "Tutor":            [OathSuit.Arcane,   "Tutor",                [Tutor], CardRestriction.Adviser],
    "Alchemist":        [OathSuit.Arcane,   "Alchemist",            [Alchemist]],
    "ActingTroupe":     [OathSuit.Arcane,   "Acting Troupe",        [ActingTroupe], CardRestriction.Adviser],
    "Jinx":             [OathSuit.Arcane,   "Jinx",                 [Jinx]],
    "Portal":           [OathSuit.Arcane,   "Portal",               [Portal], CardRestriction.Site],
    
    "LongbowArchers":   [OathSuit.Order,    "Longbow Archers",      [LongbowArchersAttack, LongbowArchersDefense]],
    "ShieldWall":       [OathSuit.Order,    "Shield Wall",          [ShieldWall]],
    "Curfew":           [OathSuit.Order,    "Curfew",               [Curfew], CardRestriction.Site],
    "TollRoads":        [OathSuit.Order,    "Toll Roads",           [TollRoads], CardRestriction.Site],
    "ForcedLabor":      [OathSuit.Order,    "Forced Labor",         [ForcedLabor], CardRestriction.Site],
    "RoyalTax":         [OathSuit.Order,    "Royal Tax",            [RoyalTax]],
    "VowOfObedience":   [OathSuit.Order,    "Vow of Obedience",     [VowOfObedience, VowOfObedienceRest], CardRestriction.Adviser, true],

    "HeartsAndMinds":   [OathSuit.Hearth,   "Hearts and Minds",     [HeartsAndMinds], CardRestriction.Site],
    "AwaitedReturn":    [OathSuit.Hearth,   "Awaited Return",       [AwaitedReturn]],
    "CharmingFriend":   [OathSuit.Hearth,   "Charming Friend",      [CharmingFriend], CardRestriction.Adviser],
    "FabledFeast":      [OathSuit.Hearth,   "Fabled Feast",         [FabledFeast]],
    "BookBinders":      [OathSuit.Hearth,   "Book Binders",         [BookBinders], CardRestriction.Adviser],
    "SaddleMakers":     [OathSuit.Hearth,   "Saddle Makers",        [SaddleMakers], CardRestriction.Adviser],
    "Herald":           [OathSuit.Hearth,   "Herald",               [Herald], CardRestriction.Adviser],
    "Marriage":         [OathSuit.Hearth,   "Marriage",             [MarriageActionModifier, MarriageEffectModifier], CardRestriction.Adviser, true],
    
    "Bracken":          [OathSuit.Beast,    "Bracken",              [Bracken]],
    "InsectSwarm":      [OathSuit.Beast,    "Insect Swarm",         [InsectSwarmAttack, InsectSwarmDefense]],
    "ThreateningRoar":  [OathSuit.Beast,    "Threatening Roar",     [ThreateningRoar]],
    "VowOfPoverty":     [OathSuit.Beast,    "Vow of Poverty",       [VowOfPoverty, VowOfPovertyRest], CardRestriction.Adviser, true],
    "PiedPiper":        [OathSuit.Beast,    "Pied Piper",           [IgnoresCapacity, PiedPiperActive], CardRestriction.Adviser],
    "SmallFriend":      [OathSuit.Beast,    "Small Friends",        [SmallFriends], CardRestriction.Adviser],

    "WayStation":       [OathSuit.Nomad,    "Way Station",          [WayStation], CardRestriction.Site],
    "LostTongue":       [OathSuit.Nomad,    "Lost Tongue",          [LostTongue, LostTongueCampaign], CardRestriction.Adviser],
    "Elders":           [OathSuit.Nomad,    "Elders",               [Elders]],
    "SpellBreaker":     [OathSuit.Nomad,    "Spell Breaker",        [SpellBreaker], CardRestriction.Site],
    "FamilyWagon":      [OathSuit.Nomad,    "Family Wagon",         [FamilyWagon], CardRestriction.Adviser],
}

export const edificeData: Record<string, [OathSuit, [string, Constructor<OathPower<Edifice>>[]], [string, Constructor<OathPower<Edifice>>[]]]> = {
    "FestivalDistrict": [OathSuit.Discord,  ["Festival District",   []],    ["Squalid District",    []]],
    "GreatSpire":       [OathSuit.Arcane,   ["Great Spire",         []],    ["Fallen Spire",        []]],
    "SprawlingRampart": [OathSuit.Order,    ["Sprawling Rampart",   []],    ["Bandit Rampart",      []]],
    "HallOfDebate":     [OathSuit.Hearth,   ["Hall of Debate",      []],    ["Hall of Mockery",     []]],
    "ForestTemple":     [OathSuit.Beast,    ["Forest Temple",       []],    ["Ruined Temple",       []]],
    "AncientForge":     [OathSuit.Nomad,    ["Ancient Forge",       []],    ["Broken Forge",        []]],
}