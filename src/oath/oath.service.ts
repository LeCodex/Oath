import { ActionManagerReturn } from './game/actions/manager';
import { InvalidActionResolution } from "./game/actions/utils";
import * as fs from "fs";
import { range } from 'lodash';
import { OathController } from './game/controller';
import { Injectable, OnModuleInit, BadRequestException, NotFoundException } from '@nestjs/common';
import { OathGame } from './game/model/game';


@Injectable()
export class OathNestService implements OnModuleInit {
    games = new Map<number, OathController>();

    onModuleInit() {
        console.log(`Loading games`);
        if (!fs.existsSync("data/oath")) fs.mkdirSync("data/oath");
        const dir = fs.readdirSync("data/oath");
        for (const file of dir) {
            // console.log(`Checking ${file}`);
            const match = file.match(/save(\d+)\.jsonl/);
            if (match) {
                const id = Number(match[1]);
                const controller = OathController.load(id, fs.readFileSync("data/oath/" + file).toString());
                this.games.set(id, controller);
                console.log(`Loaded game ${id}`);
            }
        }
    }

    public getGames(): number[] {
        return [...this.games.keys()];
    }

    public startNewGame(seed: string) {
        const id = (this.games.size ? Math.max(...this.games.keys()) : 0) + 1;

        // TEMP: Forcefully set the number of players
        const controller = new OathController(id, [seed, range(4).map(e => "Player" + e)]);
        this.games.set(id, controller);
        
        controller.actionManager.checkForNextAction()
        const obj = controller.actionManager.defer() as ActionManagerReturn & { id: number };
        obj.id = id;
        return obj;
    }

    private _wrapper(gameId: number, func: (game: OathController) => ActionManagerReturn) {
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

    public reloadFromHistory(gameId: number) {
        return this._wrapper(gameId, (controller) => controller.actionManager.reloadFromHistory());
    }

    public reloadFromFinalState(gameId: number) {
        return this._wrapper(gameId, (controller) => controller.actionManager.reloadFromFinalStartState());
    }

    public getCurrentState(gameId: number) {
        return this._wrapper(gameId, (controller) => controller.actionManager.defer(false));
    }

    public continueAction(gameId: number, playerId: string, values: Record<string, string[]>) {
        return this._wrapper(gameId, (controller) => controller.actionManager.continueAction(playerId, values));
    }

    public cancelAction(gameId: number, playerId: string) {
        return this._wrapper(gameId, (controller) => controller.actionManager.cancelAction(playerId));
    }

    public consentToRollback(gameId: number, playerId: string) {
        return this._wrapper(gameId, (controller) => controller.actionManager.consentToRollback(playerId));
    }

    public endGame(gameId: number) {
        const controller = this._getGame(gameId);
        const obj = controller.actionManager.defer();
        delete obj.activeAction;
        this.games.delete(gameId);
        return obj;
    }
}

