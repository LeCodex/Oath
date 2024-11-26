import { UsePowerAction, PlayFacedownAdviserAction, MoveWarbandsAction, RestAction, MusterAction, TradeAction, TravelAction, RecoverAction, SearchAction, CampaignAction } from "./actions";
import { OathAction, InvalidActionResolution } from "./base";
import { OathEffect } from "./base";
import { PlayerColor } from "../enums";
import { OathGame } from "../game";
import { Constructor } from "../utils";


export class HistoryNode {
    constructor(
        public game: Record<string, any>,
        public events: HistoryEvent[] = []
    ) {}
}

export abstract class HistoryEvent {
    abstract replay(manager: OathActionManager): void;
};
export class StartEvent extends HistoryEvent {
    constructor(
        public actionName: string
    ) { super(); }

    replay(manager: OathActionManager) {
        manager.startAction(this.actionName);
    }
}
export class ContinueEvent extends HistoryEvent {
    constructor(
        public by: PlayerColor,
        public values: Record<string, string[]>
    ) { super(); }

    replay(manager: OathActionManager) {
        manager.continueAction(this.by, this.values);
    }
}


export class OathActionManager {
    game: OathGame;
    actionsStack: OathAction[] = [];
    futureActionsList: OathAction[] = [];
    currentEffectsStack: OathEffect<any>[] = [];
    history: HistoryNode[] = [];

    constructor(game: OathGame) {
        this.game = game;
    }

    get gameState() {
        return {
            game: this.game.serialize(),
            stack: [...this.actionsStack]
        };
    }

    get startOptions(): Record<string, Constructor<OathAction>> {
        return {
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
            appliedEffects: this.currentEffectsStack.map(e => e.serialize()).filter(e => e !== undefined).map(e => ({effect: e.constructor.name, ...e})),
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
            this.history.push(new HistoryNode(gameState.game, [new StartEvent(actionName)]));
            return data;
        } catch (e) {
            this.revertCurrentAction(gameState);
            throw e;
        }
    }

    continueAction(by: PlayerColor, values: Record<string, string[]>): object {
        const action = this.actionsStack[this.actionsStack.length - 1];
        if (!action) throw new InvalidActionResolution("No action to continue");

        const player = this.game.players.byId(by)[0];
        if (!player) throw new InvalidActionResolution(`Invalid player id ${by}`);
        if (action.player !== player) throw new InvalidActionResolution(`Action must be resolved by ${action.player.name}, not ${player.name}`);

        this.currentEffectsStack.length = 0;
        const parsed = action.parse(values);
        action.applyParameters(parsed);

        const gameState = this.gameState;
        try {
            const data = this.resolveTopAction();
            this.history[this.history.length - 1]?.events.push(new ContinueEvent(by, values));
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
        let i = this.history.length - 1;
        while (i > 0 && this.history[i]?.events.length === 0) i--;
        const node = this.history[i];
        if (!node || node.events.length === 0) throw new InvalidActionResolution("Cannot roll back");

        node.events.pop();
        this.game.parse(node.game, true);
        for (const event of node.events) event.replay(this);
        this.futureActionsList.length = 0;
        
        return this.checkForNextAction();
    }

    revertCurrentAction(gameState: { game: Record<string, any>, stack: OathAction[] }): void {
        this.game.parse(gameState.game, true);
        this.actionsStack = gameState.stack;
        this.currentEffectsStack.length = 0;
    }
}
