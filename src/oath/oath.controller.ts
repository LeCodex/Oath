import { Body, Controller, Get, Param, ParseIntPipe, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { OathService } from './oath.service';

@Controller("/oath")
export class OathController {
    constructor(private readonly service: OathService) {}

    @Get()
    getGames(): number[] {
        return this.service.getGames();
    }

    @Post()
    @UsePipes(new ValidationPipe({ transform: true }))
    createGame(@Body() seed: string): object {
        return this.service.startNewGame(seed);
    }

    @Get(":id")
    getGame(@Param('id', ParseIntPipe) id: number): object {
        return this.service.getCurrentState(id);
    }

    @Post(":id/:player/start/:action")
    startAction(@Param('id', ParseIntPipe) id: number, @Param('player', ParseIntPipe) player: number, @Param('action') action: string): object {
        return this.service.beginAction(id, player, action);
    }

    @Post(":id/:player/continue")
    @UsePipes(new ValidationPipe({ transform: true }))
    continueAction(@Param('id', ParseIntPipe) id: number, @Param('player', ParseIntPipe) player: number, @Body() values: Record<string, string[]>): object {
        return this.service.continueAction(id, player, values);
    }

    @Post(":id/:player/cancel")
    @UsePipes(new ValidationPipe({ transform: true }))
    cancelAction(@Param('id', ParseIntPipe) id: number, @Param('player', ParseIntPipe) player: number): object {
        return this.service.cancelAction(id, player);
    }
}
