import { Body, Controller, Get, Param, ParseIntPipe, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { OathService } from './oath.service';
import { PlayerColor } from './game/enums';

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
    startAction(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerColor: keyof typeof PlayerColor, @Param('action') action: string): object {
        return this.service.beginAction(gameId, playerColor, action);
    }

    @Post(":id/:player/continue")
    @UsePipes(new ValidationPipe({ transform: true }))
    continueAction(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerColor: keyof typeof PlayerColor, @Body() values: Record<string, string[]>): object {
        return this.service.continueAction(gameId, playerColor, values);
    }

    @Post(":id/:player/cancel")
    @UsePipes(new ValidationPipe({ transform: true }))
    cancelAction(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerColor: keyof typeof PlayerColor): object {
        return this.service.cancelAction(gameId, playerColor);
    }
}
