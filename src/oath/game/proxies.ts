import { OathCard, WorldCard } from "./cards/cards";
import { OathGame } from "./game";
import { OathPlayer } from "./player";
import { OathPower } from "./power";

// Proxies are data copies with all members set to their current values at the time the snapshot is taken
// They allow powers to modify those copies, that actions and effect read from, in order to implement 
// some of the more complicated powers in a smooth way. This effectively allows us to lie to actions and effects

export abstract class Proxy<T> {
    original: T;

    constructor(original: T) {
        this.original = original;
    }
}

export class GameProxy extends Proxy<OathGame> {
    board = new BoardProxy(this);
}

export class WorldCardProxy<T extends WorldCard> extends Proxy<T> {
    powers: Set<Constructor<OathPower<OathCard>>>;
}

export class PlayerProxy extends Proxy<OathPlayer> {
    advisers = new Set<WorldCardProxy>();

    constructor(player: OathPlayer) {
        super(player);
        this.original = player;
        this.advisers = new Set(player.advisers);
    }
}