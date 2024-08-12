import { Relic } from "./cards/cards";
import { OathGame } from "./game";
import { OathGameObject } from "./gameObject";
import { Brutal, Decadent, Careless, Greedy } from "./powers/reliquary";


export class Reliquary extends OathGameObject {
    relics: [Relic?, Relic?, Relic?, Relic?] = [];
    slotPowers = [Brutal, Decadent, Careless, Greedy];

    constructor(game: OathGame) {
        super(game);
        for (let i = 0; i < 4; i++) this.putRelic(this.game.relicDeck.drawSingleCard(), i);
    }

    putRelic(relic: Relic | undefined, index: number): Relic | undefined {
        const oldRelic = this.relics[index];
        this.relics[index] = relic;
        return oldRelic;
    }

    takeRelic(index: number): Relic | undefined {
        const relic = this.relics[index];
        this.relics[index] = undefined;
        return relic;
    }

    serialize() {
        return {
            relics: this.relics.map(e => e?.serialize()),
        };
    }
}
