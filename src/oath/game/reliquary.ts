import { Relic } from "./cards/cards";
import { OathGame } from "./game";
import { OathGameObject } from "./gameObject";
import { WithPowers } from "./interfaces";
import { OathPower } from "./powers/powers";
import { Brutal, Decadent, Careless, Greedy } from "./powers/reliquary";
import { Constructor } from "./utils";


export class Reliquary extends OathGameObject {
    slots: [ReliquarySlot, ReliquarySlot, ReliquarySlot, ReliquarySlot];

    constructor(game: OathGame) {
        super(game);
        const powers = [Brutal, Decadent, Careless, Greedy];
        this.slots = powers.map(e => new ReliquarySlot(this.game, [e], this.game.relicDeck.drawSingleCard())) as [ReliquarySlot, ReliquarySlot, ReliquarySlot, ReliquarySlot];
    }

    putRelic(relic: Relic | undefined, index: number): Relic | undefined {
        const oldRelic = this.slots[index].relic;
        this.slots[index].relic = relic;
        return oldRelic;
    }

    takeRelic(index: number): Relic | undefined {
        const relic = this.slots[index].relic;
        this.slots[index].relic = undefined;
        return relic;
    }

    serialize() {
        return {
            relics: this.slots.map(e => e.relic?.serialize()),
        };
    }
}

export class ReliquarySlot extends OathGameObject implements WithPowers {
    relic?: Relic;
    powers: Set<Constructor<OathPower<WithPowers>>>;

    constructor(game: OathGame, powers: Iterable<Constructor<OathPower<WithPowers>>>, relic?: Relic) {
        super(game);
        this.relic = relic;
        this.powers = new Set(powers);
    }
}
