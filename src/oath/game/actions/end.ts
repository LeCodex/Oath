import { Denizen, Edifice } from "../cards/denizens";
import { VisionBack } from "../cards/visions";
import { ChangeEdificeEffect, BuildEdificeFromDenizenEffect } from "../effects/phases";
import { BecomeExileEffect, BecomeCitizenEffect, DiscardCardEffect, DiscardCardGroupEffect, DrawFromDeckEffect } from "../effects/basic";
import { OathType, OathTypeName, OathSuit } from "../enums";
import { OathTypeToOath } from "../oaths";
import { Exile, OathPlayer } from "../player";
import { shuffleArray } from "../utils";
import { OathAction, SelectNOf } from "./base";
import { SearchDiscardOptions } from "./types";
import { AskForPermissionAction } from "./minor";
import { ChooseSuit } from "./other";


export class VowOathAction extends OathAction {
    readonly selects: { oath: SelectNOf<OathType>; };
    readonly parameters: { oath: OathType[]; };
    readonly message = "Vow an Oath";

    start(): boolean {
        const choices = new Map<string, OathType>();
        if (this.player instanceof Exile && this.player.vision) {
            const oathType = this.player.vision.oath.type;
            choices.set(OathTypeName[oathType], oathType);
        } else {
            for (let i: OathType = 0; i < 4; i++)
                if (i !== this.game.original.oath.type)
                    choices.set(OathTypeName[i], i);
        }
        this.selects.oath = new SelectNOf(choices);
        return super.start();
    }

    execute(): void {
        const oathType = this.parameters.oath[0];
        this.game.oath = new OathTypeToOath[oathType](this.game.original);
    }
}

export class ChooseNewCitizensAction extends OathAction {
    readonly selects: { players: SelectNOf<OathPlayer>; };
    readonly parameters: { players: OathPlayer[]; };
    readonly message = "Propose Citizenship to other Exiles";

    start() {
        const choices = new Map<string, OathPlayer>();
        const players = new Set(Object.values(this.game.players).filter(e => !e.isImperial && e.original !== this.player.original));
        for (const player of players) choices.set(player.name, player);
        this.selects.players = new SelectNOf(choices);
        return super.start();
    }

    execute(): void {
        const citizens = this.parameters.players;
        for (const player of Object.values(this.game.players))
            if (player instanceof Exile && player.isCitizen)
                new BecomeExileEffect(player).do();

        for (const citizen of citizens)
            new AskForPermissionAction(citizen, new BecomeCitizenEffect(citizen)).doNext();
    }
}

export class BuildOrRepairEdificeAction extends OathAction {
    readonly selects: { card: SelectNOf<Denizen | undefined>; };
    readonly parameters: { card: (Denizen | undefined)[]; };
    readonly message = "Build or repair an edifice";

    start(): boolean {
        const choices = new Map<string, Denizen | undefined>();
        for (const site of this.game.board.sites()) {
            if (site.ruler?.isImperial) {
                for (const denizen of site.denizens) {
                    if (!(denizen instanceof Edifice && denizen.suit !== OathSuit.None))
                        choices.set(denizen.name, denizen);
                }
            }
        }
        choices.set("None", undefined);
        this.selects.card = new SelectNOf(choices, 1);
        return super.start();
    }

    execute(): void {
        const card = this.parameters.card[0];
        if (!card) return;

        if (card instanceof Edifice)
            new ChangeEdificeEffect(card, false).do();

        else
            new BuildEdificeFromDenizenEffect(card).do();
    }
}

export class AddCardsToWorldDeckAction extends ChooseSuit {
    readonly message = "Choose a suit to add to the World Deck";

    constructor(player: OathPlayer) {
        let max = 0;
        const suits: OathSuit[] = [];
        for (let i: OathSuit = 0; i < 6; i++) {
            const count = player.adviserSuitCount(i);
            if (count >= max) {
                max = count;
                suits.splice(0, suits.length, i);
            } else if (count === max) {
                suits.push(i);
            }
        }
        super(player, suits);
    }

    getRandomCardDataInArchive(suit: OathSuit): string[] {
        const cardData: string[] = [];
        for (const [key, data] of Object.entries(this.game.archive))
            if (data[0] === suit) cardData.push(key);

        shuffleArray(cardData);
        return cardData;
    }

    execute(): void {
        super.execute();
        if (!this.suit) return;

        // Add cards from the archive
        const worldDeck = this.game.original.worldDeck;
        const worldDeckDiscardOptions = new SearchDiscardOptions(worldDeck);
        for (let i = 3; i >= 1; i--) {
            const cardData = this.getRandomCardDataInArchive(this.suit);
            for (let j = 0; j < i; j++) {
                const key = cardData.pop();
                if (!key) break;
                const data = this.game.archive[key];
                if (!data) break;
                delete this.game.archive[key];

                new DiscardCardEffect(this.player, new Denizen(this.game.original, ...data), worldDeckDiscardOptions).do();
            }

            this.suit++;
            if (this.suit > OathSuit.Nomad) this.suit = OathSuit.Discord;
        }

        // Remove cards to the Dispossessed
        const firstDiscard = Object.values(this.game.original.board.regions)[0].discard;
        const firstDiscardOptions = new SearchDiscardOptions(firstDiscard);
        for (const player of Object.values(this.game.original.players)) {
            let discardOptions = firstDiscardOptions;
            if (player === this.player) discardOptions = worldDeckDiscardOptions;
            new DiscardCardGroupEffect(this.player, player.advisers, discardOptions).do();
        }
        for (const region of Object.values(this.game.original.board.regions)) {
            const cards = new DrawFromDeckEffect(this.player, region.discard, region.discard.cards.length).do();
            new DiscardCardGroupEffect(this.player, cards, firstDiscardOptions).do();
        }

        firstDiscard.shuffle(); // TODO: Put this in effect
        for (let i = 0; i < 6; i++) {
            const cards = new DrawFromDeckEffect(this.player, firstDiscard, 1).do();
            if (!cards.length) break;
            const card = cards[0];

            if (!(card instanceof Denizen)) {
                new DiscardCardEffect(this.player, card, worldDeckDiscardOptions).do();
                continue;
            }
            this.game.original.dispossessed.push(card.data);
        }
        const cards = new DrawFromDeckEffect(this.player, firstDiscard, firstDiscard.cards.length).do();
        new DiscardCardGroupEffect(this.player, cards, worldDeckDiscardOptions).do();
        worldDeck.shuffle();

        // Rebuild the World Deck
        const visions: VisionBack[] = [];
        for (let i = worldDeck.cards.length - 1; i >= 0; i--) {
            const card = worldDeck.cards[i];
            if (card instanceof VisionBack) visions.push(worldDeck.cards.splice(i, 1)[0]);
        }

        const topPile = worldDeck.cards.splice(0, 10);
        topPile.push(...visions.splice(0, 2));
        do { shuffleArray(topPile); } while (topPile[0] instanceof VisionBack);
        const middlePile = worldDeck.cards.splice(0, 15);
        middlePile.push(...visions.splice(0, 3));
        shuffleArray(middlePile);

        for (const card of middlePile.reverse()) worldDeck.putCard(card);
        for (const card of topPile.reverse()) worldDeck.putCard(card);
    }
}
