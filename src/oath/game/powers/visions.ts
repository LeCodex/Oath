import { ConspiracyAction } from "../actions";
import { Conspiracy, Denizen } from "../cards/cards";
import { ApplyWhenPlayedEffect } from "../effects";
import { OathPlayer } from "../player";
import { WhenPlayed } from "./powers";


// NOTE: Visions are directly integrated in the WakeAction
export class ConspiracyPower extends WhenPlayed<Conspiracy> {
    name = "Conspiracy";

    whenPlayed(effect: ApplyWhenPlayedEffect): void {
        const targets: OathPlayer[] = [];
        for (const player of Object.values(effect.game.players)) {
            if (player.site === effect.player.site) {
                let totalAdviserSuitCount = 0;
                for (const adviser of player.advisers)
                    if (!adviser.facedown && adviser instanceof Denizen)
                        totalAdviserSuitCount += effect.player.adviserSuitCount(adviser.suit);

                if (totalAdviserSuitCount >= 2)
                    targets.push(player);
            }
        }

        new ConspiracyAction(effect.player, targets).doNext();
    }
}
