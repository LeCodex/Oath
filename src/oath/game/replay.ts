import { HistoryNode, OathActionManager } from "./actions/manager";
import { InvalidActionResolution } from "./actions/utils";
import { OathGame } from "./model/game";
import { OathPowerManager } from "./powers/manager";

export class OathReplayController {
    static saveVersion = 1;
    game: OathGame;
    actionManager: OathActionManager;
    powerManager: OathPowerManager;
    chunks: string[][] = [];

    constructor(gameId: number, setupData: typeof this.game.setupData) {
        this.game = new OathGame(gameId, setupData);
        this.actionManager = new OathActionManager(this.game);
        this.powerManager = new OathPowerManager(this.actionManager);

        this.actionManager.addInitialActions();
    }

    public stepForward() {
        let [chunkIndex, lineIndex] = this.currentChunkAndLine;
        try {
            lineIndex++;
            const lines = this.chunks[chunkIndex]!;
            if (lineIndex >= lines.length) {
                console.log(`Resolving chunk ${chunkIndex}`);
                chunkIndex++;
                lineIndex = 0;
            }
            const line = this.chunks[chunkIndex]![lineIndex]!;
            console.log(`   Resolving event ${lineIndex}: ${line}`);
            HistoryNode.loadEvent(this.actionManager, line, false);
        } catch (e) {
            console.error(`Replay of game ${this.game.gameId} failed:`, e);
            throw e;
        }

        return this.actionManager.defer();
    }

    public stepBackward() {
        return this.actionManager.forceCancelAction();
    }

    public moveTo(index: number) {
        const [chunkIndex, lineIndex] = this.indexToChunkAndLine(index);
        let [currentChunkIndex, currentLineIndex] = this.currentChunkAndLine;
        while (currentChunkIndex > chunkIndex || currentChunkIndex == chunkIndex && currentLineIndex > lineIndex) {
            this.stepBackward();
            [currentChunkIndex, currentLineIndex] = this.currentChunkAndLine;
        }
        while (currentChunkIndex < chunkIndex || currentChunkIndex == chunkIndex && currentLineIndex < lineIndex) {
            this.stepForward();
            [currentChunkIndex, currentLineIndex] = this.currentChunkAndLine;
        }

        return this.actionManager.defer();
    }

    private get currentChunkAndLine() {
        const chunkIndex = this.actionManager.history.length - 1;
        const lineIndex = this.actionManager.history[chunkIndex]!.events.length - 1;
        return [chunkIndex, lineIndex] as const;
    }

    private indexToChunkAndLine(index: number) {
        if (index < 0) throw new InvalidActionResolution("Cannot go to a negative index");

        let chunkIndex = 0;
        let lineIndex = 0;
        for (let i = 0; i < index; i++) {
            lineIndex++;
            if (lineIndex > this.chunks[chunkIndex]!.length) {
                lineIndex = 0;
                chunkIndex++;
                if (!this.chunks[chunkIndex]) throw new InvalidActionResolution("Index is outside of the replay's length");
            }
        }

        return [chunkIndex, lineIndex] as const;
    }

    public static load(gameId: number, data: string) {
        const chunks = data.split('\n\n');
        const metadata = JSON.parse(chunks.shift()!);
        if (metadata.version !== this.saveVersion)
            console.warn(`Save version is different than expected: ${metadata.version} instead of ${this.saveVersion}`);

        const setupData = JSON.parse(chunks.shift()!);
        const controller = new this(gameId, setupData);
        controller.actionManager.checkForNextAction(false);
        controller.chunks = chunks.map(e => e.split("\n"));
        return controller;
    }
}