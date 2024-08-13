import { CardRestriction, OathSuit } from "../enums";
import { OathPower } from "../powers/powers";
import { ActingTroupe, Alchemist, Assassin, AwaitedReturn, BookBinders, Bracken, ChaosCult, CharmingFriend, Curfew, Dazzle, Elders, FabledFeast, FamilyWagon, ForcedLabor, GamblingHall, GleamingArmorAttack, GleamingArmorDefense, HeartsAndMinds, Herald, IgnoresCapacity, InsectSwarmAttack, InsectSwarmDefense, Insomnia, Jinx, KeyToTheCity, LongbowsAttack, LongbowsDefense, LostTongue, LostTongueCampaign, MarriageActionModifier, MarriageEffectModifier, Naysayers, OnlyTwoAdvisers, PiedPiperActive, Portal, RelicThief, RoyalTax, SaddleMakers, ShieldWall, SilverTongue, SleightOfHand, SmallFriends, SpellBreaker, SpiritSnare, ThreateningRoar, TollRoads, Tutor, VowOfObedience, VowOfObedienceRest, VowOfPoverty, VowOfPovertyRest, WayStation } from "../powers/denizens";
import { Constructor } from "../utils";
import { Denizen, Edifice } from "./cards";

export type DenizenData = [OathSuit, Constructor<OathPower<Denizen>>[], CardRestriction?, boolean?];

export const denizenData: Record<string, DenizenData> = {
    SleightOfHand:      [OathSuit.Discord,  [SleightOfHand], CardRestriction.Adviser],
    Naysayers:          [OathSuit.Discord,  [Naysayers], CardRestriction.Adviser],
    ChaosCult:          [OathSuit.Discord,  [ChaosCult], CardRestriction.Adviser],
    BeastTamer:         [OathSuit.Discord,  [], CardRestriction.Adviser],
    Enchantress:        [OathSuit.Discord,  [], CardRestriction.Adviser],
    SneakAttack:        [OathSuit.Discord,  [], CardRestriction.Adviser],
    Assassin:           [OathSuit.Discord,  [OnlyTwoAdvisers, Assassin], CardRestriction.Adviser, true],
    Insomnia:           [OathSuit.Discord,  [OnlyTwoAdvisers, Insomnia], CardRestriction.Adviser, true],
    SilverTongue:       [OathSuit.Discord,  [OnlyTwoAdvisers, SilverTongue], CardRestriction.Adviser, true],
    ASmallFavor:        [OathSuit.Discord,  [], CardRestriction.Adviser, true],
    FalseProphet:       [OathSuit.Discord,  [], CardRestriction.Adviser, true],
    VowOfRenewal:       [OathSuit.Discord,  [], CardRestriction.Adviser, true],
    RoyalAmbitions:     [OathSuit.Discord,  [], CardRestriction.Adviser, true],
    KeyToTheCity:       [OathSuit.Discord,  [KeyToTheCity], CardRestriction.Site],
    GamblingHall:       [OathSuit.Discord,  [GamblingHall], CardRestriction.Site],
    Gossip:             [OathSuit.Discord,  [], CardRestriction.Site],
    BanditChief:        [OathSuit.Discord,  [], CardRestriction.Site],
    SaltTheEarth:       [OathSuit.Discord,  [IgnoresCapacity], CardRestriction.Site, true],
    BoilingLake:        [OathSuit.Discord,  [], CardRestriction.Site, true],
    RelicThief:         [OathSuit.Discord,  [RelicThief]],
    Mercenaries:        [OathSuit.Discord,  []],
    SecondWind:         [OathSuit.Discord,  []],
    DisgracedCaptain:   [OathSuit.Discord,  []],
    CrackedSage:        [OathSuit.Discord,  []],
    BookBurning:        [OathSuit.Discord,  []],
    Zealots:            [OathSuit.Discord,  []],
    Slander:            [OathSuit.Discord,  []],
    Scryer:             [OathSuit.Discord,  []],
    Downtrodden:        [OathSuit.Discord,  []],
    Charlatan:          [OathSuit.Discord,  []],
    Blackmail:          [OathSuit.Discord,  []],
    Dissent:            [OathSuit.Discord,  []],
    Riots:              [OathSuit.Discord,  []],
    
    Tutor:              [OathSuit.Arcane,   [Tutor], CardRestriction.Adviser],
    ActingTroupe:       [OathSuit.Arcane,   [ActingTroupe], CardRestriction.Adviser],
    SecretSignal:       [OathSuit.Arcane,   [], CardRestriction.Adviser],
    MasterOfDisguise:   [OathSuit.Arcane,   [], CardRestriction.Adviser],
    SealingWard:        [OathSuit.Arcane,   [], CardRestriction.Adviser, true],
    InitiationRite:     [OathSuit.Arcane,   [], CardRestriction.Adviser, true],
    VowOfSilence:       [OathSuit.Arcane,   [], CardRestriction.Adviser, true],
    Portal:             [OathSuit.Arcane,   [Portal], CardRestriction.Site],
    WizardSchool:       [OathSuit.Arcane,   [], CardRestriction.Site],
    ForgottenVault:     [OathSuit.Arcane,   [], CardRestriction.Site],
    MapLibrary:         [OathSuit.Arcane,   [], CardRestriction.Site],
    FireTalkers:        [OathSuit.Arcane,   []],
    RustingRay:         [OathSuit.Arcane,   []],
    BillowingFog:       [OathSuit.Arcane,   []],
    KindredWarriors:    [OathSuit.Arcane,   []],
    CrackingGround:     [OathSuit.Arcane,   []],
    GleamingArmor:      [OathSuit.Arcane,   [GleamingArmorAttack, GleamingArmorDefense]],
    SpiritSnare:        [OathSuit.Arcane,   [SpiritSnare]],
    Alchemist:          [OathSuit.Arcane,   [Alchemist]],
    Jinx:               [OathSuit.Arcane,   [Jinx]],
    MagiciansCode:      [OathSuit.Arcane,   []],
    TamingCharm:        [OathSuit.Arcane,   []],
    Inquisitor:         [OathSuit.Arcane,   []],
    Augury:             [OathSuit.Arcane,   []],
    TerrorSpells:       [OathSuit.Arcane,   []],
    BloodPact:          [OathSuit.Arcane,   []],
    Observatory:        [OathSuit.Arcane,   []],
    PlagueEngines:      [OathSuit.Arcane,   []],
    DreamThief:         [OathSuit.Arcane,   []],
    WitchsBargain:      [OathSuit.Arcane,   []],
    Dazzle:             [OathSuit.Arcane,   [Dazzle]],
    Revelation:         [OathSuit.Arcane,   []],
    Bewitch:            [OathSuit.Arcane,   []],
    
    Palanquin:          [OathSuit.Order,    [], CardRestriction.Adviser],
    Tyrant:             [OathSuit.Order,    [], CardRestriction.Adviser, true],
    CouncilSeat:        [OathSuit.Order,    [], CardRestriction.Adviser, true],
    VowOfObedience:     [OathSuit.Order,    [VowOfObedience, VowOfObedienceRest], CardRestriction.Adviser, true],
    Curfew:             [OathSuit.Order,    [Curfew], CardRestriction.Site],
    TollRoads:          [OathSuit.Order,    [TollRoads], CardRestriction.Site],
    ForcedLabor:        [OathSuit.Order,    [ForcedLabor], CardRestriction.Site],
    SecretPolice:       [OathSuit.Order,    [], CardRestriction.Site],
    TomeGuardians:      [OathSuit.Order,    [], CardRestriction.Site],
    Keep:               [OathSuit.Order,    [], CardRestriction.Site, true],
    Longbows:           [OathSuit.Order,    [LongbowsAttack, LongbowsDefense]],
    ShieldWall:         [OathSuit.Order,    [ShieldWall]],
    Wrestlers:          [OathSuit.Order,    []],
    BattleHonors:       [OathSuit.Order,    []],
    BearTraps:          [OathSuit.Order,    []],
    Scouts:             [OathSuit.Order,    []],
    MartialCulture:     [OathSuit.Order,    []],
    CodeOfHonor:        [OathSuit.Order,    []],
    Outriders:          [OathSuit.Order,    []],
    FieldPromotion:     [OathSuit.Order,    []],
    MilitaryParade:     [OathSuit.Order,    []],
    Specialist:         [OathSuit.Order,    []],
    Encirclement:       [OathSuit.Order,    []],
    PeaceEnvoy:         [OathSuit.Order,    []],
    RelicHunter:        [OathSuit.Order,    []],
    Pressgangs:         [OathSuit.Order,    []],
    Messenger:          [OathSuit.Order,    []],
    Captains:           [OathSuit.Order,    []],
    SiegeEngines:       [OathSuit.Order,    []],
    KnightsErrant:      [OathSuit.Order,    []],
    HuntingParty:       [OathSuit.Order,    []],
    RoyalTax:           [OathSuit.Order,    [RoyalTax]],
    Garrison:           [OathSuit.Order,    []],
    
    CharmingFriend:     [OathSuit.Hearth,   [CharmingFriend], CardRestriction.Adviser],
    SaddleMakers:       [OathSuit.Hearth,   [SaddleMakers], CardRestriction.Adviser],
    BookBinders:        [OathSuit.Hearth,   [BookBinders], CardRestriction.Adviser],
    Herald:             [OathSuit.Hearth,   [Herald], CardRestriction.Adviser],
    Marriage:           [OathSuit.Hearth,   [MarriageActionModifier, MarriageEffectModifier], CardRestriction.Adviser, true],
    FamilyHeirloom:     [OathSuit.Hearth,   [], CardRestriction.Adviser, true],
    VowOfPeace:         [OathSuit.Hearth,   [], CardRestriction.Adviser, true],
    HeartsAndMinds:     [OathSuit.Hearth,   [HeartsAndMinds], CardRestriction.Site],
    VillageConstable:   [OathSuit.Hearth,   [], CardRestriction.Site],
    Hospital:           [OathSuit.Hearth,   [], CardRestriction.Site],
    TinkersFair:        [OathSuit.Hearth,   [], CardRestriction.Site],
    WaysideInn:         [OathSuit.Hearth,   [], CardRestriction.Site],
    WelcomingParty:     [OathSuit.Hearth,   [], CardRestriction.Site],
    ArmedMob:           [OathSuit.Hearth,   [], CardRestriction.Site],
    BallotBox:          [OathSuit.Hearth,   [], CardRestriction.Site],
    RowdyPub:           [OathSuit.Hearth,   [], CardRestriction.Site],
    ARoundOfAle:        [OathSuit.Hearth,   [], CardRestriction.Site, true],
    ExtraProvisions:    [OathSuit.Hearth,   []],
    TravelingDoctor:    [OathSuit.Hearth,   []],
    TheGreatLevy:       [OathSuit.Hearth,   []],
    AwaitedReturn:      [OathSuit.Hearth,   [AwaitedReturn]],
    MemoryOfHome:       [OathSuit.Hearth,   []],
    Storyteller:        [OathSuit.Hearth,   []],
    TavernSongs:        [OathSuit.Hearth,   []],
    Homesteaders:       [OathSuit.Hearth,   []],
    CropRotation:       [OathSuit.Hearth,   []],
    LandWarden:         [OathSuit.Hearth,   []],
    NewsFromAfar:       [OathSuit.Hearth,   []],
    Levelers:           [OathSuit.Hearth,   []],
    RelicBreaker:       [OathSuit.Hearth,   []],
    DeadWriter:         [OathSuit.Hearth,   []],
    FabledFeast:        [OathSuit.Hearth,   [FabledFeast]],
    SaladDays:          [OathSuit.Hearth,   []],
    
    SmallFriends:       [OathSuit.Beast,    [SmallFriends], CardRestriction.Adviser],
    PiedPiper:          [OathSuit.Beast,    [IgnoresCapacity, PiedPiperActive], CardRestriction.Adviser],
    AnimalPlaymates:    [OathSuit.Beast,    [], CardRestriction.Adviser],
    TrueNames:          [OathSuit.Beast,    [], CardRestriction.Adviser],
    Birdsong:           [OathSuit.Beast,    [], CardRestriction.Adviser],
    GiantPython:        [OathSuit.Beast,    [], CardRestriction.Adviser],
    LongLostHeir:       [OathSuit.Beast,    [], CardRestriction.Adviser, true],
    VowOfPoverty:       [OathSuit.Beast,    [VowOfPoverty, VowOfPovertyRest], CardRestriction.Adviser, true],
    VowOfUnion:         [OathSuit.Beast,    [], CardRestriction.Adviser, true],
    VowOfBeastkin:      [OathSuit.Beast,    [], CardRestriction.Adviser, true],
    WalledGarden:       [OathSuit.Beast,    [], CardRestriction.Site],
    TheOldOak:          [OathSuit.Beast,    [], CardRestriction.Site],
    RovingTerror:       [OathSuit.Beast,    [], CardRestriction.Site],
    GraspingVines:      [OathSuit.Beast,    [], CardRestriction.Site],
    Mushrooms:          [OathSuit.Beast,    [], CardRestriction.Site],
    MarshSpirit:        [OathSuit.Beast,    [], CardRestriction.Site],
    ForestCouncil:      [OathSuit.Beast,    [], CardRestriction.Site, true],
    InsectSwarm:        [OathSuit.Beast,    [InsectSwarmAttack, InsectSwarmDefense]],
    Rangers:            [OathSuit.Beast,    []],
    NatureWorship:      [OathSuit.Beast,    []],
    WarTortoise:        [OathSuit.Beast,    []],
    Bracken:            [OathSuit.Beast,    [Bracken]],
    ErrandBoy:          [OathSuit.Beast,    []],
    Wolves:             [OathSuit.Beast,    []],
    ForestPaths:        [OathSuit.Beast,    []],
    FaeMerchant:        [OathSuit.Beast,    []],
    SecondChance:       [OathSuit.Beast,    []],
    NewGrowth:          [OathSuit.Beast,    []],
    WildCry:            [OathSuit.Beast,    []],
    MemoryOfNature:     [OathSuit.Beast,    []],
    WildAllies:         [OathSuit.Beast,    []],
    ThreateningRoar:    [OathSuit.Beast,    [ThreateningRoar]],
    AnimalHost:         [OathSuit.Beast,    []],
    
    LostTongue:         [OathSuit.Nomad,    [LostTongue, LostTongueCampaign], CardRestriction.Adviser],
    FamilyWagon:        [OathSuit.Nomad,    [FamilyWagon], CardRestriction.Adviser],
    AncientBloodline:   [OathSuit.Nomad,    [], CardRestriction.Adviser],
    Hospitality:        [OathSuit.Nomad,    [], CardRestriction.Adviser],
    Pilgrimage:         [OathSuit.Nomad,    [], CardRestriction.Adviser],
    TwinBrother:        [OathSuit.Nomad,    [], CardRestriction.Adviser],
    FaithfulFriend:     [OathSuit.Nomad,    [], CardRestriction.Adviser, true],
    AncientPact:        [OathSuit.Nomad,    [], CardRestriction.Adviser, true],
    VowOfKinship:       [OathSuit.Nomad,    [], CardRestriction.Adviser, true],
    WayStation:         [OathSuit.Nomad,    [WayStation], CardRestriction.Site],
    SpellBreaker:       [OathSuit.Nomad,    [SpellBreaker], CardRestriction.Site],
    Resettle:           [OathSuit.Nomad,    [], CardRestriction.Site],
    Oracle:             [OathSuit.Nomad,    [], CardRestriction.Site],
    GreatHerd:          [OathSuit.Nomad,    [], CardRestriction.Site],
    SacredGround:       [OathSuit.Nomad,    [], CardRestriction.Site, true],
    RainBoots:          [OathSuit.Nomad,    []],
    HorseArchers:       [OathSuit.Nomad,    []],
    WarningSignals:     [OathSuit.Nomad,    []],
    Lancers:            [OathSuit.Nomad,    []],
    MountainGiant:      [OathSuit.Nomad,    []],
    RivalKhan:          [OathSuit.Nomad,    []],
    MountedPatrol:      [OathSuit.Nomad,    []],
    GreatCrusade:       [OathSuit.Nomad,    []],
    StormCaller:        [OathSuit.Nomad,    []],
    Elders:             [OathSuit.Nomad,    [Elders]],
    AncientBinding:     [OathSuit.Nomad,    []],
    Tents:              [OathSuit.Nomad,    []],
    Convoys:            [OathSuit.Nomad,    []],
    WildMounts:         [OathSuit.Nomad,    []],
    SpecialEnvoy:       [OathSuit.Nomad,    []],
    AFastSteed:         [OathSuit.Nomad,    []],
    RelicWorship:       [OathSuit.Nomad,    []],
    TheGathering:       [OathSuit.Nomad,    []],
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