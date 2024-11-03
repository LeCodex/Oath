import { Relic } from "./cards/cards";
import { WithPowers } from "./interfaces";
import { OathPower } from "./powers/powers";
import { Container } from "./gameObject";
import { Constructor } from "./utils";


export class Reliquary extends Container<ReliquarySlot, "reliquary"> {
    type = "reliquary";

    constructor() {
        super("reliquary", ReliquarySlot);
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
    name: string;
    type = "reliquarySlot";
    powers: Set<Constructor<OathPower<ReliquarySlot>>>;

    get active(): boolean { return !this.children[0]; }

    constructor(id: number, name: string, powers: Iterable<Constructor<OathPower<ReliquarySlot>>>, relic?: Relic) {
        super(id, Relic);
        this.name = name;
        if (relic) this.addChild(relic);
        this.powers = new Set(powers);
    }

    serialize(): Record<string, any> | undefined {
        const obj = super.serialize();
        return {
            ...obj,
            name: this.name
        };
    }
}
