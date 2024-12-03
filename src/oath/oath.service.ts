import { BadRequestException, Injectable } from '@nestjs/common';
import { OathGame } from './game/game';
import { InvalidActionResolution } from "./game/actions/base";
import { PlayerColor } from './game/enums';


@Injectable()
export class OathService {
    games = new Map<number, OathGame>();

    public getGames(): number[] {
        return [...this.games.keys()];
    }

    public startNewGame(seed: string): object {
        const id = (this.games.size ? Math.max(...this.games.keys()) : 0) + 1;

        // TEMP: Forcefully set the number of players
        const game = new OathGame();
        game.setup(seed, 4);
        this.games.set(id, game);
        
        const obj = game.actionManager.checkForNextAction();
        obj.id = id;
        return obj;
    }

    private _getGame(id: number): OathGame {
        const game = this.games.get(id);
        if (!game) throw new BadRequestException(`Game not found with id ${id}`);
        return game;
    }

    public beginAction(gameId: number, playerColor: keyof typeof PlayerColor, actionName: string): object {        
        try {
            return this._getGame(gameId).startAction(playerColor, actionName);
        } catch (e) {
            // TODO: Use exception filters
            if (e instanceof InvalidActionResolution) throw new BadRequestException(e.message);
            throw e;
        }
    }

    public getCurrentState(gameId: number): object {
        return this._getGame(gameId).actionManager.checkForNextAction();
    }

    public continueAction(gameId: number, playerColor: keyof typeof PlayerColor, values: Record<string, string[]>): object {
        try {
            return this._getGame(gameId).actionManager.continueAction(playerColor, values);
        } catch (e) {
            if (e instanceof InvalidActionResolution) throw new BadRequestException(e.message);
            throw e;
        }
    }

    public cancelAction(gameId: number, playerColor: keyof typeof PlayerColor): object {
        try {
            return this._getGame(gameId).actionManager.cancelAction();
        } catch (e) {
            if (e instanceof InvalidActionResolution) throw new BadRequestException(e.message);
            throw e;
        }
    }
}

