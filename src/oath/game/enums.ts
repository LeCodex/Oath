export enum PlayerColor {
    Purple,
    Red,
    Blue,
    Yellow,
    White,
    Black
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

export const OathTypeVisionName: Record<keyof typeof OathType, string> = {
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

export type Enum<E> = Record<keyof E, number | string> & { [k: number]: string };
export function isEnumKey<E extends Enum<E>>(key: string | number | symbol, _enum: E): key is keyof E {
    return key in _enum;
} 