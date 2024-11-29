import { isEnumKey, RegionKey } from "../enums";
import { Container } from "../gameObject";
import { WorldCard, VisionBack, OathCard, Relic } from "./cards";


export abstract class CardDeck<T extends OathCard, U = any> extends Container<T, U> {
    type = "deck";
    abstract name: string;

    draw(amount: number, fromBottom: boolean = false, skip: number = 0): T[] {
        // Why such an involved process instead of just using splice? To make sure the draws are in correct order for reverting
        amount = Math.min(this.children.length - skip, amount);
        const cards: T[] = [];
        for (let i = 0; i < amount; i++) {
            const card = this.drawSingleCard(fromBottom, skip);
            if (card) cards.push(card);
        }
        return cards;
    }

    drawSingleCard(fromBottom: boolean = false, skip: number = 0): T | undefined {
        return this.children.splice(fromBottom ? skip: this.children.length - 1 - skip, 1)[0];
    }

    shuffle() {
        this.game.random.shuffleArray(this.children);
    }

    serialize(): Record<string, any> | undefined {
        return {
            ...super.serialize(),
            name: this.name
        };
    }
}

export class RelicDeck extends CardDeck<Relic, string> {
    name = "Relic Deck";

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

    serialize(): Record<string, any> | undefined {
        return {
            ...super.serialize(),
            searchCost: this.searchCost,
        };
    }
}

export class WorldDeck extends SearchableDeck<string> {
    name = "World Deck";
    visionsDrawn: number = 0;
    get searchCost() { return this.visionsDrawn < 3 ? this.visionsDrawn < 1 ? 2 : 3 : 4; }

    constructor() {
        super("worldDeck");
    }

    get key() { return this.id; }

    draw(amount: number, fromBottom: boolean = false, skip: number = 0): WorldCard[] {
        for (let i = 0; i < amount; i++) {
            const card = this.children[fromBottom ? i + skip : this.children.length - 1 - i - skip];
            if (!card) break;
            if (card instanceof VisionBack) {
                amount = i+1;
                break;
            }
        }
        
        return super.draw(amount, fromBottom, skip);
    }

    drawSingleCard(fromBottom?: boolean): WorldCard | undefined {
        const card = super.drawSingleCard(fromBottom);
        if (card instanceof VisionBack) this.visionsDrawn++;
        return card;
    }

    serialize(): Record<string, any> | undefined {
        return {
            ...super.serialize(),
            visionsDrawn: this.visionsDrawn
        };
    }

    parse(obj: Record<string, any>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.visionsDrawn = obj.visionsDrawn;
    }
}

export class Discard extends SearchableDeck<RegionKey> {
    id: keyof typeof RegionKey;
    name: string;
    
    constructor(id: keyof typeof RegionKey) {
        if (!isEnumKey(id, RegionKey)) throw TypeError(`${id} is not a valid region id`)
        super(id);
        this.name = id + " Discard";
    }

    get key() { return RegionKey[this.id]; }
}

export class DiscardOptions<T extends OathCard> {
    constructor(
        public discard: CardDeck<T>,
        public onBottom: boolean = false,
        public ignoreLocked: boolean = false
    ) { }
}
