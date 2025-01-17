import * as denizens from "./denizens";
import * as discord from "./discord";
import * as arcane from "./arcane";
import * as order from "./order";
import * as hearth from "./hearth";
import * as beast from "./beast";
import * as nomad from "./nomad";
import * as relics from "./relics";
import * as banners from "./banners";
import * as sites from "./sites";
import * as reliquary from "./reliquary";
import * as visions from "./visions";

export const denizenPowersIndex = {
    ...denizens,
    ...discord,
    ...arcane,
    ...order,
    ...hearth,
    ...beast,
    ...nomad
};
export type DenizenPowerName = keyof typeof denizenPowersIndex;

export const cardPowersIndex = {
    ...denizenPowersIndex,
    ...visions,
    ...relics,
    ...sites
};
export type CardPowerName = keyof typeof cardPowersIndex;

export type VisionPowerName = keyof typeof visions;
export type RelicPowerName = keyof typeof relics;
export type BannerPowerName = keyof typeof banners;
export type SitePowerName = keyof typeof sites;
export type ReliquaryPowerName = keyof typeof reliquary;

export const powersIndex = {
    ...cardPowersIndex,
    ...banners,
    ...reliquary
};
export type PowerName = keyof typeof powersIndex;