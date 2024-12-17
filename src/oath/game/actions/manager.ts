import { UsePowerAction, PlayFacedownAdviserAction, MoveWarbandsAction, RestAction, MusterAction, TradeAction, TravelAction, RecoverAction, SearchAction, CampaignAction } from "./actions";
import { OathAction, OathEffect, InvalidActionResolution } from "./base";
import { OathPhase } from "../enums";
import { OathGame } from "../game";
import { Constructor, SerializedNode } from "../utils";


export class HistoryNode<T extends OathActionManager> {
    constructor(
        public manager: T,
        public game: SerializedNode<T["game"]>,
        public events: HistoryEvent[] = []
    ) { }
    
    stringify() {
        return this.events.map(e => JSON.stringify(e.serialize())).join("\n");
    }

    parse(data: string) {
        if (data === "") return;
        const lines = data.split("\n");
        for (const [i, line] of lines.entries()) {
            // console.log(`   Resolving event ${i}: ${line}`);
            const { name, player, data } = JSON.parse(line) as ReturnType<HistoryEvent["serialize"]>;
            // This is a "dummy" event that just replays the actions. The replay takes care of adding the actual events back
            const event = new eventsIndex[name](this.manager, player, data);
            event.replay();
        }
    }
}

export abstract class HistoryEvent {
    oneWay: boolean = false;
    
    constructor(
        public manager: OathActionManager,
        public player: string,
    ) { }

    abstract replay(): void;
    
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

    replay() {
        this.manager.startAction(this.actionName);
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

    replay() {
        this.manager.continueAction(this.player, this.values);
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


export type ActionManagerReturn = {
    activeAction?: Record<string, any>,
    startOptions?: string[],
    appliedEffects: Record<string, any>[],
    rollbackConsent?: Record<string, boolean>,
    game: Record<string, any>,
    over: boolean
};

export class OathActionManager {
    game: OathGame;
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

    constructor(game: OathGame) {
        this.game = game;
    }

    get gameState() {
        return {
            game: this.game.serialize(true) as SerializedNode<this["game"]>,
            stack: [...this.actionsStack]
        };
    }
    get activePlayer() { return this.actionsStack[this.actionsStack.length - 1]?.player ?? this.game.currentPlayer; }
 
    checkForNextAction() {
        if (!this.actionsStack.length && !this.futureActionsList.length) this.game.stackEmpty();

        for (const action of this.futureActionsList) this.actionsStack.push(action);
        this.futureActionsList.length = 0;
        let action = this.actionsStack[this.actionsStack.length - 1];

        let continueNow = action?.start();
        if (continueNow) this.resolveTopAction();
    }

    defer(): ActionManagerReturn {
        if (this.game.phase !== OathPhase.Over) this.game.save();

        let action = this.actionsStack[this.actionsStack.length - 1];
        return {
            activeAction: action?.serialize(),
            startOptions: !action ? Object.keys(this.startOptions) : undefined,
            appliedEffects: this.currentEffectsStack.map(e => e.serialize()).filter(e => e !== undefined),
            rollbackConsent: this.rollbackConsent,
            game: this.game.serialize(),
            over: this.game.phase === OathPhase.Over
        };
    }

    startAction(actionName: string) {
        const action = this.startOptions[actionName];
        if (!action) throw new InvalidActionResolution("Invalid starting action name");

        this.markEventAsOneWay = false;
        this.currentEffectsStack.length = 0;
        this.rollbackConsent = undefined;
        new action(this.game.currentPlayer).doNext();

        const playerId = this.game.currentPlayer.id;
        const gameState = this.gameState;
        const event = new StartEvent(this, playerId, actionName);
        this.history.push(new HistoryNode(this, gameState.game, [event]));
        try {
            this.checkForNextAction();
            event.oneWay = this.markEventAsOneWay;
            return this.defer();
        } catch (e) {
            this.history.pop();
            this.revertCurrentAction(gameState);
            throw e;
        }
    }

    getPlayerFromId(playerId: string) {
        const player = this.game.players.by("id", playerId)[0];
        if (!player) throw new InvalidActionResolution(`Invalid player id ${playerId}`);
        return player;
    }

    continueAction(playerId: string, values: Record<string, string[]>) {
        const action = this.actionsStack[this.actionsStack.length - 1];
        if (!action) throw new InvalidActionResolution("No action to continue");

        const player = this.getPlayerFromId(playerId);
        if (action.player !== player) throw new InvalidActionResolution(`Action must be resolved by ${action.player.name}, not ${player.name}`);

        this.markEventAsOneWay = false;
        this.currentEffectsStack.length = 0;
        this.rollbackConsent = undefined;
        const parsed = action.parse(values);
        action.applyParameters(parsed);
        
        const gameState = this.gameState;
        const event = new ContinueEvent(this, playerId, values);
        const events = this.history[this.history.length - 1]?.events;
        events?.push(event);
        try {
            this.resolveTopAction();
            event.oneWay = this.markEventAsOneWay;
            return this.defer();
        } catch (e) {
            events?.pop();
            this.revertCurrentAction(gameState);
            throw e;
        }
    }

    resolveTopAction() {
        const action = this.game.actionManager.actionsStack.pop();
        if (!action) {
            this.game.actionManager.currentEffectsStack.pop();
            return this.checkForNextAction();
        }

        action.execute();
        return this.checkForNextAction();
    }

    cancelAction(playerId: string) {
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
    
    consentToRollback(playerId: string) {
        const player = this.getPlayerFromId(playerId);
        if (!this.rollbackConsent || !(playerId in this.rollbackConsent)) throw new InvalidActionResolution(`No rollback consent needed from ${player.name}`);

        this.rollbackConsent[playerId] = true;
        for (const consent of Object.values(this.rollbackConsent)) if (!consent) return this.defer();
        return this.authorizeCancel();
    }

    authorizeCancel() {
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
    }

    revertCurrentAction({ game, stack }: this["gameState"]): void {
        this.game.parse(game, true);
        this.actionsStack = stack;
        this.currentEffectsStack.length = 0;
    }
}
