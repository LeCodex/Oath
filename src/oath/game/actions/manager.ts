import { OathAction, OathEffect, ResolveCallbackEffect } from "./base";
import { EventPublisher, InvalidActionResolution } from "./utils";
import { OathPhase, OathSuit, RegionKey } from "../enums";
import { type OathGame } from "../model/game";
import { SerializedNode } from "../model/utils";
import { ActPhaseAction, ChoosePlayersAction, ChooseSitesAction, SetupChooseAdviserAction, SetupChoosePlayerBoardAction, WakeAction } from ".";
import { ExileBoard, OathPlayer, WarbandsSupply } from "../model/player";
import { DrawFromDeckEffect, PutPawnAtSiteEffect, SetNewOathkeeperEffect, SetUsurperEffect, WinGameEffect } from "./effects";
import { Site, Denizen } from "../model/cards";
import { Warband, Favor, Secret } from "../model/resources";
import { clone } from "lodash";
import { ApiProperty } from "@nestjs/swagger";
import { BadRequestException } from "@nestjs/common";


export class HistoryNode<T extends OathActionManager> {
    constructor(
        public manager: T,
        public game: SerializedNode<T["game"]>,
        public events: HistoryEvent[] = []
    ) { }
    
    stringify() {
        return this.events.map((e) => JSON.stringify(e.serialize())).join("\n");
    }

    static loadChunk(manager: OathActionManager, data: string, save: boolean = true) {
        if (data === "") return;
        const lines = data.split("\n");
        for (const [i, line] of lines.entries()) {
            console.log(`   Resolving event ${i}: ${line}`);
            this.loadEvent(manager, line, save);
        }
    }

    static loadEvent(manager: OathActionManager, line: string, save: boolean = true) {
        const { name, player, data } = JSON.parse(line) as ReturnType<HistoryEvent["serialize"]>;
        eventsIndex[name].replay(manager, player, data, save);
    }
}

export abstract class HistoryEvent {
    oneWay: boolean = false;
    
    constructor(
        public manager: OathActionManager,
        public player: string,
        public data: any,
    ) { }

    static replay(manager: OathActionManager, player: string, data: any, save?: boolean) {
        throw new TypeError("Not implemented");
    }
    
    serialize() {
        return {
            name: this.constructor.name as keyof typeof eventsIndex,
            player: this.player,
            data: this.data
        };
    }
}
export class ContinueEvent extends HistoryEvent {
    constructor(
        manager: OathActionManager,
        player: string,
        values: Record<string, string[]>
    ) { super(manager, player, values); }

    static replay(manager: OathActionManager, player: string, data: Record<string, string[]>, save: boolean = true) {
        manager.continueAction(player, data, save);
    }
}
export class EditEvent extends HistoryEvent {
    constructor(
        manager: OathActionManager,
        player: string,
        gameState: SerializedNode<OathGame>
    ) { super(manager, player, gameState); }

    static replay(manager: OathActionManager, player: string, data: SerializedNode<OathGame>, save: boolean = true) {
        manager.editGameState(data, save);
    }
}
export const eventsIndex = {
    ContinueEvent,
    EditEvent
}

export class ActionManagerReturn {
    @ApiProperty({ example: { seed: "12345", children: [] }, description: "Serialized game data" })
    game: Record<string, any>

    @ApiProperty({ example: [{}], description: "Effects applied since the last action" })
    appliedEffects: Record<string, any>[]

    @ApiProperty({ example: {}, description: "Currently active action, if applicable" })
    activeAction?: Record<string, any>

    @ApiProperty({ example: { Purple: true, Red: false }, description: "Rollback consent needed, if applicable" })
    rollbackConsent?: Record<string, boolean>

    @ApiProperty({ example: true, description: "Is the game raedy to receive actions?" })
    loaded?: boolean
}

export class OathActionManager extends EventPublisher<{
    emptyStack: [],
    addFutureAction: [OathAction],
    save: []
}> {
    loaded: boolean = true;
    lastStartState: SerializedNode<this["game"]>;

    actionsStack: OathAction[] = [];
    futureActionsList: OathAction[] = [];
    currentEffectsStack: OathEffect<any>[] = [];
    history: HistoryNode<this>[] = [];
    rollbackConsent?: Record<string, boolean> = undefined;
    /** Set this to true to prevent rolling back this action/effect without the other players' consent. */
    markEventAsOneWay: boolean = false;

    constructor(public game: OathGame) {
        super();
    }

    get gameState() {
        const cloneDeepNext = (e: OathAction) => {
            const clonedAction = clone(e);
            if ("next" in clonedAction && clonedAction.next instanceof OathAction) clonedAction.next = cloneDeepNext(clonedAction.next);
            return clonedAction;
        }

        return {
            game: this.game.serialize(true) as SerializedNode<this["game"]>,
            stack: this.actionsStack.map((e) => cloneDeepNext(e))
        };
    }
    get activePlayer() { return this.actionsStack[this.actionsStack.length - 1]?.player ?? this.game.currentPlayer; }

    private getPlayerFromId(playerId: string) {
        const player = this.game.players.by("id", playerId)[0];
        if (!player) throw new InvalidActionResolution(`Invalid player id ${playerId}`);
        return player;
    }

    private resolveTopAction(save: boolean = false) {
        const action = this.actionsStack.pop();
        if (!action) {
            this.currentEffectsStack.pop();
            return this.checkForNextAction(save);
        }

        action.execute();
        return this.checkForNextAction(save);
    }

    private authorizeCancel(save: boolean = true) {
        // console.log("Cancelling");
        const history = [...this.history];
        const gameState = this.gameState;
        try {
            while (this.history[this.history.length - 1]?.events.length === 0) this.history.pop();
            const node = this.history.pop()!;  // Replays will put everything back into the history

            node.events.pop();
            this.actionsStack.length = 0;
            this.futureActionsList.length = 0;
            this.currentEffectsStack.length = 0;
            this.rollbackConsent = undefined;
            this.markEventAsOneWay = false;

            this.game.parse(node.game, true);
            if (this.history.length === 0) {
                // console.log("Replaying from start");
                this.addInitialActions();
            } else {
                this.emptyStack();
            }
            this.checkForNextAction(save);  // Flush the initial actions onto the stack
            for (const [i, event] of node.events.entries()) {
                // console.log(`Replaying event ${i}`);
                (event.constructor as typeof HistoryEvent).replay(event.manager, event.player, event.data, save);
            }

            this.checkForNextAction(save);
            return this.defer(save);
        } catch (e) {
            console.warn('Rollback from cancel because of', e);
            this.history = history;
            this.revertCurrentAction(gameState);
            throw e;
        }
    }

    private revertCurrentAction({ game, stack }: this["gameState"]): void {
        // Last ditch effort to revert. Has shown to be unreliable
        this.game.parse(game, true);
        this.actionsStack = stack;
        this.currentEffectsStack.length = 0;
    }

    public addFutureAction(action: OathAction) {
        this.futureActionsList.unshift(action);
        this.emit("addFutureAction", action);
    }
 
    public checkForNextAction(save: boolean = true): ActionManagerReturn {
        if (!this.loaded) return this.defer(false);
        if (!this.actionsStack.length && !this.futureActionsList.length) this.emptyStack();

        for (const action of this.futureActionsList) this.actionsStack.push(action);
        this.futureActionsList.length = 0;
        const action = this.actionsStack[this.actionsStack.length - 1];

        const continueNow = action?.start();
        if (continueNow) return this.resolveTopAction(save);
        return this.defer(save);
    }

    public addInitialActions() {
        for (const player of this.game.players) {
            new SetupChoosePlayerBoardAction(this, player).doNext();
        }

        new ResolveCallbackEffect(this, () => {
            if (!this.game.chancellor) throw new InvalidActionResolution("The Chancellor is in every game and demands your respect!");
            
            this.game.order = [];
            for (const player of this.game.players) {
                player.addChild(new WarbandsSupply(player.board.id));
                for (let i = 0; i < player.board.bagAmount; i++) player.bag.addChild(new Warband().colorize(player.board.key));
                if (player !== this.game.chancellor) this.game.order.push(player.key);
            }
            this.game.random.shuffleArray(this.game.order);
            this.game.order.unshift(this.game.chancellor.key);
            
            for (const player of this.game.players) {
                player.putResources(Favor, player === this.game.chancellor ? 2 : 1);
                player.putResources(Secret, 1);
                player.leader.bag.moveChildrenTo(player, 3);
                new DrawFromDeckEffect(this, player, this.game.worldDeck, 3, true).doNext((cards) => {
                    if (player !== this.game.chancellor)
                        new ChooseSitesAction(
                            this, player, "Put your pawn at a faceup site (Hand: " + cards.map((e) => e.name).join(", ") + ")",  // TODO: Find a better solution for this
                            (sites: Site[]) => { if (sites[0]) new PutPawnAtSiteEffect(this, player, sites[0]).doNext(); }
                        ).doNext();
                    else
                        new PutPawnAtSiteEffect(this, player, topCradleSite).doNext();
                
                    new SetupChooseAdviserAction(this, player, cards).doNext();
                });
            }

            const topCradleSite = this.game.map.children.byKey(RegionKey.Cradle)[0]!.byClass(Site)[0]!;
            this.game.chancellor.bag.moveChildrenTo(topCradleSite, 3);
            for (const site of this.game.map.sites())
                if (site !== topCradleSite && site.byClass(Denizen).filter((e) => e.suit !== OathSuit.None).length)
                    this.game.chancellor.bag.moveChildrenTo(site, 1);

            this.game.chancellor.addChild(this.game.grandScepter).turnFaceup();
            this.game.chancellor.addChild(this.game.oathkeeperTile).oath.setup();
            this.game.chancellor.addChild(this.game.reliquary);

            new WakeAction(this, this.game.currentPlayer).doNext();
        }).doNext();  

        this.history.push(new HistoryNode(this, this.game.serialize(true) as SerializedNode<typeof this["game"]>));
    }

    private emptyStack() {
        this.lastStartState = this.gameState.game;

        this.emit("emptyStack");
        if (this.game.phase !== OathPhase.Over) {
            this.history.push(new HistoryNode(this, this.gameState.game, []));
            if (!this.checkForOathkeeper()) new ActPhaseAction(this, this.game.currentPlayer).doNext();
        }
    }

    public checkForOathkeeper() {
        const candidates = this.game.oathkeeperTile.oath.getOathkeeperCandidates();
        if (!this.game.oathkeeper) return false;
        if (candidates.has(this.game.oathkeeper)) return false;
        if (candidates.size) {
            new ChoosePlayersAction(
                this, this.game.oathkeeper, "Choose the new Oathkeeper",
                (targets: OathPlayer[]) => {
                    if (!targets[0]) return;
                    new SetUsurperEffect(this, false).doNext();
                    new SetNewOathkeeperEffect(this, targets[0]).doNext();
                },
                [candidates]
            ).doNext();
            return true;
        }
        return false;
    }

    public empireWins() {
        const candidates = this.game.oathkeeperTile.oath.getSuccessorCandidates();
        if (candidates.has(this.game.chancellor)) return new WinGameEffect(this, this.game.chancellor).doNext();

        new ChoosePlayersAction(
            this, this.game.chancellor, "Choose a Successor",
            (targets: OathPlayer[]) => { if (targets[0]) new WinGameEffect(this, targets[0]).doNext(); },
            [[...candidates].filter((e) => e.board instanceof ExileBoard && e.board.isCitizen)]
        ).doNext();
    }

    public defer(save: boolean = true): ActionManagerReturn {
        if (save) this.emit("save");

        const action = this.actionsStack[this.actionsStack.length - 1];
        return {
            game: this.game.serialize(),
            appliedEffects: this.currentEffectsStack.map((e) => e.serialize()).filter((e) => e !== undefined),
            activeAction: action?.serialize(),
            rollbackConsent: this.rollbackConsent,
            loaded: this.loaded
        };
    }

    public continueAction(playerId: string, values: Record<string, string[]>, save: boolean = true) {
        if (!this.loaded) return this.defer(false);

        const action = this.actionsStack[this.actionsStack.length - 1];
        if (!action) throw new InvalidActionResolution("No action to continue");

        const player = this.getPlayerFromId(playerId);
        if (action.player !== player) throw new InvalidActionResolution(`Action must be resolved by ${action.player?.name}, not ${player.name}`);

        this.markEventAsOneWay = false;
        this.currentEffectsStack.length = 0;
        this.rollbackConsent = undefined;
        // TODO: Merge both of those
        const parsed = action.parse(values);
        action.applyParameters(parsed);

        const event = new ContinueEvent(this, playerId, values);
        const events = this.history[this.history.length - 1]?.events;
        events?.push(event);
        try {
            this.resolveTopAction(save);
            event.oneWay = this.markEventAsOneWay;
            return this.defer(save);
        } catch (e) {
            console.warn('Rollback from continue because of', e);
            this.authorizeCancel(save);
            throw e;
        }
    }

    public editGameState(gameState: SerializedNode<OathGame>, save: boolean = true) {
        if (!this.loaded) return this.defer(false);

        try {
            this.game.parse(gameState, true);
        } catch (e) {
            throw new BadRequestException(e);
        }

        const event = new EditEvent(this, this.game.currentPlayer.id, gameState);
        const events = this.history[this.history.length - 1]?.events;
        events?.push(event);
        return this.defer(save);
    }

    public cancelAction(playerId: string) {
        if (!this.loaded) return this.defer(false);

        const player = this.getPlayerFromId(playerId);
        if (this.activePlayer !== player) throw new InvalidActionResolution(`Rollback can only be done by ${this.activePlayer.name}, not ${player.name}`);

        let last = this.history.length - 1, lastNode = this.history[last];
        while (lastNode?.events.length === 0) {
            last--;
            lastNode = this.history[this.history.length - 2];
        }
        if (!lastNode || lastNode.events.length === 0) throw new InvalidActionResolution("Cannot roll back");
        const lastEvent = lastNode.events[lastNode.events.length - 1]!;
        if (lastEvent.player !== this.activePlayer.id || lastEvent.oneWay) {
            this.rollbackConsent = Object.fromEntries(this.game.players.map((e) => [e.id, e.id === playerId]));
            return this.defer();
        }

        return this.authorizeCancel();
    }
    
    public consentToRollback(playerId: string) {
        if (!this.loaded) return this.defer(false);

        const player = this.getPlayerFromId(playerId);
        if (!this.rollbackConsent || !(playerId in this.rollbackConsent)) throw new InvalidActionResolution(`No rollback consent needed from ${player.name}`);

        this.rollbackConsent[playerId] = true;
        for (const consent of Object.values(this.rollbackConsent)) if (!consent) return this.defer();
        return this.authorizeCancel();
    }

    public forceCancelAction() {
        if (!this.loaded) return this.defer(false);

        return this.authorizeCancel();
    }

    public stringify(archive: boolean) {
        return this.history.map((e) => e.stringify()).join("\n\n") + (archive ? "" : "\n\n" + JSON.stringify(this.lastStartState));
    }

    public parse(chunks: string[]) {
        this.checkForNextAction(false);  // Flush the initial actions onto the stack
        const lastStartState = JSON.parse(chunks.pop()!);
        let lastChunk = false;
        try {
            for (const [i, nodeData] of chunks.entries()) {
                console.log(`Resolving chunk ${i}`);
                if (i === chunks.length - 1) {
                    if (JSON.stringify(this.lastStartState) !== JSON.stringify(lastStartState))
                        console.warn(`Loading of game ${this.game.gameId} has conflicting final start state`);
                    lastChunk = true;
                }
                HistoryNode.loadChunk(this, nodeData, false);
            }
        } catch (e) {
            this.loaded = false;
            console.error(`Loading of game ${this.game.gameId} failed:`, e);
            this.lastStartState = lastStartState;
            if (lastChunk) {
                console.warn("Reloading was past last start state. Reloading from history");
                this.reloadFromHistory();
            }
        }
    }

    public reloadFromHistory() {
        if (this.loaded) throw new InvalidActionResolution("Game loading does not need resolution");
        this.loaded = true;
        return this.defer();
    }

    public reloadFromFinalStartState() {
        if (this.loaded) throw new InvalidActionResolution("Game loading does not need resolution");
        try {
            this.game.parse(this.lastStartState);
            this.history.length = 0;
            this.loaded = true;
            this.emptyStack();
            return this.defer();
        } catch (e) {
            console.warn("Reloading from final start state failed. Reloading from history instead");
            return this.reloadFromHistory();
        }
    }
}
