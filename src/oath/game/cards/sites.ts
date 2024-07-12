import { OathResource, OathSuit } from "../enums";
import { AncientCity, CharmingValley, CoastalSite, DeepWoods, FertileValley, OathPower, ResourceSite, StandingStones, Steppe, Wastes } from "../power";
import { ResourceCost } from "../resources";
import { Constructor, StringObject } from "../utils";
import { Site } from "./cards";

export const sitesData: StringObject<[string, Constructor<OathPower<Site>>[], number, number?, ResourceCost?, OathSuit?, Iterable<[OathResource, number]>?]> = {
    "AncientCity":      ["Ancient City",    [AncientCity],      2, 1, new ResourceCost([[OathResource.Favor, 3]]), OathSuit.Order],
    "DeepWoods":        ["Deep Woods",      [DeepWoods],        2, 1, new ResourceCost([], [[OathResource.Secret, 2]])],
    "FertileValley":    ["Fertile Valley",  [FertileValley],    3],
    "StandingStones":   ["Standing Stones", [StandingStones],   2, 1, new ResourceCost([[OathResource.Favor, 3]]), OathSuit.Arcane],
    "Steppe":           ["Steppe",          [Steppe],           2, 1, new ResourceCost([[OathResource.Favor, 3]]), OathSuit.Nomad],
    "Wastes":           ["Wastes",          [Wastes],           1, 1, new ResourceCost([], [[OathResource.Secret, 2]])],

    "DrownedCity":      ["Drowned City",    [ResourceSite],     0, 1, new ResourceCost([], [[OathResource.Favor, 2]]), OathSuit.None,   [[OathResource.Secret, 3]]],
    "Mine":             ["Mine",            [ResourceSite],     1, 1, new ResourceCost([[OathResource.Favor, 3]]), OathSuit.Discord,    [[OathResource.Favor, 3]]],
    "SaltFlats":        ["Salt Flats",      [ResourceSite],     2, 0, new ResourceCost(), OathSuit.None,                                [[OathResource.Favor, 2], [OathResource.Secret, 1]]],

    "BarrenCoast":      ["Barren Coast",    [CoastalSite],      1, 1, new ResourceCost([[OathResource.Favor, 3]]), OathSuit.Nomad],
    "LushCoast":        ["Lush Coast",      [CoastalSite],      3],
    "RockyCost":        ["Rocky Coast",     [CoastalSite],      2],

    "CharmingValley":   ["Charming Valley", [CharmingValley],   3]
}