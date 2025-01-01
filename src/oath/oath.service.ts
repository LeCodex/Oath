import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { OathGame } from './game/game';
import { ActionManagerReturn } from './game/actions/manager';
import { InvalidActionResolution } from "./game/actions/base";
import * as fs from "fs";
import { range } from 'lodash';


@Injectable()
export class OathService implements OnModuleInit {
    games = new Map<number, OathGame>();

    onModuleInit() {
        console.log(`Loading games`);
        if (!fs.existsSync("data/oath")) fs.mkdirSync("data/oath");
        const dir = fs.readdirSync("data/oath");
        for (const file of dir) {
            // console.log(`Checking ${file}`);
            const match = file.match(/save(\d+)\.jsonl/);
            if (match) {
                const id = Number(match[1]);
                const game = OathGame.load(id, fs.readFileSync("data/oath/" + file).toString());
                this.games.set(id, game);
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
        const game = new OathGame(id, [seed, range(4).map(e => "Player" + e)]);
        this.games.set(id, game);
        
        game.actionManager.checkForNextAction()
        const obj = game.actionManager.defer() as ActionManagerReturn & { id: number };
        obj.id = id;
        return obj;
    }

    private _wrapper(gameId: number, func: (game: OathGame) => ActionManagerReturn) {
        try {
            const result = func(this._getGame(gameId));
            if (result.over) this.games.delete(gameId);
            return result;
        } catch (e) {
            // TODO: Use exception filters
            if (e instanceof InvalidActionResolution) throw new BadRequestException({ error: "InvalidActionResolution", message: e.message });
            throw e;
        }
    }

    private _getGame(id: number): OathGame {
        const game = this.games.get(id);
        if (!game) throw new NotFoundException(`Game not found with id ${id}`);
        return game;
    }

    public reloadFromHistory(gameId: number) {
        return this._wrapper(gameId, (game) => game.actionManager.reloadFromHistory());
    }

    public reloadFromFinalState(gameId: number) {
        return this._wrapper(gameId, (game) => game.actionManager.reloadFromFinalState());
    }

    public beginAction(gameId: number, playerId: string, actionName: string) {        
        return this._wrapper(gameId, (game) => game.actionManager.startAction(playerId, actionName));
    }

    public getCurrentState(gameId: number) {
        return this._wrapper(gameId, (game) => game.actionManager.defer(false));
    }

    public continueAction(gameId: number, playerId: string, values: Record<string, string[]>) {
        return this._wrapper(gameId, (game) => game.actionManager.continueAction(playerId, values));
    }

    public cancelAction(gameId: number, playerId: string) {
        return this._wrapper(gameId, (game) => game.actionManager.cancelAction(playerId));
    }

    public consentToRollback(gameId: number, playerId: string) {
        return this._wrapper(gameId, (game) => game.actionManager.consentToRollback(playerId));
    }

    public endGame(gameId: number) {
        const game = this._getGame(gameId);
        const obj = game.actionManager.defer();
        obj.over = true;
        this.games.delete(gameId);
        return obj;
    }
}

