import { OathType } from "../enums";
import { OathGameObjectLeaf } from "./gameObject";
import type { OwnableObject, WithPowers } from "./interfaces";
import { OathPlayer } from "./player";
import { maxInGroup } from "../utils";
import type { PowerName } from "../powers/classIndex";
import { oathData } from "./utils";


export class Oath extends OathGameObjectLeaf<string> implements OwnableObject, WithPowers {
    readonly type = "oath";
    declare readonly id: "Oath";
    powers = new Set<PowerName>(["OathDefense"]);
    active = true;

    oathType: OathType;
    
    constructor() {
        super("Oath");
    }
    
    get key() { return this.id; }
    get name() { return `OathOf${OathType[this.oathType]}`; }
    get owner() { return this.typedParent(OathPlayer); }

    setType(oathType: OathType) {
        this.oathType = oathType;
        return this;
    }
    
    setup() { oathData[this.oathType][0]!(this.game); };
    
    setOwner(player?: OathPlayer): void {
        player?.addChild(this);
    }

    getCandidates(evaluation: (player: OathPlayer) => number): Set<OathPlayer> {
        return new Set(maxInGroup(this.game.players, evaluation));
    }

    getOathkeeperCandidates(): Set<OathPlayer> {
        return this.getCandidates(oathData[this.oathType][1]);
    }

    getSuccessorCandidates(): Set<OathPlayer> {
        return this.getCandidates(oathData[this.oathType][2]);
    }

    liteSerialize() {
        return {
            ...super.liteSerialize(),
            oath: this.oathType
        };
    }

    parse(obj: ReturnType<this["liteSerialize"]>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.oathType = obj.oath;
    }
}
