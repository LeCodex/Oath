import { recordExecutionTime } from "../utils";
import { OathActionManager } from "./actions/manager";
import { OathPhase } from "./enums";
import { OathGame } from "./model/game";
import { OathPowerManager } from "./powers/manager";
import * as fs from "fs";

export class OathController {
    static saveVersion = 1;
    game: OathGame;
    actionManager: OathActionManager;
    powerManager: OathPowerManager;

    constructor(gameId: number, setupData: typeof this.game.setupData) {
        this.game = new OathGame(gameId, setupData);
        this.actionManager = new OathActionManager(this.game);
        this.powerManager = new OathPowerManager(this.actionManager);

        this.actionManager.addInitialActions();
        this.actionManager.on("save", () => { this.save(); });
        this.actionManager.on("emptyStack", () => { if (this.game.phase === OathPhase.Over) this.archiveSave(); });
    }

    stringify(archive: boolean) {
        return JSON.stringify({ version: OathController.saveVersion }) + "\n\n" + this.game.stringify() + "\n\n" + this.actionManager.stringify(archive);
    }

    get savePath() { return `data/oath/save${this.game.gameId}.jsonl`; }
    get archivePath() { return `data/oath/replay${Date.now()}.jsonl`; }

    save() {
        const data = this.stringify(false);
        fs.writeFileSync(this.savePath, data);
    }

    archiveSave() {
        const data = this.stringify(true);
        fs.writeFileSync(this.archivePath, data);
        fs.rmSync(this.savePath)
    }

    @recordExecutionTime()
    static load(gameId: number, data: string) {
        const chunks = data.split('\n\n');
        const metadata = JSON.parse(chunks.shift()!);
        if (metadata.version !== this.saveVersion)
            console.warn(`Save version is different than expected: ${metadata.version} instead of ${this.saveVersion}`);

        const setupData = JSON.parse(chunks.shift()!);
        const controller = new this(gameId, setupData);
        controller.actionManager.parse(chunks);
        return controller;
    }
}