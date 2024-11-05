import { Relic } from "./cards/cards";
import { WithPowers } from "./interfaces";
import { OathPower } from "./powers/powers";
import { Container } from "./gameObject";
import { Constructor } from "./utils";
import { Brutal, Decadent, Careless, Greedy } from "./powers/reliquary";


export class Reliquary extends Container<ReliquarySlot, string> {
    type = "reliquary";

    constructor() {
        super("reliquary", ReliquarySlot);
    }

    get id() { return this._id; }

    putRelic(relic: Relic | undefined, index: number): Relic | undefined {
        const oldRelic = this.getRelic(index);
        if (relic) this.children[index]?.addChild(relic);
        return oldRelic;
    }

    getRelic(index: number): Relic | undefined {
        return this.children[index]?.children[0];
    }
}

export const reliquarySlotPowers = [Brutal, Decadent, Careless, Greedy];

export class ReliquarySlot extends Container<Relic, number> implements WithPowers {
    name: string;
    type = "reliquarySlot";
    powers: Set<Constructor<OathPower<ReliquarySlot>>>;

    get active(): boolean { return !this.children[0]; }

    constructor(id: string, relic?: Relic) {
        const power = reliquarySlotPowers[Number(id)];
        if (!power) throw new TypeError(`${id} is not a valid Reliquary slot`);
        super(id, Relic);
        this.name = power.name;
        this.powers = new Set([power]);
        if (relic) this.addChild(relic);
    }

    get id() { return Number(this._id); }

    serialize(): Record<string, any> | undefined {
        const obj = super.serialize();
        return {
            ...obj,
            name: this.name
        };
    }
}
