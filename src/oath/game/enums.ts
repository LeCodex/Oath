export enum PlayerColor {
    Purple,
    Red,
    Blue,
    Yellow,
    White,
    Brown
}

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

export const OathSuitName = {
    [OathSuit.Discord]: "Discord",
    [OathSuit.Arcane]: "Arcane",
    [OathSuit.Order]: "Order",
    [OathSuit.Hearth]: "Hearth",
    [OathSuit.Beast]: "Beast",
    [OathSuit.Nomad]: "Nomad",
    [OathSuit.None]: "None",
}


export enum OathResource {
    Favor,
    Secret,
    FlippedSecret
}

export const OathResourceName = {
    [OathResource.Favor]: "Favor",
    [OathResource.Secret]: "Secret",
    [OathResource.FlippedSecret]: "Flipped Secret",
}


export enum OathType {
    Supremacy,
    ThePeople,
    Devotion,
    Protection
}

export const OathTypeName = {
    [OathType.Supremacy]: "Supremacy",
    [OathType.Protection]: "Protection",
    [OathType.ThePeople]: "The People",
    [OathType.Devotion]: "Devotion",
}

export const OathTypeVisionName = {
    [OathType.Supremacy]: "Conquest",
    [OathType.Protection]: "Sanctuary",
    [OathType.ThePeople]: "Rebellion",
    [OathType.Devotion]: "Faith",
}


export enum BannerName {
    PeoplesFavor,
    DarkestSecret
}

export enum RegionName {
    Cradle,
    Provinces,
    Hinterland
}

export enum CardRestriction {
    None,
    Site,
    Adviser
}

export enum OathPhase {
    Wake,
    Act,
    Rest
}