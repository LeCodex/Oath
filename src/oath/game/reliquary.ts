import { Relic } from "./cards/cards";
import { OathGameObject } from "./gameObject";
import { WithPowers } from "./interfaces";
import { OathPower } from "./powers/powers";
import { Brutal, Decadent, Careless, Greedy } from "./powers/reliquary";
import { Container } from "./gameObject";
import { Constructor } from "./utils";


export class Reliquary extends Container<ReliquarySlot, "reliquary"> {
    constructor() {
        super("reliquary", ReliquarySlot);
        for (const [i, power] of [Brutal, Decadent, Careless, Greedy].entries())
            this.addChild(new ReliquarySlot(i, [power], this.game.relicDeck.drawSingleCard()));
    }

    putRelic(relic: Relic | undefined, index: number): Relic | undefined {
        const oldRelic = this.getRelic(index);
        if (relic) this.children[index]?.addChild(relic);
        return oldRelic;
    }

    getRelic(index: number): Relic | undefined {
        return this.children[index]?.children[0];
    }
}

export class ReliquarySlot extends Container<Relic, number> implements WithPowers {
    powers: Set<Constructor<OathPower<ReliquarySlot>>>;

    constructor(id: number, powers: Iterable<Constructor<OathPower<ReliquarySlot>>>, relic?: Relic) {
        super(id, Relic);
        if (relic) this.addChild(relic);
        this.powers = new Set(powers);
    }
}
