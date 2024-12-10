import { DarkestSecret, PeoplesFavor } from "./banks";
import { GrandScepter } from "./cards/cards";
import { OathType, isEnumKey } from "./enums";
import { OathGame } from "./game";
import { OathGameObjectLeaf } from "./gameObject";
import { OwnableObject, WithPowers } from "./interfaces";
import { OathPlayer } from "./player";
import { OathDefense } from "./powers/visions";
import { maxInGroup } from "./utils";


export const oathData: Record<OathType, [(game: OathGame) => void, (game: OathGame, player: OathPlayer) => number, (game: OathGame, player: OathPlayer) => number]> = {
    [OathType.Supremacy]: [
        (game) => { },
        (game, player) => [...game.board.sites()].filter(e => e.ruler === player).length,
        (game, player) => player.relics.length + player.banners.length
    ],
    [OathType.Protection]: [
        (game) => { },
        (game, player) => player.relics.length + player.banners.length,
        (game, player) => player.byClass(PeoplesFavor).length > 0 ? 1 : 0
    ],
    [OathType.ThePeople]: [
        (game) => { game.byClass(PeoplesFavor)[0]?.parentTo(game.chancellor); },
        (game, player) => player.byClass(PeoplesFavor).length > 0 ? 1 : 0,
        (game, player) => player.byClass(DarkestSecret).length > 0 ? 1 : 0
    ],
    [OathType.Devotion]: [
        (game) => { game.byClass(DarkestSecret)[0]?.parentTo(game.chancellor); },
        (game, player) => player.byClass(DarkestSecret).length > 0 ? 1 : 0,
        (game, player) => player.byClass(GrandScepter).length > 0 ? 1 : 0
    ],
};

export class Oath extends OathGameObjectLeaf<OathType> implements OwnableObject, WithPowers {
    type = "oath";
    oathType: OathType;
    active = true;
    powers = new Set([OathDefense]);
    
    constructor() {
        super("oath");
    }
    
    get key() { return this.oathType; }
    get owner() { return this.typedParent(OathPlayer); }

    setType(oathType: OathType) {
        this.oathType = oathType;
        return this;
    }
    
    setup() { oathData[this.oathType][0]!(this.game); };
    scoreForOathkeeper(player: OathPlayer) { return oathData[this.oathType][1]!(this.game, player); };
    scoreForSuccessor(player: OathPlayer) { return oathData[this.oathType][2]!(this.game, player); };
    
    setOwner(player?: OathPlayer): void {
        player?.addChild(this);
    }

    getCandidates(evaluation: (player: OathPlayer) => number): Set<OathPlayer> {
        return new Set(maxInGroup(this.game.players, evaluation));
    }

    getOathkeeperCandidates(): Set<OathPlayer> {
        return this.getCandidates(this.scoreForOathkeeper.bind(this));
    }

    getSuccessorCandidates(): Set<OathPlayer> {
        return this.getCandidates(this.scoreForSuccessor.bind(this));
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
