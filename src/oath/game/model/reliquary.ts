import { Relic } from "./cards";
import type { WithPowers } from "./interfaces";
import { Container } from "./gameObject";
import { OathPlayer } from "./player";
import type { ReliquaryPowerName } from "../powers/classIndex";


export class Reliquary extends Container<ReliquarySlot, string> {
    declare readonly id: "reliquary";
    readonly type = "reliquary";
    name = "Reliquary";

    constructor() {
        super("reliquary", ReliquarySlot);
    }

    get key() { return this.id; }
    get hidden() { return !this.typedParent(OathPlayer); }

    putRelic(relic: Relic | undefined, index: number): Relic | undefined {
        const oldRelic = this.getRelic(index);
        if (relic) this.children[index]?.addChild(relic);
        return oldRelic;
    }

    getRelic(index: number): Relic | undefined {
        return this.children[index]?.children[0];
    }
}

export const reliquarySlotPowers: ReliquaryPowerName[] = ["Brutal", "Decadent", "Careless", "Greedy"];

export class ReliquarySlot extends Container<Relic, number> implements WithPowers {
    name: string;
    readonly type = "reliquarySlot";
    powers: ReliquaryPowerName[];

    get active(): boolean { return !this.children[0]; }

    constructor(id: string) {
        const power = reliquarySlotPowers[Number(id)];
        if (!power) throw TypeError(`${id} is not a valid Reliquary slot`);
        super(id, Relic);
        this.name = power;
        this.powers = [power];
    }
    
    getRelic() {
        const relic = this.game.relicDeck.drawSingleCard();
        if (relic) this.addChild(relic);
    }

    get key() { return Number(this.id); }
}
