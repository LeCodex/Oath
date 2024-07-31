import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { OathGame } from './game/game';
import { OathType } from './game/enums';
import { CampaignAction, InvalidActionResolution, MoveWarbandsAction, MusterAction, OathAction, PlayFacedownAdviserAction, RecoverAction, RestAction, SearchAction, TradeAction, TravelAction, UsePowerAction } from './game/actions';
import { Constructor } from './game/utils';

@Injectable()
export class OathService {
    games = new Map<number, OathGame>();

    public getGames(): number[] {
        return [...this.games.keys()];
    }

    public startNewGame(): object {
        const id = (this.games.size ? Math.max(...this.games.keys()) : 0) + 1;

        // TEMP: Forcefully set the number of players and oath
        const game = new OathGame(OathType.Supremacy, 4);
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

    public beginAction(gameId: number, playerIndex: number, actionName: string): object {        
        try {
            return this._getGame(gameId).startAction(playerIndex, actionName);
        } catch (e) {
            // TODO: Use exception filters
            if (e instanceof InvalidActionResolution) throw new BadRequestException(e.message);
            throw e;
        }
    }

    public getCurrentState(gameId: number): object {
        return this._getGame(gameId).actionManager.checkForNextAction();
    }

    public continueAction(gameId: number, playerIndex: number, values: Record<string, string[]>): object {
        try {
            return this._getGame(gameId).actionManager.continueAction(playerIndex, values);
        } catch (e) {
            if (e instanceof InvalidActionResolution) throw new BadRequestException(e.message);
            throw e;
        }
    }

    public cancelAction(gameId: number, playerIndex: number): object {
        try {
            return this._getGame(gameId).actionManager.cancelAction();
        } catch (e) {
            if (e instanceof InvalidActionResolution) throw new BadRequestException(e.message);
            throw e;
        }
    }
}

