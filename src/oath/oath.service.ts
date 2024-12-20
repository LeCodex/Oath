import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
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
            const match = file.match(/save(\d+)\.txt/);
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

    public startNewGame(seed: string): object {
        const id = (this.games.size ? Math.max(...this.games.keys()) : 0) + 1;

        // TEMP: Forcefully set the number of players
        const game = new OathGame(id, [seed, range(4).map(e => "Player" + e)]);
        this.games.set(id, game);
        
        game.actionManager.checkForNextAction()
        const obj = game.actionManager.defer() as ActionManagerReturn & { id: number };
        obj.id = id;
        return obj;
    }

    private _wrapper(gameId: number, func: () => ActionManagerReturn) {
        try {
            const result = func();
            if (result.over) this.games.delete(gameId);
            return result;
        } catch (e) {
            // TODO: Use exception filters
            if (e instanceof InvalidActionResolution) throw new BadRequestException(e.message);
            throw e;
        }
    }

    private _getGame(id: number): OathGame {
        const game = this.games.get(id);
        if (!game) throw new BadRequestException(`Game not found with id ${id}`);
        return game;
    }

    public beginAction(gameId: number, playerId: string, actionName: string): object {        
        return this._wrapper(gameId, () => this._getGame(gameId).startAction(playerId, actionName));
    }

    public getCurrentState(gameId: number): object {
        return this._getGame(gameId).actionManager.defer();
    }

    public continueAction(gameId: number, playerId: string, values: Record<string, string[]>): object {
        return this._wrapper(gameId, () => this._getGame(gameId).actionManager.continueAction(playerId, values));
    }

    public cancelAction(gameId: number, playerId: string): object {
        return this._wrapper(gameId, () => this._getGame(gameId).actionManager.cancelAction(playerId));
    }

    public consentToRollback(gameId: number, playerId: string): object {
        return this._wrapper(gameId, () => this._getGame(gameId).actionManager.consentToRollback(playerId));
    }
}

