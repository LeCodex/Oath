import { OathGame } from "./game";
import { WithOriginal } from "./utils";


export abstract class OathGameObject extends WithOriginal {
    game: OathGame;

    constructor(game: OathGame) {
        super();
        this.game = game;
    }
}
