import { OathAction, OathEffect, ResolveCallbackEffect } from "./base";
import { InvalidActionResolution } from "./utils";
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


export class HistoryNode<T extends OathActionManager> {
    constructor(
        public manager: T,
        public game: SerializedNode<T["game"]>,
        public events: HistoryEvent[] = []
    ) { }
    
    stringify() {
        return this.events.map(e => JSON.stringify(e.serialize())).join("\n");
    }

    parse(data: string, save: boolean = true) {
        if (data === "") return;
        const lines = data.split("\n");
        for (const [i, line] of lines.entries()) {
            console.log(`   Resolving event ${i}: ${line}`);
            const { name, player, data } = JSON.parse(line) as ReturnType<HistoryEvent["serialize"]>;
            // This is a "dummy" event that just replays the actions. The replay takes care of adding the actual events back
            const event = new eventsIndex[name](this.manager, player, data);
            event.replay(save);
        }
    }
}

export abstract class HistoryEvent {
    oneWay: boolean = false;
    
    constructor(
        public manager: OathActionManager,
        public player: string,
    ) { }

    abstract replay(save?: boolean): void;
    
    serialize() {
        return {
            name: this.constructor.name as keyof typeof eventsIndex,
            player: this.player,
            data: undefined as any
        };
    }
};
export class ContinueEvent extends HistoryEvent {
    constructor(
        manager: OathActionManager,
        player: string,
        public values: Record<string, string[]>
    ) { super(manager, player); }

    replay(save: boolean = true) {
        this.manager.continueAction(this.player, this.values, save);
    }

    serialize() {
        return {
            ...super.serialize(),
            data: this.values
        };
    }
}
const eventsIndex = {
    ContinueEvent
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
};

export class OathActionManager {
    loaded: boolean = true;
    lastStartState: SerializedNode<this["game"]>;

    actionsStack: OathAction[] = [];
    futureActionsList: OathAction[] = [];
    currentEffectsStack: OathEffect<any>[] = [];
    history: HistoryNode<this>[] = [];
    rollbackConsent?: Record<string, boolean> = undefined;
    /** Set this to true to prevent rolling back this action/effect without the other players' consent. */
    markEventAsOneWay: boolean = false;

    constructor(public game: OathGame) {}

    get gameState() {
        const cloneDeepNext = (e: OathAction) => {
            const clonedAction = clone(e);
            if ("next" in clonedAction && clonedAction.next instanceof OathAction) clonedAction.next = cloneDeepNext(clonedAction.next);
            return clonedAction;
        }

        return {
            game: this.game.serialize(true) as SerializedNode<this["game"]>,
            stack: this.actionsStack.map(e => cloneDeepNext(e))
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
                this.initialActions();
            } else {
                this.emptyStack();
            }
            this.checkForNextAction(save);  // Flush the initial actions onto the stack
            for (const [i, event] of node.events.entries()) {
                // console.log(`Replaying event ${i}`);
                event.replay(save);
            }
            
            this.checkForNextAction(save);
            return this.defer(save);
        } catch (e) {
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
 
    public checkForNextAction(save: boolean = true) {
        if (!this.loaded) return;
        if (!this.actionsStack.length && !this.futureActionsList.length) this.emptyStack(save);

        for (const action of this.futureActionsList) this.actionsStack.push(action);
        this.futureActionsList.length = 0;
        const action = this.actionsStack[this.actionsStack.length - 1];

        const continueNow = action?.start();
        if (continueNow) this.resolveTopAction(save);
    }

    public initialActions() {
        for (const player of this.game.players) {
            new SetupChoosePlayerBoardAction(player).doNext();
        }

        new ResolveCallbackEffect(this.game, () => {
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
                new DrawFromDeckEffect(player, this.game.worldDeck, 3, true).doNext(cards => {
                    if (player !== this.game.chancellor)
                        new ChooseSitesAction(
                            player, "Put your pawn at a faceup site (Hand: " + cards.map(e => e.name).join(", ") + ")",  // TODO: Find a better solution for this
                            (sites: Site[]) => { if (sites[0]) new PutPawnAtSiteEffect(player, sites[0]).doNext(); }
                        ).doNext();
                    else
                        new PutPawnAtSiteEffect(player, topCradleSite).doNext();
                
                    new SetupChooseAdviserAction(player, cards).doNext();
                });
            }

            const topCradleSite = this.game.map.children.byKey(RegionKey.Cradle)[0]!.byClass(Site)[0]!;
            this.game.chancellor.bag.moveChildrenTo(topCradleSite, 3);
            for (const site of this.game.map.sites())
                if (site !== topCradleSite && site.byClass(Denizen).filter(e => e.suit !== OathSuit.None).length)
                    this.game.chancellor.bag.moveChildrenTo(site, 1);

            this.game.chancellor.addChild(this.game.grandScepter).turnFaceup();
            this.game.chancellor.addChild(this.game.oathkeeperLabel).oath.setup();
            this.game.chancellor.addChild(this.game.reliquary);

            new WakeAction(this.game.currentPlayer).doNext();
        }).doNext();  

        this.history.push(new HistoryNode(this, this.game.serialize(true) as SerializedNode<typeof this["game"]>));
    }

    private emptyStack(save: boolean = true) {
        if (save) this.lastStartState = this.gameState.game;

        if (this.game.phase === OathPhase.Over) {
            this.game.archiveSave();
        } else {
            this.history.push(new HistoryNode(this, this.gameState.game, []));
            if (!this.checkForOathkeeper()) new ActPhaseAction(this.game.currentPlayer).doNext();
        }
    }

    checkForOathkeeper() {
        const candidates = this.game.oathkeeperLabel.oath.getOathkeeperCandidates();
        if (candidates.has(this.game.oathkeeper)) return false;
        if (candidates.size) {
            new ChoosePlayersAction(
                this.game.oathkeeper, "Choose the new Oathkeeper",
                (targets: OathPlayer[]) => {
                    if (!targets[0]) return;
                    new SetUsurperEffect(this.game, false).doNext();
                    new SetNewOathkeeperEffect(targets[0]).doNext();
                },
                [candidates]
            ).doNext();
            return true;
        }
        return false;
    }

    empireWins() {
        const candidates = this.game.oathkeeperLabel.oath.getSuccessorCandidates();
        if (candidates.has(this.game.chancellor)) return new WinGameEffect(this.game.chancellor).doNext();

        new ChoosePlayersAction(
            this.game.chancellor, "Choose a Successor",
            (targets: OathPlayer[]) => { if (targets[0]) new WinGameEffect(targets[0]).doNext(); },
            [[...candidates].filter(e => e.board instanceof ExileBoard && e.board.isCitizen)]
        ).doNext();
    }

    public defer(save: boolean = true): ActionManagerReturn {
        if (save && this.game.phase !== OathPhase.Over) this.game.save();

        const action = this.actionsStack[this.actionsStack.length - 1];
        return {
            game: this.game.serialize(),
            appliedEffects: this.currentEffectsStack.map(e => e.serialize()).filter(e => e !== undefined),
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
        if (action.player !== player) throw new InvalidActionResolution(`Action must be resolved by ${action.player.name}, not ${player.name}`);

        this.markEventAsOneWay = false;
        this.currentEffectsStack.length = 0;
        this.rollbackConsent = undefined;
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
            this.authorizeCancel(save);
            throw e;
        }
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
            this.rollbackConsent = Object.fromEntries(this.game.players.map(e => [e.id, e.id === playerId]));
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

    public stringify() {
        return this.history.map(e => e.stringify()).join("\n\n") + "\n\n" + JSON.stringify(this.lastStartState);
    }

    public parse(chunks: string[]) {
        this.checkForNextAction(false);  // Flush the initial actions onto the stack
        this.lastStartState = JSON.parse(chunks.pop()!);
        let lastChunk = false;
        try {
            for (const [i, nodeData] of chunks.entries()) {
                console.log(`Resolving chunk ${i}`);
                if (i === chunks.length - 1) lastChunk = true;
                const node = new HistoryNode(this, this.game.serialize(true) as SerializedNode<this["game"]>);
                node.parse(nodeData, false);
            }

            if (JSON.stringify(this.gameState.game) !== JSON.stringify(this.lastStartState))
                console.warn(`Loading of game ${this.game.gameId} has conflicting final start state`);
        } catch (e) {
            this.loaded = false;
            console.error(`Loading of game ${this.game.gameId} failed:`, e);
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
