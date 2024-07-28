import { PutResourcesIntoBankEffect } from "../effects/basic";
import { CardRestriction, OathSuit, OathResource } from "../enums";
import { OathGame } from "../game";
import { OathPlayer } from "../player";
import { OathPower } from "../powers/base";
import { Constructor } from "../utils";
import { WorldCard } from "./base";
import { Site } from "./sites";
import { DenizenData } from "./data/denizens";


export class Denizen extends WorldCard {
    site?: Site;
    restriction: CardRestriction;
    locked: boolean;
    powers: Set<Constructor<OathPower<Denizen>>>;

    protected _suit: OathSuit;
    get suit() { return this.facedown ? OathSuit.None : this._suit; }
    set suit(_suit: OathSuit) { this._suit = _suit; }
    get ruler() { return super.ruler || this.site?.ruler; }
    get activelyLocked() { return this.locked && !this.facedown; }
    get data(): DenizenData { return [this._suit, this.name, [...this.powers], this.restriction, this.locked]; }

    constructor(game: OathGame, suit: OathSuit, name: string, powers: Iterable<Constructor<OathPower<Denizen>>>, restriction: CardRestriction = CardRestriction.None, locked: boolean = false) {
        super(game, name, powers);
        this._suit = suit;
        this.restriction = restriction;
        this.locked = locked;
    }

    accessibleBy(player: OathPlayer): boolean {
        return super.accessibleBy(player) || this.site?.original === player.site.original;
    }

    setOwner(newOwner?: OathPlayer): void {
        if (this.site) this.site.removeDenizen(this);
        super.setOwner(newOwner);
    }

    putAtSite(newSite: Site): void {
        this.setOwner(undefined);

        this.site = newSite;
        newSite.addDenizen(this);
    }

    returnResources(): void {
        super.returnResources();
        if (this.getResources(OathResource.Favor))
            new PutResourcesIntoBankEffect(this.game, this.game.currentPlayer, this.game.favorBanks.get(this.suit), this.getResources(OathResource.Favor), this).do();
    }

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.suit = this.suit;
        // obj.site = this.site?.name;
        obj.restriction = this.restriction;
        obj.locked = this.activelyLocked;
        return obj;
    }
}

export class Edifice extends Denizen {
    restriction = CardRestriction.Site;
    locked = true;
}
