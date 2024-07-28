import { ConspiracyAction } from "../actions/other";
import { Denizen } from "../cards/denizens";
import { Conspiracy } from "../cards/visions";
import { PlayWorldCardEffect } from "../effects/basic";
import { OathPlayer } from "../player";
import { WhenPlayed } from "./base";


// NOTE: Visions are directly integrated in the WakeAction
export class ConspiracyPower extends WhenPlayed<Conspiracy> {
    name = "Conspiracy";

    whenPlayed(effect: PlayWorldCardEffect): void {
        const targets: OathPlayer[] = [];
        for (const player of Object.values(effect.game.players)) {
            if (player.site === effect.player.site) {
                let totalAdviserSuitCount = 0;
                for (const adviser of player.advisers)
                    if (!adviser.facedown && adviser instanceof Denizen)
                        totalAdviserSuitCount += effect.player.adviserSuitCount(adviser.suit);

                if (totalAdviserSuitCount >= 2) targets.push(player);
            }
        }

        new ConspiracyAction(effect.player, targets).doNext();
    }
}
