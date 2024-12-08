import { UsePowerAction, PlayFacedownAdviserAction, MoveWarbandsAction, RestAction, MusterAction, TradeAction, TravelAction, RecoverAction, SearchAction, CampaignAction } from "./actions";
import { OathAction, OathEffect, InvalidActionResolution } from "./base";
import { PlayerColor } from "../enums";
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
        const lines = data.split("\n");
        for (const [i, line] of lines.entries()) {
            // console.log(`   Resolving event ${i}: ${line}`);
            const {name, player, oneWay, data} = JSON.parse(line) as ReturnType<HistoryEvent["serialize"]>;
            const event = new eventsIndex[name](this.manager, player, oneWay, data);
            event.replay();
        }
    }
}

export abstract class HistoryEvent {
    constructor(
        public manager: OathActionManager,
        public player: keyof typeof PlayerColor,
        public oneWay: boolean,
    ) { }

    abstract replay(): void;
    
    serialize() {
        return {
            name: this.constructor.name as keyof typeof eventsIndex,
            player: this.player,
            oneWay: this.oneWay,
            data: undefined as any
        };
    }
};
export class StartEvent extends HistoryEvent {
    constructor(
        manager: OathActionManager,
        player: keyof typeof PlayerColor,
        oneWay: boolean,
        public actionName: string
    ) { super(manager, player, oneWay); }

    replay() {
        this.manager.startAction(this.actionName, false);
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
        player: keyof typeof PlayerColor,
        oneWay: boolean,
        public values: Record<string, string[]>
    ) { super(manager, player, oneWay); }

    replay() {
        this.manager.continueAction(this.player, this.values, false);
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
 
    checkForNextAction(): Record<string, any> {
        if (!this.actionsStack.length && !this.futureActionsList.length) this.game.checkForOathkeeper();

        for (const action of this.futureActionsList) this.actionsStack.push(action);
        this.futureActionsList.length = 0;
        let action = this.actionsStack[this.actionsStack.length - 1];

        let continueNow = action?.start();
        if (continueNow) return this.resolveTopAction();

        const returnData = {
            activeAction: action?.serialize(),
            startOptions: !action ? Object.keys(this.startOptions) : undefined,
            appliedEffects: this.currentEffectsStack.map(e => e.serialize()).filter(e => e !== undefined),
            rollbackConsent: this.rollbackConsent,
            game: this.game.serialize()
        };
        return returnData;
    }

    startAction(actionName: string, save: boolean = true): object {
        const action = this.startOptions[actionName];
        if (!action)
            throw new InvalidActionResolution("Invalid starting action name");

        this.markEventAsOneWay = false;
        this.currentEffectsStack.length = 0;
        this.rollbackConsent = undefined;
        new action(this.game.currentPlayer).doNext();
        
        const playerColor = this.game.currentPlayer.id;
        const gameState = this.gameState;
        try {
            const data = this.checkForNextAction();
            this.history.push(new HistoryNode(this, gameState.game, [new StartEvent(this, playerColor, this.markEventAsOneWay, actionName)]));
            if (save) this.game.save();
            return data;
        } catch (e) {
            this.revertCurrentAction(gameState);
            throw e;
        }
    }

    getPlayerFromId(playerColor: keyof typeof PlayerColor) {
        const by = PlayerColor[playerColor];
        const player = this.game.players.byKey(by)[0];
        if (!player) throw new InvalidActionResolution(`Invalid player id ${playerColor}`);
        return player;
    }

    continueAction(playerColor: keyof typeof PlayerColor, values: Record<string, string[]>, save: boolean = true): object {
        const action = this.actionsStack[this.actionsStack.length - 1];
        if (!action) throw new InvalidActionResolution("No action to continue");

        const player = this.getPlayerFromId(playerColor);
        if (action.player !== player) throw new InvalidActionResolution(`Action must be resolved by ${action.player.name}, not ${player.name}`);

        this.markEventAsOneWay = false;
        this.currentEffectsStack.length = 0;
        this.rollbackConsent = undefined;
        const parsed = action.parse(values);
        action.applyParameters(parsed);
        
        const gameState = this.gameState;
        try {
            const data = this.resolveTopAction();
            this.history[this.history.length - 1]?.events.push(new ContinueEvent(this, playerColor, this.markEventAsOneWay, values));
            if (save) this.game.save();
            return data;
        } catch (e) {
            this.revertCurrentAction(gameState);
            throw e;
        }
    }

    resolveTopAction(): object {
        const action = this.game.actionManager.actionsStack.pop();
        if (!action) {
            this.game.actionManager.currentEffectsStack.pop();
            return this.checkForNextAction();
        }

        action.execute();
        return this.checkForNextAction();
    }

    cancelAction(playerColor: keyof typeof PlayerColor): object {
        const player = this.getPlayerFromId(playerColor);
        if (this.activePlayer !== player) throw new InvalidActionResolution(`Rollback can only be done by ${this.activePlayer.name}, not ${player.name}`);

        let last = this.history.length - 1, lastNode = this.history[last];
        while (lastNode?.events.length === 0) {
            last--;
            lastNode = this.history[this.history.length - 2];
        }
        if (!lastNode || lastNode.events.length === 0) throw new InvalidActionResolution("Cannot roll back");
        let lastEvent = lastNode.events[lastNode.events.length - 1]!;
        if (lastEvent.player !== this.activePlayer.id || lastEvent.oneWay) {
            this.rollbackConsent = Object.fromEntries(this.game.players.map(e => [e.id, e.id === playerColor]));
            return this.checkForNextAction();
        }

        return this.authorizeCancel();
    }
    
    consentToRollback(playerColor: keyof typeof PlayerColor): object {
        const player = this.getPlayerFromId(playerColor);
        if (!this.rollbackConsent || !(playerColor in this.rollbackConsent)) throw new InvalidActionResolution(`No rollback consent needed from ${player.name}`);

        this.rollbackConsent[playerColor] = true;
        for (const consent of Object.values(this.rollbackConsent)) if (!consent) return this.checkForNextAction();
        return this.authorizeCancel();
    }

    authorizeCancel(): object {
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
        
        this.game.save();
        return this.checkForNextAction();
    }

    revertCurrentAction({ game, stack }: this["gameState"]): void {
        this.game.parse(game, true);
        this.actionsStack = stack;
        this.currentEffectsStack.length = 0;
    }
}
