import { OathEffect } from "./base";
import { OathPlayer } from "../player";
import { OathAction } from "../actions/base";


export class ResolveEffectAction extends OathAction {
    readonly message = "";

    effect: OathEffect<any>;

    constructor(player: OathPlayer, effect: OathEffect<any>) {
        super(player, false); // Don't copy, not modifiable, and not an entry point
        this.effect = effect;
    }

    execute(): void {
        this.effect.do();
    }
}
