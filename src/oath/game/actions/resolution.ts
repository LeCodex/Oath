import { OathGame } from "../game";
import { OathAction } from "./base";
import { OathEffect } from "../effects/base";


export class AddActionToStackEffect extends OathEffect<void> {
    action: OathAction;

    constructor(action: OathAction) {
        super(action.game, undefined, true);
        this.action = action;
    }

    resolve(): void {
        this.game.original.actionManager.actionStack.push(this.action);
    }

    revert(): void {
        this.game.original.actionManager.actionStack.pop();
    }
}

export class PopActionFromStackEffect extends OathEffect<OathAction | undefined> {
    action?: OathAction;

    constructor(game: OathGame) {
        super(game, undefined, true);
    }

    resolve(): OathAction | undefined {
        const action = this.game.original.actionManager.actionStack.pop();
        if (!action) {
            this.game.original.actionManager.currentEffectsStack.pop();
            return;
        }
        this.action = action;
        return action;
    }

    revert(): void {
        if (this.action) this.game.original.actionManager.actionStack.push(this.action);
    }
}


