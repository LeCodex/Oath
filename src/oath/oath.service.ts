import { ActionManagerReturn } from './game/actions/manager';
import { InvalidActionResolution } from "./game/actions/utils";
import * as fs from "fs";
import { range } from 'lodash';
import { OathController } from './game/controller';
import { Injectable, OnModuleInit, BadRequestException, NotFoundException } from '@nestjs/common';
import { OathGame } from './game/model/game';
import { SerializedNode } from './game/model/utils';
import { OathReplayController } from './game/replay';
import { logRecordedTimes } from './utils';


@Injectable()
export class OathNestService implements OnModuleInit {
    games = new Map<number, OathController>();
    replays = new Map<number, OathReplayController>();
    replayFiles = new Map<number, string>();

    onModuleInit() {
        console.log(`Loading games`);
        if (!fs.existsSync("data/oath")) fs.mkdirSync("data/oath", { recursive: true });
        const dir = fs.readdirSync("data/oath");
        for (const file of dir) {
            // console.log(`Checking ${file}`);
            const saveMatch = file.match(/save(\d+)\.jsonl/);
            if (saveMatch) {
                const id = Number(saveMatch[1]);
                const controller = OathController.load(id, fs.readFileSync("data/oath/" + file).toString());
                this.games.set(id, controller);
                console.log(`Loaded game ${id}`);
            }

            const replayMatch = file.match(/replay(\d+)\.jsonl/);
            if (replayMatch) {
                const id = Number(replayMatch[1]);
                this.replayFiles.set(id, file);
            }
        }
        logRecordedTimes();
    }

    public getGames(): number[] {
        return [...this.games.keys()];
    }

    public getReplays(): number[] {
        return [...this.replayFiles.keys()];
    }

    public startNewGame(seed: string) {
        const id = Math.max(0, ...this.games.keys()) + 1;

        // TEMP: Forcefully set the number of players
        const controller = new OathController(id, [seed, range(4).map((e) => "Player" + e)]);
        this.games.set(id, controller);
        
        controller.actionManager.checkForNextAction()
        const obj = controller.actionManager.defer() as ActionManagerReturn & { id: number };
        obj.id = id;
        return obj;
    }

    private _gameWrapper(gameId: number, func: (game: OathController) => ActionManagerReturn) {
        try {
            const result = func(this._getGame(gameId));
            if (!result.activeAction) this.games.delete(gameId);
            return result;
        } catch (e) {
            // TODO: Use exception filters
            if (e instanceof InvalidActionResolution) throw new BadRequestException({ error: "InvalidActionResolution", message: e.message });
            throw e;
        }
    }

    private _getGame(id: number): OathController {
        const controller = this.games.get(id);
        if (!controller) throw new NotFoundException(`Game not found with id ${id}`);
        return controller;
    }

    private _replayWrapper(replayId: number, func: (game: OathReplayController) => ActionManagerReturn) {
        try {
            const result = func(this._getReplay(replayId));
            if (!result.activeAction) this.games.delete(replayId);
            return result;
        } catch (e) {
            // TODO: Use exception filters
            if (e instanceof InvalidActionResolution) throw new BadRequestException({ error: "InvalidActionResolution", message: e.message });
            throw e;
        }
    }

    private _getReplay(id: number): OathReplayController {
        const controller = this.replays.get(id);
        if (!controller) throw new NotFoundException(`Replay not found with id ${id}`);
        return controller;
    }

    public reloadFromHistory(gameId: number) {
        return this._gameWrapper(gameId, (controller) => controller.actionManager.reloadFromHistory());
    }

    public reloadFromFinalState(gameId: number) {
        return this._gameWrapper(gameId, (controller) => controller.actionManager.reloadFromFinalStartState());
    }

    public getCurrentState(gameId: number) {
        return this._gameWrapper(gameId, (controller) => controller.actionManager.defer(false));
    }

    public continueAction(gameId: number, playerId: string, values: Record<string, string[]>) {
        return this._gameWrapper(gameId, (controller) => controller.actionManager.continueAction(playerId, values));
    }

    public cancelAction(gameId: number, playerId: string) {
        return this._gameWrapper(gameId, (controller) => controller.actionManager.cancelAction(playerId));
    }

    public consentToRollback(gameId: number, playerId: string) {
        return this._gameWrapper(gameId, (controller) => controller.actionManager.consentToRollback(playerId));
    }

    public editGameState(gameId: number, gameState: SerializedNode<OathGame>) {
        return this._gameWrapper(gameId, (controller) => controller.actionManager.editGameState(gameState));
    }

    public endGame(gameId: number) {
        const controller = this._getGame(gameId);
        const obj = controller.actionManager.defer();
        delete obj.activeAction;
        this.games.delete(gameId);
        return obj;
    }

    public loadReplay(id: number) {
        const file = this.replayFiles.get(id);
        if (!file) throw new NotFoundException(`Replay file not found with id ${id}`);

        const replayId = Math.max(0, ...this.replays.keys()) + 1;
        const controller = OathReplayController.load(id, fs.readFileSync("data/oath/" + file).toString());
        this.replays.set(replayId, controller);

        const obj = controller.actionManager.defer(false) as ActionManagerReturn & { id: number };
        obj.id = id;
        return obj;
    }

    public stepReplayForward(replayId: number) {
        return this._replayWrapper(replayId, (controller) => controller.stepForward());
    }

    public stepReplayBackward(replayId: number) {
        return this._replayWrapper(replayId, (controller) => controller.stepBackward());
    }

    public moveReplayTo(replayId: number, index: number) {
        return this._replayWrapper(replayId, (controller) => controller.moveTo(index));
    }

    public endReplay(replayId: number) {
        const controller = this._getReplay(replayId);
        const obj = controller.actionManager.defer();
        delete obj.activeAction;
        this.replays.delete(replayId);
        return obj;
    }
}

