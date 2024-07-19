import { OathGame } from "./game";
import { CopiableWithOriginal } from "./utils";


export abstract class OathGameObject extends CopiableWithOriginal {
    game: OathGame;

    constructor(game: OathGame) {
        super();
        this.game = game;
    }
}
