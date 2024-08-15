import { OathGameObject } from "../gameObject";
import { shuffleArray } from "../utils";
import { WorldCard, VisionBack, Relic, OathCard } from "./cards";


export class CardDeck<T extends OathCard> extends OathGameObject {
    cards: T[] = [];

    putCard(card: T, onBottom: boolean = false) {
        if (!card.facedown) card.hide();

        if (!this.cards.includes(card))
            if (onBottom) this.cards.push(card); else this.cards.unshift(card);
    }

    draw(amount: number, fromBottom: boolean = false, skip: number = 0): T[] {
        // Why such an involved process instead of just using splice? To make sure the draws are in correct order for reverting
        let cards: T[] = [];
        for (let i = skip; i < Math.min(this.cards.length, skip + amount); i ++) {
            const card = this.drawSingleCard(fromBottom);
            if (card) cards.push(card);
        }
        return cards;
    }

    drawSingleCard(fromBottom: boolean = false): T | undefined {
        return fromBottom ? this.cards.pop() : this.cards.shift();
    }

    shuffle() {
        shuffleArray(this.cards);
    }

    serialize(): Record<string, any> {
        return {
            cards: this.cards.map(e => e.serialize())
        }
    }
}

export abstract class SearchableDeck extends CardDeck<WorldCard> {
    get searchCost() { return 2; }

    putCard(card: WorldCard, onBottom?: boolean): void {
        card.setOwner(undefined);
        if (!card.empty) card.returnResources();
        super.putCard(card, onBottom);
    }

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.searchCost = this.searchCost;
        return obj;
    }
}

export class WorldDeck extends SearchableDeck {
    visionsDrawn: number = 0;
    get searchCost() { return this.visionsDrawn < 3 ? this.visionsDrawn < 1 ? 2 : 3 : 4; }

    drawSingleCard(fromBottom?: boolean): WorldCard | undefined {
        const card = super.drawSingleCard(fromBottom);
        if (card instanceof VisionBack) this.visionsDrawn++;
        return card;
    }

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.visionsDrawn = this.visionsDrawn;
        return obj;
    }
}

export class Discard extends SearchableDeck { }

export class RelicDeck extends CardDeck<Relic> { }

export class DiscardOptions<T extends OathCard> {
    discard: CardDeck<T>;
    onBottom: boolean;
    ignoreLocked: boolean;

    constructor(discard: CardDeck<T>, onBottom: boolean = false, ignoreLocked: boolean = false) {
        this.discard = discard;
        this.onBottom = onBottom;
        this.ignoreLocked = ignoreLocked;
    }
}
