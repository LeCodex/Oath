import type { RecoverAction } from "./actions";
import type { Site } from "./cards";
import type { OathGameObject } from "./gameObject";
import type { OathPlayer } from "./player";
import type { OathPower } from "./powers";
import type { ResourcesAndWarbands } from "./resources";
import { ResourceCost } from "./costs";
import type { Constructor } from "./utils";


export interface WithPowers extends OathGameObject {
    powers: Set<Constructor<OathPower<WithPowers>>>;
    active: boolean;
}
export function hasPowers(obj: object): obj is WithPowers {
    return "powers" in obj;
}
export type SourceType<T extends OathPower<any>> = T extends OathPower<infer U> ? U : never;

export interface AtSite {
    site?: Site;
}
export function isAtSite(obj: object): obj is AtSite {
    return "site" in obj;
}

export interface HiddenInformation {
    facedown: boolean;
    seenBy: Set<OathPlayer>;
    visualName(player: OathPlayer): string;
}
export function hasHiddenInformation(obj: object): obj is HiddenInformation {
    return "visualName" in obj; 
}

export interface OwnableObject extends OathGameObject {
    owner?: OathPlayer;
    setOwner(player?: OathPlayer): void;
}
export function isOwnable(obj: OathGameObject): obj is OwnableObject {
    return "owner" in obj;
}

export interface CampaignActionTarget extends OathGameObject {
    defense: number;
    force: ResourcesAndWarbands<any> | undefined;
    seize(player: OathPlayer): void;
}

export interface RecoverActionTarget extends OathGameObject, OwnableObject {
    canRecover(action: RecoverAction): boolean;
    recover(player: OathPlayer): void;
}

