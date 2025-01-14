import { DarkestSecret, PeoplesFavor } from "./banks";
import { GrandScepter } from "./cards";
import { OathType } from "./enums";
import type { OathGame } from "./game";
import { OathGameObjectLeaf } from "./gameObject";
import type { OwnableObject, WithPowers } from "./interfaces";
import { OathPlayer } from "./player";
import { OathDefense } from "./powers/visions";
import { maxInGroup } from "./utils";


export const oathData: Record<OathType, [(game: OathGame) => void, (player: OathPlayer) => number, (player: OathPlayer) => number]> = {
    [OathType.Supremacy]: [
        () => {},
        (player) => [...player.game.map.sites()].filter(e => e.ruler === player).length,
        (player) => player.relics.length + player.banners.length
    ],
    [OathType.Protection]: [
        () => {},
        (player) => player.relics.length + player.banners.length,
        (player) => player.byClass(PeoplesFavor).length > 0 ? 1 : 0
    ],
    [OathType.ThePeople]: [
        (game) => { game.byClass(PeoplesFavor)[0]?.parentTo(game.chancellor); },
        (player) => player.byClass(PeoplesFavor).length > 0 ? 1 : 0,
        (player) => player.byClass(DarkestSecret).length > 0 ? 1 : 0
    ],
    [OathType.Devotion]: [
        (game) => { game.byClass(DarkestSecret)[0]?.parentTo(game.chancellor); },
        (player) => player.byClass(DarkestSecret).length > 0 ? 1 : 0,
        (player) => player.byClass(GrandScepter).length > 0 ? 1 : 0
    ],
};

export class Oath extends OathGameObjectLeaf<string> implements OwnableObject, WithPowers {
    readonly type = "oath";
    declare readonly id: "oath";
    oathType: OathType;
    active = true;
    powers = new Set([OathDefense]);
    
    constructor() {
        super("oath");
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
