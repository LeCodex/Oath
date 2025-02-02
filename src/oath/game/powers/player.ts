import { SeizeModifier } from ".";
import { CampaignBanishPlayerAction } from "../actions";
import { TransferResourcesEffect } from "../actions/effects";
import { ResourceCost } from "../costs";
import type { OathPlayer } from "../model/player";
import { Favor } from "../model/resources";


export class PlayerSeize extends SeizeModifier<OathPlayer> {
    applyAfter(): void {
        const cost = new ResourceCost([], [[Favor, Math.floor(this.source.byClass(Favor).length / 2)]]);
        new TransferResourcesEffect(this.actionManager, this.player, cost, undefined).doNext();
        new CampaignBanishPlayerAction(this.actionManager, this.player, this.source).doNext();
    }
}
