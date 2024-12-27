import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { OathService } from './oath.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ActionManagerReturn } from './game/actions/manager';

@Controller("/oath")
export class OathController {
    constructor(private readonly service: OathService) {}

    @Get()
    @ApiOperation({ summary: "Get a list of all games" })
    @ApiResponse({ status: 200, description: "List of game IDs" })
    getGames(): number[] {
        return this.service.getGames();
    }

    @Post(":seed")
    @ApiOperation({ summary: "Create a game" })
    @ApiResponse({ status: 201, description: "Game state with id", type: ActionManagerReturn })
    createGame(@Param('seed') seed: string): ActionManagerReturn & { id: number } {
        return this.service.startNewGame(seed);
    }

    @Get(":id")
    @ApiOperation({ summary: "Get an active game" })
    @ApiResponse({ status: 200, description: "Game state", type: ActionManagerReturn })
    @ApiResponse({ status: 404, description: "Not found" })
    getGame(@Param('id', ParseIntPipe) gameId: number): ActionManagerReturn {
        return this.service.getCurrentState(gameId);
    }

    @Post(":id/:player/start/:action")
    @ApiOperation({ summary: "Start an action in an active game.", description: "The action stack must be empty (startOptions is defined)" })
    @ApiResponse({ status: 200, description: "Game state", type: ActionManagerReturn })
    @ApiResponse({ status: 404, description: "Not found" })
    @ApiResponse({ status: 400, description: "Invalid action" })
    startAction(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerId: string, @Param('action') action: string): ActionManagerReturn {
        return this.service.beginAction(gameId, playerId, action);
    }

    @Post(":id/:player/continue")
    @UsePipes(new ValidationPipe({ transform: true }))
    @ApiOperation({ summary: "Continue an active action in an active game", description: "The action stack must not be empty (activeAction is defined)" })
    @ApiResponse({ status: 200, description: "Game state", type: ActionManagerReturn })
    @ApiResponse({ status: 404, description: "Not found" })
    @ApiResponse({ status: 400, description: "Invalid action" })
    continueAction(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerId: string, @Body() values: Record<string, string[]>): ActionManagerReturn {
        return this.service.continueAction(gameId, playerId, values);
    }

    @Post(":id/:player/cancel")
    @UsePipes(new ValidationPipe({ transform: true }))
    @ApiOperation({ summary: "Request a rollback in an active game" })
    @ApiResponse({ status: 200, description: "Game state", type: ActionManagerReturn })
    @ApiResponse({ status: 404, description: "Not found" })
    @ApiResponse({ status: 400, description: "Invalid action" })
    cancelAction(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerId: string): ActionManagerReturn {
        return this.service.cancelAction(gameId, playerId);
    }

    @Post(":id/:player/consent")
    @UsePipes(new ValidationPipe({ transform: true }))
    @ApiOperation({ summary: "Consent to a rollback in an active game", description: "A rollback must have been requested (rollbackConsent is defined)" })
    @ApiResponse({ status: 200, description: "Game state", type: ActionManagerReturn })
    @ApiResponse({ status: 404, description: "Not found" })
    @ApiResponse({ status: 400, description: "Invalid action" })
    consentToRollback(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerId: string): ActionManagerReturn {
        return this.service.consentToRollback(gameId, playerId);
    }

    @Delete(":id")
    @ApiOperation({ summary: "End an active game" })
    @ApiResponse({ status: 200, description: "Game state", type: ActionManagerReturn })
    @ApiResponse({ status: 404, description: "Not found" })
    endGame(@Param('id', ParseIntPipe) gameId: number): ActionManagerReturn {
        return this.service.endGame(gameId);
    }
}
