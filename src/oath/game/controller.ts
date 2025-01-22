import { OathActionManager } from "./actions/manager";
import { OathPhase } from "./enums";
import { OathGame } from "./model/game";
import { OathPowerManager } from "./powers/manager";
import * as fs from "fs";

export class OathController {
    game: OathGame;
    actionManager: OathActionManager;
    powerManager: OathPowerManager;

    constructor(gameId: number, setupData: typeof this.game.setupData) {
        this.game = new OathGame(gameId, setupData);
        this.actionManager = new OathActionManager(this.game);
        this.powerManager = new OathPowerManager(this.actionManager);

        this.actionManager.initialActions();
        this.actionManager.on("save", () => { this.save(); });
        this.actionManager.on("emptyStack", () => { if (this.game.phase === OathPhase.Over) this.archiveSave(); });
    }

    stringify() {
        return this.game.stringify() + "\n\n" + this.actionManager.stringify();
    }

    get savePath() { return `data/oath/save${this.game.gameId}.jsonl`; }
    get archivePath() { return `data/oath/replay${Date.now()}.jsonl`; }

    save() {
        const data = this.stringify();
        fs.writeFileSync(this.savePath, data);
    }

    archiveSave() {
        const data = this.stringify() + "\n\n" + JSON.stringify(this.game.seed);
        fs.writeFileSync(this.archivePath, data);
        fs.rmSync(this.savePath)
    }

    static load(gameId: number, data: string) {
        const chunks = data.split('\n\n');
        const setupData = JSON.parse(chunks.shift()!);
        const controller = new this(gameId, setupData);
        controller.actionManager.parse(chunks);
        return controller;
    }
}