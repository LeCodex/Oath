import { OathGameObject } from "../gameObject";
import { shuffleArray } from "../utils";
import { WorldCard, VisionBack, OathCard } from "./cards";


export class CardDeck<T extends OathCard> extends OathGameObject {
    cards: T[] = [];

    putCard(card: T, onBottom: boolean = false) {
        if (!card.facedown) card.hide();

        if (!this.cards.includes(card))
            if (onBottom) this.cards.push(card); else this.cards.unshift(card);
    }

    draw(amount: number, fromBottom: boolean = false, skip: number = 0): T[] {
        // Why such an involved process instead of just using splice? To make sure the draws are in correct order for reverting
        amount = Math.min(this.cards.length - skip, amount);
        let cards: T[] = [];
        for (let i = 0; i < amount; i++) {
            const card = this.drawSingleCard(fromBottom, skip);
            if (card) cards.push(card);
        }
        return cards;
    }

    drawSingleCard(fromBottom: boolean = false, skip: number = 0): T | undefined {
        return this.cards.splice(fromBottom ? this.cards.length - 1 - skip : skip, 1)[0];
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

    draw(amount: number, fromBottom: boolean = false, skip: number = 0): WorldCard[] {
        for (let i = 0; i < amount; i++) {
            const card = this.cards[fromBottom ? this.cards.length - 1 - i - skip : i + skip];
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

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.visionsDrawn = this.visionsDrawn;
        return obj;
    }
}

export class Discard extends SearchableDeck { }

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
