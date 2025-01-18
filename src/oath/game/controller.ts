import { OathActionManager } from "./actions/manager";
import { OathGame } from "./model/game";
import { OathPowersManager } from "./powers/manager";

export class OathController {
    game: OathGame;
    actionManager: OathActionManager;
    powersManager: OathPowersManager;

    constructor(gameId: number, setupData: typeof this.game.setupData) {
        this.game = new OathGame(gameId, setupData);
        this.actionManager = new OathActionManager(this.game);
        this.powersManager = new OathPowersManager(this.game, this.actionManager);
        this.actionManager.initialActions();
    }

    stringify() {
        return this.game.stringify() + "\n\n" + this.actionManager.stringify();
    }

    static load(gameId: number, data: string) {
        const chunks = data.split('\n\n');
        const setupData = JSON.parse(chunks.shift()!);
        const controller = new this(gameId, setupData);
        controller.actionManager.parse(chunks);
        return controller;
    }
}