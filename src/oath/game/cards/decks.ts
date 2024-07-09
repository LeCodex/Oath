import { OathGameObject } from "../game";
import { OwnableCard, WorldCard, VisionBack, Relic } from "./cards";


export abstract class CardDeck<T extends OwnableCard> extends OathGameObject {
    cards: T[];

    putCard(card: T, onBottom: boolean = false) {
        card.setOwner(undefined);
        card.hide();

        if (!this.cards.includes(card))
            if (onBottom) this.cards.push(card); else this.cards.unshift(card);
    }

    draw(amount: number, fromBottom: boolean = false): T[] {
        // Why such an involved process instead of just using splice? To make sure the draws are in correct order for reverting
        let cards: T[] = [];
        for (let i = 0; i < amount; i ++) {
            const card = this.drawSingleCard(fromBottom)
            if (card) cards.push(card);
        }
        return cards;
    }

    drawSingleCard(fromBottom: boolean = false): T | undefined {
        return fromBottom ? this.cards.pop() : this.cards.shift();
    }
}

export abstract class SearchableDeck extends CardDeck<WorldCard> {
    get searchCost() { return 2; }

    putCard(card: WorldCard, onBottom?: boolean): void {
        card.returnResources();
        super.putCard(card, onBottom);
    }
}

export class WorldDeck extends SearchableDeck {
    visionsDrawn: number;
    get searchCost() { return this.visionsDrawn < 3 ? this.visionsDrawn < 1 ? 2 : 3 : 4; }

    draw(amount: number, fromBottom: boolean = false): WorldCard[] {
        const cards: WorldCard[] = [];
        for (let i = 0; i < amount; i++) {
            const card = this.drawSingleCard(fromBottom);
            if (!card) break;

            cards.push(card);
            if (card instanceof VisionBack) {
                this.visionsDrawn++;
                break;
            }
        }

        return cards;
    }
}

export class Discard extends SearchableDeck {

}

export class RelicDeck extends CardDeck<Relic> {

}
