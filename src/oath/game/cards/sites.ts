import { OathSuit } from "../enums";
import { OathPower } from "../powers";
import { AncientCity, BuriedGiant, CharmingValley, CoastalSite, DeepWoods, FertileValley, GreatSlum, Marshes, Mountain, NarrowPass, OpportunitySite, Plains, River, ShroudedWood, StandingStones, Steppe, TheHiddenPlaceCampaign, TheHiddenPlaceTravel, TheTribunal, Wastes } from "../powers/sites";
import { Favor, OathResource, ResourceCost, Secret } from "../resources";
import { Constructor } from "../utils";
import { Site } from ".";

export const sitesData: Record<string, [number, Constructor<OathPower<Site>>[], number?, ResourceCost?, OathSuit?, Iterable<[typeof OathResource, number]>?]> = {
    Plains:         [3, [Plains]],
    Mountain:       [2, [Mountain],         1, new ResourceCost([], [[Favor, 2]])],
    GreatSlum:      [3, [GreatSlum]],
    TheTribunal:    [2, [TheTribunal],      1, new ResourceCost([[Favor, 3]]),      OathSuit.Order],
    Marshes:        [2, [Marshes],          1, new ResourceCost([], [[Secret, 1]])],
    River:          [2, [River]],

    AncientCity:    [2, [AncientCity],      1, new ResourceCost([[Favor, 3]]),      OathSuit.Order],
    DeepWoods:      [2, [DeepWoods],        1, new ResourceCost([], [[Secret, 2]])],
    FertileValley:  [3, [FertileValley]],
    StandingStones: [2, [StandingStones],   1, new ResourceCost([[Favor, 3]]),      OathSuit.Arcane],
    Steppe:         [2, [Steppe],           1, new ResourceCost([[Favor, 3]]),      OathSuit.Nomad],
    Wastes:         [1, [Wastes],           1, new ResourceCost([], [[Secret, 2]])],

    DrownedCity:    [0, [OpportunitySite],  1, new ResourceCost([], [[Favor, 2]]),  OathSuit.None,      [[Secret, 3]]],
    Mine:           [1, [OpportunitySite],  1, new ResourceCost([[Favor, 3]]),      OathSuit.Discord,   [[Favor, 3]]],
    SaltFlats:      [2, [OpportunitySite],  0, new ResourceCost(),                  OathSuit.None,      [[Favor, 2], [Secret, 1]]],

    BarrenCoast:    [1, [CoastalSite],      1, new ResourceCost([[Favor, 3]]),      OathSuit.Nomad],
    LushCoast:      [3, [CoastalSite]],
    RockyCoast:     [2, [CoastalSite]],
    BuriedGiant:    [2, [BuriedGiant],      1, new ResourceCost([], [[Secret, 1]])],
    CharmingValley: [3, [CharmingValley]],
    NarrowPass:     [1, [NarrowPass],       1, new ResourceCost([[Favor, 3]]),      OathSuit.Arcane],
    ShroudedWood:   [3, [ShroudedWood],     1, new ResourceCost([], [[Secret, 1]])],
    TheHiddenPlace: [2, [TheHiddenPlaceTravel, TheHiddenPlaceCampaign], 1, new ResourceCost([], [[Secret, 1]])],
}