import { OathResource, OathSuit } from "../enums";
import { OathPower } from "../powers/powers";
import { AncientCity, CharmingValley, CoastalSite, DeepWoods, FertileValley, OpportunitySite, StandingStones, Steppe, Wastes } from "../powers/sites";
import { ResourceCost } from "../resources";
import { Constructor } from "../utils";
import { Site } from "./cards";

export const sitesData: Record<string, [Constructor<OathPower<Site>>[], number, number?, ResourceCost?, OathSuit?, Iterable<[OathResource, number]>?]> = {
    AncientCity:    [[AncientCity],     2, 1, new ResourceCost([[OathResource.Favor, 3]]), OathSuit.Order],
    DeepWoods:      [[DeepWoods],       2, 1, new ResourceCost([], [[OathResource.Secret, 2]])],
    FertileValley:  [[FertileValley],   3],
    StandingStones: [[StandingStones],  2, 1, new ResourceCost([[OathResource.Favor, 3]]), OathSuit.Arcane],
    Steppe:         [[Steppe],          2, 1, new ResourceCost([[OathResource.Favor, 3]]), OathSuit.Nomad],
    Wastes:         [[Wastes],          1, 1, new ResourceCost([], [[OathResource.Secret, 2]])],

    DrownedCity:    [[OpportunitySite], 0, 1, new ResourceCost([], [[OathResource.Favor, 2]]), OathSuit.None,   [[OathResource.Secret, 3]]],
    Mine:           [[OpportunitySite], 1, 1, new ResourceCost([[OathResource.Favor, 3]]), OathSuit.Discord,    [[OathResource.Favor, 3]]],
    SaltFlats:      [[OpportunitySite], 2, 0, new ResourceCost(), OathSuit.None,                                [[OathResource.Favor, 2], [OathResource.Secret, 1]]],

    BarrenCoast:    [[CoastalSite],     1, 1, new ResourceCost([[OathResource.Favor, 3]]), OathSuit.Nomad],
    LushCoast:      [[CoastalSite],     3],
    RockyCoast:     [[CoastalSite],     2],

    Plains:         [[],                3],
    Mountain:       [[],                2, 1, new ResourceCost([], [[OathResource.Favor, 2]])],

    CharmingValley: [[CharmingValley],  3],
    NarrowPass:     [[],                1, 1, new ResourceCost([[OathResource.Favor, 3]]), OathSuit.Arcane],
    ShroudedWood:   [[],                3, 1, new ResourceCost([], [[OathResource.Secret, 1]])],
    TheHiddenPlace: [[],                2, 1, new ResourceCost([], [[OathResource.Secret, 1]])],
    BuriedGiant:    [[],                2, 1, new ResourceCost([], [[OathResource.Secret, 1]])],
    GreatSlum:      [[],                3],
    TheTribunal:    [[],                2, 1, new ResourceCost([[OathResource.Favor, 3]]), OathSuit.Order],
    Marshes:        [[],                2, 1, new ResourceCost([], [[OathResource.Secret, 1]])],
    River:          [[],                2],
}