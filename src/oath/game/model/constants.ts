import { OathType } from "../enums";
import { PeoplesFavor, DarkestSecret } from "./banks";
import { GrandScepter } from "./cards";
import type { OathGame } from "./game";
import type { OathPlayer } from "./player";


export const oathData: Record<OathType, [(game: OathGame) => void, (player: OathPlayer) => number, (player: OathPlayer) => number]> = {
    [OathType.Supremacy]: [
        () => { },
        (player) => [...player.game.map.sites()].filter(e => e.ruler === player).length,
        (player) => player.relics.length + player.banners.length
    ],
    [OathType.Protection]: [
        () => { },
        (player) => player.relics.length + player.banners.length,
        (player) => player.byClass(PeoplesFavor).length
    ],
    [OathType.ThePeople]: [
        (game) => { game.byClass(PeoplesFavor)[0]?.parentTo(game.chancellor); },
        (player) => player.byClass(PeoplesFavor).length,
        (player) => player.byClass(DarkestSecret).length
    ],
    [OathType.Devotion]: [
        (game) => { game.byClass(DarkestSecret)[0]?.parentTo(game.chancellor); },
        (player) => player.byClass(DarkestSecret).length,
        (player) => player.byClass(GrandScepter).length
    ],
};
