import { CampaignDefenseAction, ChoosePlayersAction, ConspiracyStealAction } from "../actions/actions";
import { Conspiracy, Denizen } from "../cards/cards";
import { Oath } from "../oaths";
import { OathPlayer } from "../player";
import { ActionModifier, WhenPlayed } from "./powers";


export class OathDefense extends ActionModifier<Oath, CampaignDefenseAction> {
    name = "Oathkeeper"
    modifiedAction = CampaignDefenseAction;

    canUse(): boolean {
        return this.activatorProxy === this.sourceProxy.parent;
    }

    applyBefore(): void {
        this.action.campaignResult.params.defPool += this.gameProxy.isUsurper ? 2 : 1;
    }
}


// NOTE: Visions are directly integrated in the WakeAction
export class ConspiracyPower extends WhenPlayed<Conspiracy> {
    name = "Conspiracy";

    whenPlayed(): void {
        const targets: OathPlayer[] = [];
        for (const playerProxy of this.gameProxy.players) {
            if (playerProxy.site === this.effect.executorProxy.site) {
                let totalAdviserSuitCount = 0;
                for (const adviserProxy of playerProxy.advisers)
                    if (!adviserProxy.facedown && adviserProxy instanceof Denizen)
                        totalAdviserSuitCount += this.effect.executorProxy.suitAdviserCount(adviserProxy.suit);

                if (totalAdviserSuitCount >= 2)
                    targets.push(playerProxy);
            }
        }

        new ChoosePlayersAction(
            this.effect.executor, "Target a player (or no-one) with the Conspiracy", 
            (targets: OathPlayer[]) => { if (targets[0]) new ConspiracyStealAction(this.effect.executor, targets[0]).doNext(); }, 
            [targets],
            [[0, 1]]
        ).doNext();
    }
}
