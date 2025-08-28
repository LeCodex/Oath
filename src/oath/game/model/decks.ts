import { RegionKey } from "../enums";
import { isEnumKey } from "../utils";
import { Container } from "./gameObject";
import type { OathCard } from "./cards";
import { WorldCard, VisionBack, Relic } from "./cards";
import type { SerializedNode } from "./utils";


export abstract class CardDeck<T extends OathCard, U = any> extends Container<T, U> {
    readonly type = "deck";

    draw(amount: number, fromBottom: boolean = false, skip: number = 0) {
        // Why such an involved process instead of just using splice? To make sure the draws are in correct order for reverting
        amount = Math.min(this.children.length - skip, amount);
        const cards: T[] = [];
        for (let i = 0; i < amount; i++) {
            const card = this.drawSingleCard(fromBottom, skip);
            if (card) cards.push(card);
        }
        return cards;
    }

    drawSingleCard(fromBottom: boolean = false, skip: number = 0) {
        return this.children[!fromBottom ? skip : this.children.length - 1 - skip]?.prune();
    }

    shuffle() {
        this.game.random.shuffleArray(this.children);
    }
}

export class RelicDeck extends CardDeck<Relic, string> {
    declare readonly id: "relicDeck";
    name = "RelicDeck";

    constructor() {
        super("relicDeck", Relic);
    }

    get key() { return this.id; }
}

export abstract class SearchableDeck<T = any> extends CardDeck<WorldCard, T> {
    get searchCost() { return 2; }

    constructor(id: string) {
        super(id, WorldCard);
    }

    constSerialize(): Record<`_${string}`, any> {
        return {
            ...super.constSerialize(),
            _searchCost: this.searchCost
        };
    }
}

export class WorldDeck extends SearchableDeck<string> {
    declare readonly id: "worldDeck";
    name = "WorldDeck";
    visionsDrawn: number = 0;
    get searchCost() { return this.visionsDrawn < 3 ? this.visionsDrawn < 1 ? 2 : 3 : 4; }

    constructor() {
        super("worldDeck");
    }

    get key() { return this.id; }

    drawSingleCard(fromBottom?: boolean): WorldCard | undefined {
        const card = super.drawSingleCard(fromBottom);
        if (card instanceof VisionBack) this.visionsDrawn++;
        return card;
    }

    liteSerialize() {
        return {
            ...super.liteSerialize(),
            visionsDrawn: this.visionsDrawn
        };
    }

    parse(obj: SerializedNode<this>, allowCreation?: boolean): this {
        super.parse(obj, allowCreation);
        this.visionsDrawn = obj.visionsDrawn;
        return this;
    }
}

export class Discard extends SearchableDeck<RegionKey> {
    declare readonly id: keyof typeof RegionKey;
    
    constructor(id: keyof typeof RegionKey) {
        if (!isEnumKey(id, RegionKey)) throw TypeError(`${id} is not a valid region id`)
        super(id);
    }

    get name() { return `${this.id}Discard` }
    get key() { return RegionKey[this.id]; }
}

export class DiscardOptions<T extends OathCard> {
    constructor(
        public discard: CardDeck<T>,
        public onBottom: boolean = false,
        public ignoreLocked: boolean = false
    ) { }
}
