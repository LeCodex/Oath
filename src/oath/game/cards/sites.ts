import { OathSuit } from "../enums";
import type { OathResourceType } from "../model/resources";
import { Favor, Secret } from "../model/resources";
import { ResourceCost } from "../costs";
import type { SiteName } from "../parser/interfaces";
import type { SitePowerName } from "../powers/classIndex";

export type SiteName = keyof typeof SiteName;
export const sitesData: Record<SiteName, [number, SitePowerName[], number?, ResourceCost?, OathSuit?, [OathResourceType, number][]?]> = {
    Plains:         [3, ["Plains"]],
    Mountain:       [2, ["Mountain"],                           1, new ResourceCost([], [[Favor, 2]])],
    GreatSlum:      [3, ["GreatSlum"]],
    TheTribunal:    [2, ["TheTribunal"],                        1, new ResourceCost([[Favor, 3]]),      OathSuit.Order],
    Marshes:        [2, ["Marshes"],                            1, new ResourceCost([], [[Secret, 1]])],
    River:          [2, ["River"]],

    AncientCity:    [2, ["AncientCity"],                        1, new ResourceCost([[Favor, 3]]),      OathSuit.Order],
    DeepWoods:      [2, ["DeepWoods"],                          1, new ResourceCost([], [[Secret, 2]])],
    FertileValley:  [3, ["FertileValley"]],
    StandingStones: [2, ["StandingStones"],                     1, new ResourceCost([[Favor, 3]]),      OathSuit.Arcane],
    Steppe:         [2, ["Steppe"],                             1, new ResourceCost([[Favor, 3]]),      OathSuit.Nomad],
    Wastes:         [1, ["Wastes"],                             1, new ResourceCost([], [[Secret, 2]])],

    DrownedCity:    [0, ["OpportunitySite"],                    2, new ResourceCost([], [[Favor, 2]]),  OathSuit.None,      [[Secret, 3]]],
    Mine:           [1, ["OpportunitySite"],                    1, new ResourceCost([[Favor, 3]]),      OathSuit.Discord,   [[Favor, 3]]],
    SaltFlats:      [2, ["OpportunitySite"],                    0, new ResourceCost(),                  OathSuit.None,      [[Favor, 2], [Secret, 1]]],

    BarrenCoast:    [1, ["CoastalSite", "CoastalSiteCost"],     1, new ResourceCost([[Favor, 3]]),      OathSuit.Nomad],
    LushCoast:      [3, ["CoastalSite", "CoastalSiteCost"]],
    RockyCoast:     [2, ["CoastalSite", "CoastalSiteCost"]],
    BuriedGiant:    [2, ["BuriedGiant", "BuriedGiantCost"],     1, new ResourceCost([], [[Secret, 1]])],
    CharmingValley: [3, ["CharmingValley"]],
    NarrowPass:     [1, ["NarrowPass"],                         1, new ResourceCost([[Favor, 3]]),      OathSuit.Arcane],
    ShroudedWood:   [3, ["ShroudedWood", "ShroudedWoodCost"],   1, new ResourceCost([], [[Secret, 1]])],
    TheHiddenPlace: [2, ["TheHiddenPlaceTravel", "TheHiddenPlaceCampaign"], 1, new ResourceCost([], [[Secret, 1]])],
}