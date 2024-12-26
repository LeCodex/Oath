import { Denizen, Site, WorldCard } from "../cards";
import { OathPlayer } from "../player";
import { CapacityModifier } from ".";


// ------------------ GENERAL ------------------- //
export class IgnoresCapacity extends CapacityModifier<Denizen> {
    get name() { return "Ignores Capacity"; }

    canUse(player: OathPlayer, site?: Site): boolean {
        return player === this.source.ruler;
    }

    ignoreCapacity(cardProxy: WorldCard): boolean {
        return !cardProxy.facedown && cardProxy === this.sourceProxy;
    }
}
