import { SearchableDeck } from "../cards/decks";
import { OathPlayer } from "../player";
import { RecoverAction } from "./major";

export class SearchDiscardOptions {
    discard: SearchableDeck;
    onBottom: boolean;
    ignoreLocked: boolean;

    constructor(discard: SearchableDeck, onBottom: boolean = false, ignoreLocked: boolean = false) {
        this.discard = discard;
        this.onBottom = onBottom;
        this.ignoreLocked = ignoreLocked;
    }
}

export interface RecoverActionTarget {
    canRecover(action: RecoverAction): boolean;
    recover(player: OathPlayer): void;
}

export interface CampaignActionTarget {
    defense: number;
    pawnMustBeAtSite: boolean;

    seize(player: OathPlayer): void;
}

