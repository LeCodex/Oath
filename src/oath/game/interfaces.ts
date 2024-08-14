import { RecoverAction } from "./actions/actions";
import { Site } from "./cards/cards";
import { OathGameObject } from "./gameObject";
import { OathPlayer } from "./player";
import { OathPower } from "./powers/powers";
import { ResourcesAndWarbands } from "./resources";
import { Constructor, WithOriginal } from "./utils";


export interface WithPowers extends OathGameObject {
    powers: Set<Constructor<OathPower<WithPowers>>>;
}

export function isWithPowers(obj: object): obj is WithPowers {
    return "powers" in obj;
}


export interface AtSite {
    site?: Site;
}

export function isAtSite(obj: object): obj is AtSite {
    return "site" in obj;
}


export interface OwnableObject {
    owner?: OathPlayer;
    setOwner(player?: OathPlayer): void;
}

export function isOwnable(obj: object): obj is OwnableObject {
    return "owner" in obj;
}


export interface CampaignActionTarget extends WithOriginal {
    defense: number;
    force: ResourcesAndWarbands | undefined;
    seize(player: OathPlayer): void;
}

export interface RecoverActionTarget extends WithOriginal {
    canRecover(action: RecoverAction): boolean;
    recover(player: OathPlayer): void;
}

