import { UsePowerAction, PlayFacedownAdviserAction, MoveWarbandsAction, RestAction, MusterAction, TradeAction, TravelAction, RecoverAction, SearchAction, CampaignAction } from "./actions";
import { OathAction, OathEffect, InvalidActionResolution } from "./base";
import { PlayerColor } from "../enums";
import { OathGame } from "../game";
import { Constructor } from "../utils";


export class HistoryNode {
    constructor(
        public game: Record<string, any>,
        public events: HistoryEvent[] = []
    ) { }
    
    serialize() {
        return (
            JSON.stringify(this.game) + "\n" +
            this.events.map(e => JSON.stringify(e)).join("\n")
        );
    }
}

export abstract class HistoryEvent {
    constructor(
        public player: keyof typeof PlayerColor
    ) { }

    abstract replay(manager: OathActionManager): void;
};
export class StartEvent extends HistoryEvent {
    constructor(
        player: keyof typeof PlayerColor,
        public actionName: string
    ) { super(player); }

    replay(manager: OathActionManager) {
        manager.startAction(this.actionName);
    }
}
export class ContinueEvent extends HistoryEvent {
    constructor(
        player: keyof typeof PlayerColor,
        public values: Record<string, string[]>
    ) { super(player); }

    replay(manager: OathActionManager) {
        manager.continueAction(this.player, this.values);
    }
}


export class OathActionManager {
    game: OathGame;
    actionsStack: OathAction[] = [];
    futureActionsList: OathAction[] = [];
    currentEffectsStack: OathEffect<any>[] = [];
    history: HistoryNode[] = [];
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
            game: this.game.serialize(),
            stack: [...this.actionsStack]
        };
    }
 
    checkForNextAction(): Record<string, any> {
        for (const action of this.futureActionsList) this.actionsStack.push(action);
        this.futureActionsList.length = 0;

        if (!this.actionsStack.length) this.game.checkForOathkeeper();
        let action = this.actionsStack[this.actionsStack.length - 1];

        let continueNow = action?.start();
        if (continueNow) return this.resolveTopAction();

        const returnData = {
            activeAction: action?.serialize(),
            startOptions: !action ? Object.keys(this.startOptions) : undefined,
            appliedEffects: this.currentEffectsStack.map(e => e.serialize()).filter(e => e !== undefined),
            game: this.game.serialize()
        };
        return returnData;
    }

    startAction(actionName: string): object {
        const action = this.startOptions[actionName];
        if (!action)
            throw new InvalidActionResolution("Invalid starting action name");

        this.currentEffectsStack.length = 0;
        new action(this.game.currentPlayer).doNext();

        const gameState = this.gameState;
        try {
            const data = this.checkForNextAction();
            this.history.push(new HistoryNode(gameState.game, [new StartEvent(this.game.currentPlayer.id, actionName)]));
            return data;
        } catch (e) {
            this.revertCurrentAction(gameState);
            throw e;
        }
    }

    continueAction(playerColor: keyof typeof PlayerColor, values: Record<string, string[]>): object {
        const action = this.actionsStack[this.actionsStack.length - 1];
        if (!action) throw new InvalidActionResolution("No action to continue");

        const by = PlayerColor[playerColor];
        const player = this.game.players.byKey(by)[0];
        if (!player) throw new InvalidActionResolution(`Invalid player id ${by}`);
        if (action.player !== player) throw new InvalidActionResolution(`Action must be resolved by ${action.player.name}, not ${player.name}`);

        this.currentEffectsStack.length = 0;
        const parsed = action.parse(values);
        action.applyParameters(parsed);

        const gameState = this.gameState;
        try {
            const data = this.resolveTopAction();
            this.history[this.history.length - 1]?.events.push(new ContinueEvent(playerColor, values));
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

    cancelAction(): object {
        while (this.history[this.history.length - 1]?.events.length === 0) this.history.pop();
        const node = this.history[this.history.length - 1];
        if (!node || node.events.length === 0) throw new InvalidActionResolution("Cannot roll back");

        node.events.pop();
        this.actionsStack.length = 0;
        this.futureActionsList.length = 0;
        this.currentEffectsStack.length = 0;
        this.game.parse(node.game, true);
        if (this.history.length === 1) this.game.initialActions();
        for (const event of node.events) event.replay(this);
        
        return this.checkForNextAction();
    }

    revertCurrentAction(gameState: { game: Record<string, any>, stack: OathAction[] }): void {
        this.game.parse(gameState.game, true);
        this.actionsStack = gameState.stack;
        this.currentEffectsStack.length = 0;
    }

    serializeHistory() {
        return this.history.map(e => e.serialize()).join("\n");
    }
}
