import { ChoosePlayer, ConspiracyStealAction } from "../actions/actions";
import { Conspiracy, Denizen } from "../cards/cards";
import { OathPlayer } from "../player";
import { WhenPlayed } from "./powers";


// NOTE: Visions are directly integrated in the WakeAction
export class ConspiracyPower extends WhenPlayed<Conspiracy> {
    name = "Conspiracy";

    whenPlayed(): void {
        const targets: OathPlayer[] = [];
        for (const playerProxy of Object.values(this.gameProxy.players)) {
            if (playerProxy.site === this.effect.playerProxy.site) {
                let totalAdviserSuitCount = 0;
                for (const adviserProxy of playerProxy.advisers)
                    if (!adviserProxy.facedown && adviserProxy instanceof Denizen)
                        totalAdviserSuitCount += this.effect.playerProxy.suitAdviserCount(adviserProxy.suit);

                if (totalAdviserSuitCount >= 2)
                    targets.push(playerProxy);
            }
        }

        new ChoosePlayer(
            this.effect.player, "", 
            (target: OathPlayer | undefined) => { if (target !== undefined) new ConspiracyStealAction(this.effect.player, target).doNext(); }, 
            targets, "No one"
        ).doNext();
    }
}
