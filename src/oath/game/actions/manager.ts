import { UsePowerAction, PlayFacedownAdviserAction, MoveWarbandsAction, RestAction, MusterAction, TradeAction, TravelAction, RecoverAction, SearchAction, CampaignAction } from ".";
import { OathAction, OathEffect, InvalidActionResolution } from "./base";
import { OathPhase } from "../enums";
import { OathGame } from "../game";
import { Constructor, SerializedNode } from "../utils";
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
export class StartEvent extends HistoryEvent {
    constructor(
        manager: OathActionManager,
        player: string,
        public actionName: string
    ) { super(manager, player); }

    replay(save: boolean = true) {
        this.manager.startAction(this.player, this.actionName, save);
    }

    serialize() {
        return {
            ...super.serialize(),
            data: this.actionName
        };
    }
}
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
    StartEvent,
    ContinueEvent
}

export class ActionManagerReturn {
    @ApiProperty({ example: { seed: "122345", children: [] }, description: "Serialized game data" })
    game: Record<string, any>

    @ApiProperty({ example: [{}], description: "Effects applied since the last action" })
    appliedEffects: Record<string, any>[]

    @ApiProperty({ example: false, description: "Is the game over?" })
    over: boolean

    @ApiProperty({ example: {}, description: "Currently active action, if applicable" })
    activeAction?: Record<string, any>

    @ApiProperty({ example: ["Muster", "Trade", "Travel"], description: "Start options, if the stack is empty" })
    startOptions?: string[]

    @ApiProperty({ example: { Purple: true, Red: false }, description: "Rollback consent needed, if applicable" })
    rollbackConsent?: Record<string, boolean>

    @ApiProperty({ example: true, description: "Is the game raedy to receive actions?" })
    loaded?: boolean
};

export class OathActionManager {
    loaded: boolean = true;
    lastState: SerializedNode<this["game"]>;

    actionsStack: OathAction[] = [];
    futureActionsList: OathAction[] = [];
    currentEffectsStack: OathEffect<any>[] = [];
    history: HistoryNode<this>[] = [];
    rollbackConsent?: Record<string, boolean> = undefined;
    /** Set this to true to prevent rolling back this action/effect without the other players' consent. */
    markEventAsOneWay: boolean = false;

    startOptions: Record<string, Constructor<OathAction>> = {
        "Muster": MusterAction,
        "Trade": TradeAction,
        "Travel": TravelAction,
        "Recover": RecoverAction,
        "Search": SearchAction,
        "Campaign": CampaignAction,

        "Use": UsePowerAction,
        "Reveal": PlayFacedownAdviserAction,
        "Move warbands": MoveWarbandsAction,
        "Rest": RestAction
    };

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

    private resolveTopAction() {
        const action = this.game.actionManager.actionsStack.pop();
        if (!action) {
            this.game.actionManager.currentEffectsStack.pop();
            return this.checkForNextAction();
        }

        action.execute();
        return this.checkForNextAction();
    }

    private authorizeCancel() {
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
                this.game.initialActions();
                this.checkForNextAction();  // Flush the initial actions onto the stack
            }
            for (const [i, event] of node.events.entries()) {
                // console.log(`Replaying event ${i}`);
                event.replay();
            }
            
            this.checkForNextAction();
            return this.defer();
        } catch (e) {
            this.history = history;
            this.revertCurrentAction(gameState);
            throw e;
        }

    }

    private revertCurrentAction({ game, stack }: this["gameState"]): void {
        this.game.parse(game, true);
        this.actionsStack = stack;
        this.currentEffectsStack.length = 0;
    }
 
    public checkForNextAction() {
        if (!this.loaded) return;
        if (!this.actionsStack.length && !this.futureActionsList.length) this.game.stackEmpty();

        for (const action of this.futureActionsList) this.actionsStack.push(action);
        this.futureActionsList.length = 0;
        let action = this.actionsStack[this.actionsStack.length - 1];

        let continueNow = action?.start();
        if (continueNow) this.resolveTopAction();
    }

    public defer(save: boolean = true): ActionManagerReturn {
        if (save) {
            this.lastState = this.gameState.game;
            if (this.game.phase !== OathPhase.Over) this.game.save();
        }

        let action = this.actionsStack[this.actionsStack.length - 1];
        return {
            game: this.game.serialize(),
            appliedEffects: this.currentEffectsStack.map(e => e.serialize()).filter(e => e !== undefined),
            over: this.game.phase === OathPhase.Over,
            activeAction: action?.serialize(),
            startOptions: !action ? Object.keys(this.startOptions) : undefined,
            rollbackConsent: this.rollbackConsent,
            loaded: this.loaded
        };
    }

    public startAction(playerId: string, actionName: string, save: boolean = true) {
        if (!this.loaded) return this.defer(false);

        if (this.game.currentPlayer.id !== playerId) throw new InvalidActionResolution(`Cannot begin an action outside your turn`);
        if (this.game.phase !== OathPhase.Act) throw new InvalidActionResolution(`Cannot begin an action outside the Act phase`);
        if (this.actionsStack.length) throw new InvalidActionResolution("Cannot start an action while other actions are active");

        const action = this.startOptions[actionName];
        if (!action) throw new InvalidActionResolution("Invalid starting action name");

        this.markEventAsOneWay = false;
        this.currentEffectsStack.length = 0;
        this.rollbackConsent = undefined;
        new action(this.game.currentPlayer).doNext();

        const gameState = this.gameState;
        const event = new StartEvent(this, playerId, actionName);
        this.history.push(new HistoryNode(this, gameState.game, [event]));
        try {
            this.checkForNextAction();
            event.oneWay = this.markEventAsOneWay;
            return this.defer(save);
        } catch (e) {
            this.authorizeCancel();
            throw e;
        }
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
            this.resolveTopAction();
            event.oneWay = this.markEventAsOneWay;
            return this.defer(save);
        } catch (e) {
            this.authorizeCancel();
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
        let lastEvent = lastNode.events[lastNode.events.length - 1]!;
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
        return this.history.map(e => e.stringify()).join("\n\n") + "\n\n" + JSON.stringify(this.lastState);
    }

    public parse(chunks: string[]) {
        this.checkForNextAction();  // Flush the initial actions onto the stack
        this.lastState = JSON.parse(chunks.pop()!);
        try {
            for (const [i, nodeData] of chunks.entries()) {
                console.log(`Resolving chunk ${i}`);
                const node = new HistoryNode(this, this.game.serialize(true) as SerializedNode<this["game"]>);
                node.parse(nodeData, false);
            }

            if (JSON.stringify(this.gameState.game) !== JSON.stringify(this.lastState))
                console.warn(`Loading of game ${this.game.gameId} has conflicting final state`);
        } catch (e) {
            this.loaded = false;
            console.error(`Loading of game ${this.game.gameId} failed:`, e);
        }
    }

    public reloadFromHistory() {
        if (this.loaded) throw new InvalidActionResolution("Game loading does not need resolution");
        this.loaded = true;
        return this.defer();
    }

    public reloadFromFinalState() {
        if (this.loaded) throw new InvalidActionResolution("Game loading does not need resolution");
        try {
            this.game.parse(this.lastState);
            this.history.length = 0;
            this.loaded = true;
            return this.defer();
        } catch (e) {
            console.warn("Reloading from final state failed. Reloading from history instead");
            return this.reloadFromHistory();
        }
    }
}
