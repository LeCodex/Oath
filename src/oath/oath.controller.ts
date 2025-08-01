import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { OathNestService } from './oath.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ActionManagerReturn } from './game/actions/manager';
import { OathGame } from './game/model/game';
import { SerializedNode } from './game/model/utils';

function ApiActionResponses(invalidAction: boolean = true): MethodDecorator {
    return (target: object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
        ApiResponse({ status: 200, description: "Game state", type: ActionManagerReturn })(target, propertyKey, descriptor);
        ApiResponse({ status: 404, description: "Not found" })(target, propertyKey, descriptor);
        if (invalidAction)
            ApiResponse({ status: 400, description: "Invalid action", example: { error: "InvalidActionResolution", message: "Cannot start an action outside your turn" } })(target, propertyKey, descriptor);
    }
}

@Controller("/oath")
export class OathNestController {
    constructor(private readonly service: OathNestService) {}

    @Get()
    @ApiOperation({ summary: "Get a list of all games" })
    @ApiResponse({ status: 200, description: "List of game IDs", example: [1, 2, 3] })
    getGames(): number[] {
        return this.service.getGames();
    }

    @Post(":seed")
    @ApiOperation({ summary: "Create a game" })
    @ApiResponse({ status: 201, description: "Game state with ID", type: ActionManagerReturn })
    createGame(@Param('seed') seed: string): ActionManagerReturn & { id: number } {
        return this.service.startNewGame(seed);
    }

    @Get(":id")
    @ApiOperation({ summary: "Get an active game" })
    @ApiActionResponses(false)
    getGame(@Param('id', ParseIntPipe) gameId: number): ActionManagerReturn {
        return this.service.getCurrentState(gameId);
    }
    
    @Post(":id/:player/continue")
    @UsePipes(new ValidationPipe({ transform: true }))
    @ApiOperation({ summary: "Continue an active action in an active game", description: "The action stack must not be empty (activeAction is defined)." })
    @ApiActionResponses()
    continueAction(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerId: string, @Body() values: Record<string, string[]>): ActionManagerReturn {
        return this.service.continueAction(gameId, playerId, values);
    }

    @Post(":id/:player/cancel")
    @UsePipes(new ValidationPipe({ transform: true }))
    @ApiOperation({ summary: "Request a rollback in an active game" })
    @ApiActionResponses()
    cancelAction(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerId: string): ActionManagerReturn {
        return this.service.cancelAction(gameId, playerId);
    }

    @Post(":id/:player/consent")
    @UsePipes(new ValidationPipe({ transform: true }))
    @ApiOperation({ summary: "Consent to a rollback in an active game", description: "A rollback must have been requested (rollbackConsent is defined)." })
    @ApiActionResponses()
    consentToRollback(@Param('id', ParseIntPipe) gameId: number, @Param('player') playerId: string): ActionManagerReturn {
        return this.service.consentToRollback(gameId, playerId);
    }

    @Post(":id/edit")
    @UsePipes(new ValidationPipe({ transform: true }))
    @ApiOperation({ summary: "Edit the game to a specific state" })
    @ApiActionResponses(false)
    @ApiResponse({ status: 400, description: "Invalid body" })
    editGameState(@Param('id', ParseIntPipe) gameId: number, @Body() body: SerializedNode<OathGame>): ActionManagerReturn {
        return this.service.editGameState(gameId, body);
    }

    @Post(":id/reload/history")
    @UsePipes(new ValidationPipe({ transform: true }))
    @ApiOperation({ summary: "Finish a failed game reload by using the history", description: "The game's reloading must have failed (loaded is false). This will reload the game until the error happened, keeping the history intact up to that point." })
    @ApiActionResponses()
    reloadFromHistory(@Param('id', ParseIntPipe) gameId: number): ActionManagerReturn {
        return this.service.reloadFromHistory(gameId);
    }

    @Post(":id/reload/state")
    @UsePipes(new ValidationPipe({ transform: true }))
    @ApiOperation({ summary: "Finish a failed game reload by using the final saved state", description: "The game's reloading must have failed (loaded is false). This will keep the game as it was when last saved, but will lose the entire history (preventing rollbacks and replays)." })
    @ApiActionResponses()
    reloadFromFinalState(@Param('id', ParseIntPipe) gameId: number): ActionManagerReturn {
        return this.service.reloadFromFinalState(gameId);
    }

    @Delete(":id")
    @ApiOperation({ summary: "End an active game" })
    @ApiResponse({ status: 200, description: "Final game state", type: ActionManagerReturn })
    @ApiActionResponses(false)
    endGame(@Param('id', ParseIntPipe) gameId: number): ActionManagerReturn {
        return this.service.endGame(gameId);
    }

    @Get("/replays")
    @ApiOperation({ summary: "Get a list of all replays" })
    @ApiResponse({ status: 200, description: "List of replay IDs", example: [1, 2, 3] })
    getReplays(): number[] {
        return this.service.getReplays();
    }

    @Post("/replays/:id")
    @ApiOperation({ summary: "Start a replay from a file" })
    @ApiResponse({ status: 201, description: "Game state with ID", type: ActionManagerReturn })
    loadReplay(@Param('id', ParseIntPipe) id: number): ActionManagerReturn & { id: number } {
        return this.service.loadReplay(id);
    }

    @Post("/replays/:id/forward")
    @ApiOperation({ summary: "Step a replay forward" })
    @ApiActionResponses()
    stepReplayForward(@Param('id', ParseIntPipe) id: number): ActionManagerReturn {
        return this.service.stepReplayForward(id);
    }

    @Post("/replays/:id/backward")
    @ApiOperation({ summary: "Step a replay backward" })
    @ApiActionResponses()
    stepReplayBackward(@Param('id', ParseIntPipe) id: number): ActionManagerReturn {
        return this.service.stepReplayBackward(id);
    }

    @Post("/replays/:id/move/:index")
    @ApiOperation({ summary: "Move a replay to the required index" })
    @ApiActionResponses()
    moveReplayTo(@Param('id', ParseIntPipe) id: number, @Param('index', ParseIntPipe) index: number): ActionManagerReturn {
        return this.service.moveReplayTo(id, index);
    }

    // TODO: End replays automatically after a period of inactivity
    @Delete("/replays/:id")
    @ApiOperation({ summary: "End an active replay" })
    @ApiActionResponses(false)
    endReplay(@Param('id', ParseIntPipe) replayId: number): ActionManagerReturn {
        return this.service.endReplay(replayId);
    }
}
