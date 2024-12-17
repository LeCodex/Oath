import { Body, Controller, Get, Param, ParseIntPipe, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { OathService } from './oath.service';

@Controller("/oath")
export class OathController {
    constructor(private readonly service: OathService) {}

    @Get()
    getGames(): number[] {
        return this.service.getGames();
    }

    @Post(":seed")
    createGame(@Param('seed') seed: string): object {
        return this.service.startNewGame(seed);
    }

    @Get(":id")
    getGame(@Param('id', ParseIntPipe) gameId: number): object {
        return this.service.getCurrentState(gameId);
    }

    @Post(":id/:player/start/:action")
    startAction(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerId: string, @Param('action') action: string): object {
        return this.service.beginAction(gameId, playerId, action);
    }

    @Post(":id/:player/continue")
    @UsePipes(new ValidationPipe({ transform: true }))
    continueAction(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerId: string, @Body() values: Record<string, string[]>): object {
        return this.service.continueAction(gameId, playerId, values);
    }

    @Post(":id/:player/cancel")
    @UsePipes(new ValidationPipe({ transform: true }))
    cancelAction(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerId: string): object {
        return this.service.cancelAction(gameId, playerId);
    }

    @Post(":id/:player/consent")
    @UsePipes(new ValidationPipe({ transform: true }))
    consentToRollback(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerId: string): object {
        return this.service.consentToRollback(gameId, playerId);
    }
}
