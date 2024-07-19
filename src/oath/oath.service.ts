import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { OathGame } from './game/game';
import { OathType } from './game/enums';
import { CampaignAction, InvalidActionResolution, MusterAction, OathAction, RecoverAction, RestAction, SearchAction, TradeAction, TravelAction, UsePowerAction } from './game/actions';
import { Constructor } from './game/utils';

@Injectable()
export class OathService {
    games = new Map<number, OathGame>();

    public getGames(): number[] {
        return [...this.games.keys()];
    }

    public startNewGame(): number {
        const id = (this.games.size ? Math.max(...this.games.keys()) : 0) + 1;

        // TEMP: Forcefully set the number of players and oath
        this.games.set(id, new OathGame(OathType.Supremacy, 4));
        return id;
    }

    private _getGame(id: number): OathGame {
        const game = this.games.get(id);
        if (!game) throw new BadRequestException(`Game not found with id ${id}`);
        return game;
    }

    public beginAction(gameId: number, playerIndex: number, actionName: string): object {
        const nameToAction: Record<string, Constructor<OathAction>> = {
            "trade": TradeAction,
            "muster": MusterAction,
            "travel": TravelAction,
            "recover": RecoverAction,
            "search": SearchAction,
            "campaign": CampaignAction,
            "use": UsePowerAction,
            "rest": RestAction
        }
        const action = nameToAction[actionName];
        if (!action) throw new BadRequestException(`Invalid action name ${actionName}`);
        
        try {
            return this._getGame(gameId).startAction(playerIndex, action);
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
}

