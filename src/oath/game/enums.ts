
export enum OathSuit {
    Discord,
    Arcane,
    Order,
    Hearth,
    Beast,
    Nomad,
    None
}

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
    Protection,
    ThePeople,
    Devotion
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

export enum MajorAction {
    Campaign,
    Muster,
    Recover,
    Search,
    Trade,
    Travel
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