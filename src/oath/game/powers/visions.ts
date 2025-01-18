import { CampaignDefenseAction, ChoosePlayersAction, ConspiracyStealAction } from "../actions";
import type { Conspiracy } from "../model/cards";
import { Denizen } from "../model/cards";
import type { Oathkeeper } from "../model/oaths";
import type { OathPlayer } from "../model/player";
import { ActionModifier, WhenPlayed } from ".";


export class OathkeeperDefense extends ActionModifier<Oathkeeper, CampaignDefenseAction> {
    modifiedAction = CampaignDefenseAction;
    mustUse = true;
    get name() { return "Oathkeeper"; }

    canUse(): boolean {
        return this.playerProxy === this.sourceProxy.parent;
    }

    applyBefore(): void {
        this.action.campaignResult.defPool += this.gameProxy.isUsurper ? 2 : 1;
    }
}


// NOTE: Visions are directly integrated in the WakeAction
export class ConspiracyWhenPlayed extends WhenPlayed<Conspiracy> {
    whenPlayed(): void {
        const targets: OathPlayer[] = [];
        for (const playerProxy of this.gameProxy.players) {
            if (playerProxy.site === this.action.executorProxy.site) {
                let totalAdviserSuitCount = 0;
                for (const adviserProxy of playerProxy.advisers)
                    if (!adviserProxy.facedown && adviserProxy instanceof Denizen)
                        totalAdviserSuitCount += this.action.executorProxy.suitAdviserCount(adviserProxy.suit);

                if (totalAdviserSuitCount >= 2)
                    targets.push(playerProxy);
            }
        }

        new ChoosePlayersAction(
            this.action.executor, "Target a player (or no-one) with the Conspiracy",
            (targets: OathPlayer[]) => { if (targets[0]) new ConspiracyStealAction(this.action.executor, targets[0]).doNext(); }, 
            [targets],
            [[0, 1]]
        ).doNext();
    }
}
