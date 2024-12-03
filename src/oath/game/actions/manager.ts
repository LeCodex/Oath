import { UsePowerAction, PlayFacedownAdviserAction, MoveWarbandsAction, RestAction, MusterAction, TradeAction, TravelAction, RecoverAction, SearchAction, CampaignAction } from "./actions";
import { OathAction, OathEffect, InvalidActionResolution } from "./base";
import { PlayerColor } from "../enums";
import { OathGame } from "../game";
import { Constructor } from "../utils";
import * as fs from 'fs';


export class HistoryNode {
    constructor(
        public game: Record<string, any>,
        public events: HistoryEvent[] = []
    ) { }
    
    serialize() {
        return (
            JSON.stringify(this.game) + "\n" +
            this.events.map(e => JSON.stringify(e.serialize())).join("\n")
        );
    }

    parse(data: string) {
        const lines = data.split("\n");
        this.game = JSON.parse(lines.shift()!)
        for (const line of lines) {
            const lineData = JSON.parse(line) as { name: keyof typeof eventsIndex, player: keyof typeof PlayerColor, data: any };
            this.events.push(new eventsIndex[lineData.name](lineData.player, lineData.data))
        }
    }
}

export abstract class HistoryEvent {
    constructor(
        public player: keyof typeof PlayerColor
    ) { }

    abstract replay(manager: OathActionManager): void;
    
    serialize(): Record<string, any> {
        return {
            name: this.constructor.name,
            player: this.player
        };
    }
};
export class StartEvent extends HistoryEvent {
    constructor(
        player: keyof typeof PlayerColor,
        public actionName: string
    ) { super(player); }

    replay(manager: OathActionManager) {
        manager.startAction(this.actionName, false);
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            data: this.actionName
        };
    }
}
export class ContinueEvent extends HistoryEvent {
    constructor(
        player: keyof typeof PlayerColor,
        public values: Record<string, string[]>
    ) { super(player); }

    replay(manager: OathActionManager) {
        manager.continueAction(this.player, this.values, false);
    }

    serialize(): Record<string, any> {
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
    savePath = "src/oath/data/save.txt";
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
            game: this.game.serialize(true),
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

    startAction(actionName: string, save: boolean = true): object {
        const action = this.startOptions[actionName];
        if (!action)
            throw new InvalidActionResolution("Invalid starting action name");

        this.currentEffectsStack.length = 0;
        new action(this.game.currentPlayer).doNext();

        const gameState = this.gameState;
        try {
            const data = this.checkForNextAction();
            this.history.push(new HistoryNode(gameState.game, [new StartEvent(this.game.currentPlayer.id, actionName)]));
            if (save) this.saveHistory();
            return data;
        } catch (e) {
            this.revertCurrentAction(gameState);
            throw e;
        }
    }

    continueAction(playerColor: keyof typeof PlayerColor, values: Record<string, string[]>, save: boolean = true): object {
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
            if (save) this.saveHistory();
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
        return this.history.map(e => e.serialize()).join("\n\n");
    }

    saveHistory() {
        const data = this.serializeHistory();
        fs.writeFileSync(this.savePath, data);
    }

    parseHistory(data: string) {
        data.split("\n\n").map(e => new HistoryNode(this.game).parse(e))
    }

    loadHistory() {
        if (!fs.existsSync(this.savePath)) return;
        const data = fs.readFileSync(this.savePath).toString();
        this.parseHistory(data);
    }
}
