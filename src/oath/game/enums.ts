export enum PlayerColor {
    Purple = "Purple",
    Red = "Red",
    Blue = "Blue",
    Yellow = "Yellow",
    White = "White",
    Black = "Black"
}

export const ALL_PLAYER_COLORS = [PlayerColor.Purple, PlayerColor.Red, PlayerColor.Blue, PlayerColor.Yellow, PlayerColor.White, PlayerColor.Black];

export enum OathSuit {
    Discord,
    Arcane,
    Order,
    Hearth,
    Beast,
    Nomad,
    None = -1
}

export const ALL_OATH_SUITS = [OathSuit.Discord, OathSuit.Arcane, OathSuit.Order, OathSuit.Hearth, OathSuit.Beast, OathSuit.Nomad];

export enum OathType {
    Supremacy,
    ThePeople,
    Devotion,
    Protection
}

export const OathTypeVisionName = {
    "Supremacy": "Conquest",
    "Protection": "Sanctuary",
    "ThePeople": "Rebellion",
    "Devotion": "Faith",
}

export enum BannerKey {
    PeoplesFavor,
    DarkestSecret
}

export enum RegionKey {
    Cradle,
    Provinces,
    Hinterland
}

export const RegionSize = {
    [RegionKey.Cradle]: 2,
    [RegionKey.Provinces]: 3,
    [RegionKey.Hinterland]: 3,
}

export enum CardRestriction {
    None,
    Site,
    Adviser
}

export enum OathPhase {
    Wake,
    Act,
    Rest,
    Over
}

export enum PowerLayers {
    ADDS_CHOICES,
    FILTERS_CHOICES,
}