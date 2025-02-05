import type { RecoverAction } from "../actions";
import type { RecoverActionTarget, CampaignActionTarget, WithPowers, OwnableObject } from "./interfaces";
import { OathSuit } from "../enums";
import { isEnumKey } from "../utils";
import { OathPlayer } from "./player";
import type { OathResource } from "./resources";
import { Favor, Secret } from "./resources";
import { Container } from "./gameObject";
import type { BannerPowerName } from "../powers/classIndex";

export class FavorBank extends Container<Favor, OathSuit> {
    declare readonly id: keyof typeof OathSuit;
    readonly type = "favorBank";
    declare cls: typeof Favor;

    constructor(id: keyof typeof OathSuit) {
        if (!isEnumKey(id, OathSuit)) throw TypeError(`${id} is not a valid suit`);
        super(id, Favor);
    }

    get name() { return `${this.id}Bank`; }
    get key() { return OathSuit[this.id]; }
}

export abstract class Banner<T extends OathResource = OathResource> extends Container<T, string> implements OwnableObject, RecoverActionTarget, CampaignActionTarget, WithPowers {
    readonly type = "banner";
    powers = new Set<BannerPowerName>();
    active = true;
    min = 1;

    get key() { return this.id; }
    get owner() { return this.typedParent(OathPlayer); }
    get defense() { return this.amount; }
    get force() { return this.owner; }

    setOwner(player?: OathPlayer): void {
        player?.addChild(this);
    }

    canRecover(action: RecoverAction): boolean {
        return action.player.byClass(this.cls).length > this.amount;
    }
}

export class PeoplesFavor extends Banner<Favor> {
    declare readonly id: "PeoplesFavor";
    name = "PeoplesFavor";
    declare cls: typeof Favor;
    isMob: boolean;

    constructor() {
        super("PeoplesFavor", Favor);
        this.powers.add("PeoplesFavorSearch");
        this.powers.add("PeoplesFavorWake");
    }

    liteSerialize() {
        return {
            ...super.liteSerialize(),
            isMob: this.isMob
        };
    }

    parse(obj: ReturnType<this["liteSerialize"]>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.isMob = obj.isMob;
    }
}

export class DarkestSecret extends Banner<Secret> {
    declare readonly id: "DarkestSecret";
    name = "DarkestSecret";
    declare cls: typeof Secret;

    constructor() {
        super("DarkestSecret", Secret);
        this.powers.add("DarkestSecretPower");
    }

    canRecover(action: RecoverAction): boolean {
        if (!super.canRecover(action)) return false;
        if (!this.owner || this.owner === action.player) return true;

        for (const denizen of this.owner.site.denizens) {
            if (this.owner.suitAdviserCount(denizen.suit) === 0) {
                return true;
            }
        }

        return false;
    }
}
