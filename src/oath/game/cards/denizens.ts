import { CardRestriction, OathSuit } from "../enums";
import { IgnoresCapacity } from "../powers/denizens";
import { ASmallFavor, Assassin, BanditChief, BanditChiefWhenPlayed, Blackmail, BookBurning, ChaosCult, Charlatan, CrackedSageAttack, CrackedSageDefense, DisgracedCaptain, Dissent, GamblingHall, Insomnia, KeyToTheCity, MercenariesAttack, MercenariesDefense, Naysayers, OnlyTwoAdvisers, RelicThief, Riots, RoyalAmbitions, Scryer, SilverTongue, Slander, SleightOfHand, SaltTheEarth, FalseProphet, FalseProphetWake, FalseProphetDiscard, Downtrodden, SecondWind, BoilingLake, Gossip, BeastTamerAttack, BeastTamerDefense, Enchantress, SneakAttack, VowOfRenewal, VowOfRenewalRecover, Zealots, SqualidDistrict, FestivalDistrict } from "../powers/discord";
import { ActingTroupe, Alchemist, Augury, Bewitch, BillowingFogAttack, BillowingFogDefense, BloodPact, CrackingGroundAttack, Dazzle, DreamThief, FallenSpire, FireTalkersAttack, FireTalkersDefense, ForgottenVault, GleamingArmorAttack, GleamingArmorDefense, GreatSpire, InitiationRite, Inquisitor, Jinx, KindredWarriorsAttack, KindredWarriorsDefense, MagiciansCode, MapLibrary, MasterOfDisguise, Observatory, PlagueEngines, Portal, Revelation, RustingRay, SealingWard, SecretSignal, SpiritSnare, TamingCharm, TerrorSpells, Tutor, VowOfSilence, VowOfSilencePitch, VowOfSilenceRecover, WitchsBargain, WizardSchool } from "../powers/arcane";
import { BanditRampart, BattleHonorsAttack, BattleHonorsDefense, BearTraps, Captains, CodeOfHonorAttack, CodeOfHonorDefense, CouncilSeat, Curfew, EncirclementAttack, EncirclementDefense, FieldPromotionAttack, FieldPromotionDefense, ForcedLabor, Garrison, HuntingParty, Keep, KnightsErrant, LongbowsAttack, LongbowsDefense, MartialCultureAttack, MartialCultureDefense, Messenger, MilitaryParadeAttack, MilitaryParadeDefense, Outriders, Palanquin, PeaceEnvoyAttack, PeaceEnvoyDefense, Pressgangs, RelicHunter, RoyalTax, Scouts, SecretPolice, ShieldWall, SiegeEngines, Specialist, SprawlingRampart, TollRoads, TomeGuardians, TomeGuardiansAttack, Tyrant, VowOfObedience, VowOfObedienceRest, Wrestlers } from "../powers/order";
import { ArmedMob, ARoundOfAle, AwaitedReturn, BallotBox, BookBinders, CharmingFriend, CropRotation, DeedWriter, ExtraProvisions, FabledFeast, FamilyHeirloom, HallOfDebate, HallOfMockery, HeartsAndMinds, Herald, Homesteaders, HospitalAttack, HospitalDefense, LandWarden, Levelers, Marriage, MemoryOfHome, NewsFromAfar, RelicBreaker, RowdyPub, SaddleMakers, SaladDays, Storyteller, TavernSongs, TheGreatLevyAttack, TheGreatLevyDefense, TinkersFair, TravelingDoctorAttack, TravelingDoctorDefense, VillageConstableAttack, VillageConstableDefense, VowOfPeace, VowOfPeaceDefense, WaysideInn, WelcomingParty } from "../powers/hearth";
import { AnimalHost, AnimalPlaymates, Birdsong, Bracken, ErrandBoy, FaeMerchant, ForestCouncilMuster, ForestCouncilTrade, ForestPaths, ForestTemple, GiantPython, GraspingVines, InsectSwarmAttack, InsectSwarmDefense, LongLostHeir, MarshSpirit, MemoryOfNature, Mushrooms, NatureWorshipAttack, NatureWorshipDefense, NewGrowth, PiedPiper, Rangers, RovingTerror, RuinedTemple, SecondChance, SmallFriends, TheOldOak, ThreateningRoar, TrueNamesAttack, TrueNamesDefense, VowOfBeastkin, VowOfPoverty, VowOfPovertyRest, VowOfUnionAttack, VowOfUnionTravel, WalledGarden, WarTortoiseAttack, WarTortoiseDefense, WildAllies, WildCry, Wolves } from "../powers/beast";
import { AFastSteed, AncientBinding, AncientBloodline, AncientBloodlineRelics, AncientForge, AncientPact, BrokenForge, Convoys, Elders, FaithfulFriend, FamilyWagon, GreatCrusadeAttack, GreatCrusadeDefense, GreatHerd, HorseArchersAttack, HorseArchersDefense, Hospitality, Lancers, LostTongue, LostTongueCampaign, MountainGiantAttack, MountainGiantDefense, MountedPatrol, Oracle, Pilgrimage, RainBoots, RelicWorship, Resettle, RivalKhanAttack, RivalKhanDefense, SacredGround, SpecialEnvoy, SpellBreaker, StormCaller, Tents, TheGathering, TwinBrother, VowOfKinshipBurn, VowOfKinshipGain, VowOfKinshipGive, VowOfKinshipWhenPlayed, WarningSignals, WayStation, WildMounts } from "../powers/nomad";

export const denizenData = {
    SleightOfHand:      [OathSuit.Discord,  [SleightOfHand],                                        CardRestriction.Adviser],
    Naysayers:          [OathSuit.Discord,  [Naysayers],                                            CardRestriction.Adviser],
    ChaosCult:          [OathSuit.Discord,  [ChaosCult],                                            CardRestriction.Adviser],
    BeastTamer:         [OathSuit.Discord,  [BeastTamerAttack, BeastTamerDefense],                  CardRestriction.Adviser],
    Enchantress:        [OathSuit.Discord,  [Enchantress],                                          CardRestriction.Adviser],
    SneakAttack:        [OathSuit.Discord,  [SneakAttack],                                          CardRestriction.Adviser],
    Assassin:           [OathSuit.Discord,  [OnlyTwoAdvisers, Assassin],                            CardRestriction.Adviser, true],
    Insomnia:           [OathSuit.Discord,  [OnlyTwoAdvisers, Insomnia],                            CardRestriction.Adviser, true],
    SilverTongue:       [OathSuit.Discord,  [OnlyTwoAdvisers, SilverTongue],                        CardRestriction.Adviser, true],
    VowOfRenewal:       [OathSuit.Discord,  [VowOfRenewal, VowOfRenewalRecover],                    CardRestriction.Adviser, true],
    FalseProphet:       [OathSuit.Discord,  [FalseProphet, FalseProphetWake, FalseProphetDiscard],  CardRestriction.Adviser, true],
    ASmallFavor:        [OathSuit.Discord,  [ASmallFavor],                                          CardRestriction.Adviser, true],
    RoyalAmbitions:     [OathSuit.Discord,  [RoyalAmbitions],                                       CardRestriction.Adviser, true],
    GamblingHall:       [OathSuit.Discord,  [GamblingHall],                                         CardRestriction.Site],
    Gossip:             [OathSuit.Discord,  [Gossip],                                               CardRestriction.Site],
    BanditChief:        [OathSuit.Discord,  [BanditChiefWhenPlayed, BanditChief],                   CardRestriction.Site],
    KeyToTheCity:       [OathSuit.Discord,  [KeyToTheCity],                                         CardRestriction.Site],
    BoilingLake:        [OathSuit.Discord,  [BoilingLake],                                          CardRestriction.Site, true],
    SaltTheEarth:       [OathSuit.Discord,  [IgnoresCapacity, SaltTheEarth],                        CardRestriction.Site, true],
    Mercenaries:        [OathSuit.Discord,  [MercenariesAttack, MercenariesDefense]],
    SecondWind:         [OathSuit.Discord,  [SecondWind]],
    DisgracedCaptain:   [OathSuit.Discord,  [DisgracedCaptain]],
    CrackedSage:        [OathSuit.Discord,  [CrackedSageAttack, CrackedSageDefense]],
    BookBurning:        [OathSuit.Discord,  [BookBurning]],
    Zealots:            [OathSuit.Discord,  [Zealots]],
    Slander:            [OathSuit.Discord,  [Slander]],
    RelicThief:         [OathSuit.Discord,  [RelicThief]],
    Scryer:             [OathSuit.Discord,  [Scryer]],
    Downtrodden:        [OathSuit.Discord,  [Downtrodden]],
    Charlatan:          [OathSuit.Discord,  [Charlatan]],
    Blackmail:          [OathSuit.Discord,  [Blackmail]],
    Dissent:            [OathSuit.Discord,  [Dissent]],
    Riots:              [OathSuit.Discord,  [Riots]],
    
    Tutor:              [OathSuit.Arcane,   [Tutor],                                                CardRestriction.Adviser],
    ActingTroupe:       [OathSuit.Arcane,   [ActingTroupe],                                         CardRestriction.Adviser],
    SecretSignal:       [OathSuit.Arcane,   [SecretSignal],                                         CardRestriction.Adviser],
    MasterOfDisguise:   [OathSuit.Arcane,   [MasterOfDisguise],                                     CardRestriction.Adviser],
    SealingWard:        [OathSuit.Arcane,   [SealingWard],                                          CardRestriction.Adviser, true],
    InitiationRite:     [OathSuit.Arcane,   [InitiationRite],                                       CardRestriction.Adviser, true],
    VowOfSilence:       [OathSuit.Arcane,   [VowOfSilence, VowOfSilenceRecover, VowOfSilencePitch], CardRestriction.Adviser, true],
    Portal:             [OathSuit.Arcane,   [Portal],                                               CardRestriction.Site],
    WizardSchool:       [OathSuit.Arcane,   [WizardSchool],                                         CardRestriction.Site],
    ForgottenVault:     [OathSuit.Arcane,   [ForgottenVault],                                       CardRestriction.Site],
    MapLibrary:         [OathSuit.Arcane,   [MapLibrary],                                           CardRestriction.Site],
    FireTalkers:        [OathSuit.Arcane,   [FireTalkersAttack, FireTalkersDefense]],
    RustingRay:         [OathSuit.Arcane,   [RustingRay]],
    BillowingFog:       [OathSuit.Arcane,   [BillowingFogAttack, BillowingFogDefense]],
    KindredWarriors:    [OathSuit.Arcane,   [KindredWarriorsAttack, KindredWarriorsDefense]],
    CrackingGround:     [OathSuit.Arcane,   [CrackingGroundAttack, CrackedSageDefense]],
    GleamingArmor:      [OathSuit.Arcane,   [GleamingArmorAttack, GleamingArmorDefense]],
    SpiritSnare:        [OathSuit.Arcane,   [SpiritSnare]],
    Alchemist:          [OathSuit.Arcane,   [Alchemist]],
    Jinx:               [OathSuit.Arcane,   [Jinx]],
    MagiciansCode:      [OathSuit.Arcane,   [MagiciansCode]],
    TamingCharm:        [OathSuit.Arcane,   [TamingCharm]],
    Inquisitor:         [OathSuit.Arcane,   [Inquisitor]],
    Augury:             [OathSuit.Arcane,   [Augury]],
    TerrorSpells:       [OathSuit.Arcane,   [TerrorSpells]],
    BloodPact:          [OathSuit.Arcane,   [BloodPact]],
    Observatory:        [OathSuit.Arcane,   [Observatory]],
    PlagueEngines:      [OathSuit.Arcane,   [PlagueEngines]],
    DreamThief:         [OathSuit.Arcane,   [DreamThief]],
    WitchsBargain:      [OathSuit.Arcane,   [WitchsBargain]],
    Dazzle:             [OathSuit.Arcane,   [Dazzle]],
    Revelation:         [OathSuit.Arcane,   [Revelation]],
    Bewitch:            [OathSuit.Arcane,   [Bewitch]],
    
    Palanquin:          [OathSuit.Order,    [Palanquin],                                            CardRestriction.Adviser],
    Tyrant:             [OathSuit.Order,    [Tyrant],                                               CardRestriction.Adviser, true],
    CouncilSeat:        [OathSuit.Order,    [CouncilSeat],                                          CardRestriction.Adviser, true],
    VowOfObedience:     [OathSuit.Order,    [VowOfObedience, VowOfObedienceRest],                   CardRestriction.Adviser, true],
    Curfew:             [OathSuit.Order,    [Curfew],                                               CardRestriction.Site],
    TollRoads:          [OathSuit.Order,    [TollRoads],                                            CardRestriction.Site],
    ForcedLabor:        [OathSuit.Order,    [ForcedLabor],                                          CardRestriction.Site],
    SecretPolice:       [OathSuit.Order,    [SecretPolice],                                         CardRestriction.Site],
    TomeGuardians:      [OathSuit.Order,    [TomeGuardians, TomeGuardiansAttack],                   CardRestriction.Site],
    Keep:               [OathSuit.Order,    [Keep],                                                 CardRestriction.Site, true],
    Longbows:           [OathSuit.Order,    [LongbowsAttack, LongbowsDefense]],
    ShieldWall:         [OathSuit.Order,    [ShieldWall]],
    Wrestlers:          [OathSuit.Order,    [Wrestlers]],
    BattleHonors:       [OathSuit.Order,    [BattleHonorsAttack, BattleHonorsDefense]],
    BearTraps:          [OathSuit.Order,    [BearTraps]],
    Scouts:             [OathSuit.Order,    [Scouts]],
    MartialCulture:     [OathSuit.Order,    [MartialCultureAttack, MartialCultureDefense]],
    CodeOfHonor:        [OathSuit.Order,    [CodeOfHonorAttack, CodeOfHonorDefense]],
    Outriders:          [OathSuit.Order,    [Outriders]],
    FieldPromotion:     [OathSuit.Order,    [FieldPromotionAttack, FieldPromotionDefense]],
    MilitaryParade:     [OathSuit.Order,    [MilitaryParadeAttack, MilitaryParadeDefense]],
    Specialist:         [OathSuit.Order,    [Specialist]],
    Encirclement:       [OathSuit.Order,    [EncirclementAttack, EncirclementDefense]],
    PeaceEnvoy:         [OathSuit.Order,    [PeaceEnvoyAttack, PeaceEnvoyDefense]],
    RelicHunter:        [OathSuit.Order,    [RelicHunter]],
    Pressgangs:         [OathSuit.Order,    [Pressgangs]],
    Messenger:          [OathSuit.Order,    [Messenger]],
    Captains:           [OathSuit.Order,    [Captains]],
    SiegeEngines:       [OathSuit.Order,    [SiegeEngines]],
    KnightsErrant:      [OathSuit.Order,    [KnightsErrant]],
    HuntingParty:       [OathSuit.Order,    [HuntingParty]],
    RoyalTax:           [OathSuit.Order,    [RoyalTax]],
    Garrison:           [OathSuit.Order,    [Garrison]],
    
    CharmingFriend:     [OathSuit.Hearth,   [CharmingFriend],                                       CardRestriction.Adviser],
    SaddleMakers:       [OathSuit.Hearth,   [SaddleMakers],                                         CardRestriction.Adviser],
    BookBinders:        [OathSuit.Hearth,   [BookBinders],                                          CardRestriction.Adviser],
    Herald:             [OathSuit.Hearth,   [Herald],                                               CardRestriction.Adviser],
    Marriage:           [OathSuit.Hearth,   [Marriage],                                             CardRestriction.Adviser, true],
    FamilyHeirloom:     [OathSuit.Hearth,   [FamilyHeirloom],                                       CardRestriction.Adviser, true],
    VowOfPeace:         [OathSuit.Hearth,   [VowOfPeace, VowOfPeaceDefense],                        CardRestriction.Adviser, true],
    HeartsAndMinds:     [OathSuit.Hearth,   [HeartsAndMinds],                                       CardRestriction.Site],
    VillageConstable:   [OathSuit.Hearth,   [VillageConstableAttack, VillageConstableDefense],      CardRestriction.Site],
    Hospital:           [OathSuit.Hearth,   [HospitalAttack, HospitalDefense],                      CardRestriction.Site],
    TinkersFair:        [OathSuit.Hearth,   [TinkersFair],                                          CardRestriction.Site],
    WaysideInn:         [OathSuit.Hearth,   [WaysideInn],                                           CardRestriction.Site],
    WelcomingParty:     [OathSuit.Hearth,   [WelcomingParty],                                       CardRestriction.Site],
    ArmedMob:           [OathSuit.Hearth,   [ArmedMob],                                             CardRestriction.Site],
    BallotBox:          [OathSuit.Hearth,   [BallotBox],                                            CardRestriction.Site],
    RowdyPub:           [OathSuit.Hearth,   [RowdyPub],                                             CardRestriction.Site],
    ARoundOfAle:        [OathSuit.Hearth,   [ARoundOfAle],                                          CardRestriction.Site, true],
    ExtraProvisions:    [OathSuit.Hearth,   [ExtraProvisions]],
    TravelingDoctor:    [OathSuit.Hearth,   [TravelingDoctorAttack, TravelingDoctorDefense]],
    TheGreatLevy:       [OathSuit.Hearth,   [TheGreatLevyAttack, TheGreatLevyDefense]],
    AwaitedReturn:      [OathSuit.Hearth,   [AwaitedReturn]],
    MemoryOfHome:       [OathSuit.Hearth,   [MemoryOfHome]],
    Storyteller:        [OathSuit.Hearth,   [Storyteller]],
    TavernSongs:        [OathSuit.Hearth,   [TavernSongs]],
    Homesteaders:       [OathSuit.Hearth,   [Homesteaders]],
    CropRotation:       [OathSuit.Hearth,   [CropRotation]],
    LandWarden:         [OathSuit.Hearth,   [LandWarden]],
    NewsFromAfar:       [OathSuit.Hearth,   [NewsFromAfar]],
    Levelers:           [OathSuit.Hearth,   [Levelers]],
    RelicBreaker:       [OathSuit.Hearth,   [RelicBreaker]],
    DeedWriter:         [OathSuit.Hearth,   [DeedWriter]],
    FabledFeast:        [OathSuit.Hearth,   [FabledFeast]],
    SaladDays:          [OathSuit.Hearth,   [SaladDays]],
    
    GiantPython:        [OathSuit.Beast,    [GiantPython],                                          CardRestriction.Adviser],
    SmallFriends:       [OathSuit.Beast,    [SmallFriends],                                         CardRestriction.Adviser],
    PiedPiper:          [OathSuit.Beast,    [IgnoresCapacity, PiedPiper],                           CardRestriction.Adviser],
    AnimalPlaymates:    [OathSuit.Beast,    [AnimalPlaymates],                                      CardRestriction.Adviser],
    TrueNames:          [OathSuit.Beast,    [TrueNamesAttack, TrueNamesDefense],                    CardRestriction.Adviser],
    Birdsong:           [OathSuit.Beast,    [Birdsong],                                             CardRestriction.Adviser],
    LongLostHeir:       [OathSuit.Beast,    [LongLostHeir],                                         CardRestriction.Adviser, true],
    VowOfPoverty:       [OathSuit.Beast,    [VowOfPoverty, VowOfPovertyRest],                       CardRestriction.Adviser, true],
    VowOfUnion:         [OathSuit.Beast,    [VowOfUnionAttack, VowOfUnionTravel],                   CardRestriction.Adviser, true],
    VowOfBeastkin:      [OathSuit.Beast,    [VowOfBeastkin],                                        CardRestriction.Adviser, true],
    WalledGarden:       [OathSuit.Beast,    [WalledGarden],                                         CardRestriction.Site],
    TheOldOak:          [OathSuit.Beast,    [TheOldOak],                                            CardRestriction.Site],
    RovingTerror:       [OathSuit.Beast,    [RovingTerror],                                         CardRestriction.Site],
    GraspingVines:      [OathSuit.Beast,    [GraspingVines],                                        CardRestriction.Site],
    Mushrooms:          [OathSuit.Beast,    [Mushrooms],                                            CardRestriction.Site],
    MarshSpirit:        [OathSuit.Beast,    [MarshSpirit],                                          CardRestriction.Site],
    ForestCouncil:      [OathSuit.Beast,    [ForestCouncilTrade, ForestCouncilMuster],              CardRestriction.Site, true],
    InsectSwarm:        [OathSuit.Beast,    [InsectSwarmAttack, InsectSwarmDefense]],
    Rangers:            [OathSuit.Beast,    [Rangers]],
    NatureWorship:      [OathSuit.Beast,    [NatureWorshipAttack, NatureWorshipDefense]],
    WarTortoise:        [OathSuit.Beast,    [WarTortoiseAttack, WarTortoiseDefense]],
    Bracken:            [OathSuit.Beast,    [Bracken]],
    ErrandBoy:          [OathSuit.Beast,    [ErrandBoy]],
    Wolves:             [OathSuit.Beast,    [Wolves]],
    ForestPaths:        [OathSuit.Beast,    [ForestPaths]],
    FaeMerchant:        [OathSuit.Beast,    [FaeMerchant]],
    SecondChance:       [OathSuit.Beast,    [SecondChance]],
    NewGrowth:          [OathSuit.Beast,    [NewGrowth]],
    WildCry:            [OathSuit.Beast,    [WildCry]],
    MemoryOfNature:     [OathSuit.Beast,    [MemoryOfNature]],
    WildAllies:         [OathSuit.Beast,    [WildAllies]],
    ThreateningRoar:    [OathSuit.Beast,    [ThreateningRoar]],
    AnimalHost:         [OathSuit.Beast,    [AnimalHost]],
    
    LostTongue:         [OathSuit.Nomad,    [LostTongue, LostTongueCampaign],                       CardRestriction.Adviser],
    FamilyWagon:        [OathSuit.Nomad,    [FamilyWagon],                                          CardRestriction.Adviser],
    AncientBloodline:   [OathSuit.Nomad,    [AncientBloodline, AncientBloodlineRelics],             CardRestriction.Adviser],
    Hospitality:        [OathSuit.Nomad,    [Hospitality],                                          CardRestriction.Adviser],
    Pilgrimage:         [OathSuit.Nomad,    [Pilgrimage],                                           CardRestriction.Adviser],
    TwinBrother:        [OathSuit.Nomad,    [TwinBrother],                                          CardRestriction.Adviser],
    FaithfulFriend:     [OathSuit.Nomad,    [FaithfulFriend],                                       CardRestriction.Adviser, true],
    AncientPact:        [OathSuit.Nomad,    [AncientPact],                                          CardRestriction.Adviser, true],
    VowOfKinship:       [OathSuit.Nomad,    [VowOfKinshipGain, VowOfKinshipGive, VowOfKinshipBurn, VowOfKinshipWhenPlayed], CardRestriction.Adviser, true],
    WayStation:         [OathSuit.Nomad,    [WayStation],                                           CardRestriction.Site],
    SpellBreaker:       [OathSuit.Nomad,    [SpellBreaker],                                         CardRestriction.Site],
    Resettle:           [OathSuit.Nomad,    [Resettle],                                             CardRestriction.Site],
    Oracle:             [OathSuit.Nomad,    [Oracle],                                               CardRestriction.Site],
    GreatHerd:          [OathSuit.Nomad,    [GreatHerd],                                            CardRestriction.Site],
    SacredGround:       [OathSuit.Nomad,    [SacredGround],                                         CardRestriction.Site, true],
    RainBoots:          [OathSuit.Nomad,    [RainBoots]],
    HorseArchers:       [OathSuit.Nomad,    [HorseArchersAttack, HorseArchersDefense]],
    WarningSignals:     [OathSuit.Nomad,    [WarningSignals]],
    Lancers:            [OathSuit.Nomad,    [Lancers]],
    MountainGiant:      [OathSuit.Nomad,    [MountainGiantAttack, MountainGiantDefense]],
    RivalKhan:          [OathSuit.Nomad,    [RivalKhanAttack, RivalKhanDefense]],
    MountedPatrol:      [OathSuit.Nomad,    [MountedPatrol]],
    GreatCrusade:       [OathSuit.Nomad,    [GreatCrusadeAttack, GreatCrusadeDefense]],
    StormCaller:        [OathSuit.Nomad,    [StormCaller]],
    WildMounts:         [OathSuit.Nomad,    [WildMounts]],
    Elders:             [OathSuit.Nomad,    [Elders]],
    AncientBinding:     [OathSuit.Nomad,    [AncientBinding]],
    Tents:              [OathSuit.Nomad,    [Tents]],
    Convoys:            [OathSuit.Nomad,    [Convoys]],
    SpecialEnvoy:       [OathSuit.Nomad,    [SpecialEnvoy]],
    AFastSteed:         [OathSuit.Nomad,    [AFastSteed]],
    RelicWorship:       [OathSuit.Nomad,    [RelicWorship]],
    TheGathering:       [OathSuit.Nomad,    [TheGathering]],
    
    // EDIFICES //
    FestivalDistrict:   [OathSuit.Discord,  [FestivalDistrict], CardRestriction.Site, true],
    SqualidDistrict:    [OathSuit.None,     [SqualidDistrict],  CardRestriction.Site, true],

    GreatSpire:         [OathSuit.Arcane,   [GreatSpire],       CardRestriction.Site, true],
    FallenSpire:        [OathSuit.None,     [FallenSpire],      CardRestriction.Site, true],

    SprawlingRampart:   [OathSuit.Order,    [SprawlingRampart], CardRestriction.Site, true],
    BanditRampart:      [OathSuit.None,     [BanditRampart],    CardRestriction.Site, true],

    HallOfDebate:       [OathSuit.Hearth,   [HallOfDebate],     CardRestriction.Site, true],
    HallOfMockery:      [OathSuit.None,     [HallOfMockery],    CardRestriction.Site, true],

    ForestTemple:       [OathSuit.Beast,    [ForestTemple],     CardRestriction.Site, true],
    RuinedTemple:       [OathSuit.None,     [RuinedTemple],     CardRestriction.Site, true],

    AncientForge:       [OathSuit.Nomad,    [AncientForge],     CardRestriction.Site, true],
    BrokenForge:        [OathSuit.None,     [BrokenForge],      CardRestriction.Site, true],
} as const;

export type DenizenName = keyof typeof denizenData;

export const edificeFlipside: Partial<Record<DenizenName, DenizenName>> = {
    FestivalDistrict:   "SqualidDistrict",
    SqualidDistrict:    "FestivalDistrict",

    GreatSpire:         "FallenSpire",
    FallenSpire:        "GreatSpire",

    SprawlingRampart:   "BanditRampart",
    BanditRampart:      "SprawlingRampart",

    HallOfDebate:       "HallOfMockery",
    HallOfMockery:      "HallOfDebate",

    ForestTemple:       "RuinedTemple",
    RuinedTemple:       "ForestTemple",

    AncientForge:       "BrokenForge",
    BrokenForge:        "AncientForge",
} as const;