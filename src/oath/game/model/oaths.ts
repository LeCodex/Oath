import { OathType } from "../enums";
import { OathGameObjectLeaf } from "./gameObject";
import type { OwnableObject, WithPowers } from "./interfaces";
import { OathPlayer } from "./player";
import { maxInGroup } from "../utils";
import type { PowerName } from "../powers/classIndex";
import { oathData } from "./constants";
import type { OathGame } from "./game";


export class Oath {
    constructor(
        public game: OathGame,
        public oathType: OathType
    ) { }
    
    setup() { oathData[this.oathType][0]!(this.game); };

    getCandidates(evaluation: (player: OathPlayer) => number): Set<OathPlayer> {
        return new Set(maxInGroup(this.game.players, evaluation));
    }

    getOathkeeperCandidates(): Set<OathPlayer> {
        return this.getCandidates(oathData[this.oathType][1]);
    }

    getSuccessorCandidates(): Set<OathPlayer> {
        return this.getCandidates(oathData[this.oathType][2]);
    }
}


export class OathkeeperTile extends OathGameObjectLeaf<string> implements OwnableObject, WithPowers {
    readonly type = "oath";
    declare readonly id: "Oath";
    powers = new Set<PowerName>(["OathkeeperDefense"]);
    active = true;

    oath: Oath;
    
    constructor() {
        super("Oath");
    }
    
    get key() { return this.id; }
    get name() { return `OathOf${OathType[this.oath.oathType]}`; }
    get owner() { return this.typedParent(OathPlayer); }

    setType(oathType: OathType) {
        this.oath = new Oath(this.game, oathType);
        return this;
    }
    
    setOwner(player?: OathPlayer): void {
        player?.addChild(this);
    }

    liteSerialize() {
        return {
            ...super.liteSerialize(),
            oath: this.oath.oathType
        };
    }

    parse(obj: ReturnType<this["liteSerialize"]>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.setType(obj.oath);
    }
}
