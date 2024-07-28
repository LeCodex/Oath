import { PayCostToBankEffect, TakeOwnableObjectEffect } from "../effects/basic";
import { RecoverAction } from "../actions/major";
import { RecoverActionTarget, CampaignActionTarget } from "../actions/types";
import { OathGame } from "../game";
import { OathPlayer } from "../player";
import { OathPower } from "../powers/base";
import { Constructor, InvalidActionResolution } from "../utils";
import { OwnableCard } from "./base";
import { Site } from "./sites";


export class Relic extends OwnableCard implements RecoverActionTarget, CampaignActionTarget {
    site?: Site;

    defense: number;
    pawnMustBeAtSite = true;

    constructor(game: OathGame, name: string, powers: Iterable<Constructor<OathPower<Relic>>>, defense: number) {
        super(game, name, powers);
        this.defense = defense;
    }

    setOwner(newOwner?: OathPlayer) {
        if (this.owner) this.owner.removeRelic(this);
        if (this.site) this.site.removeRelic(this);

        this.owner = newOwner;
        if (newOwner) newOwner.addRelic(this);
    }

    putAtSite(newSite: Site) {
        this.setOwner(undefined);

        this.site = newSite;
        newSite.addRelic(this);
    }

    canRecover(action: RecoverAction): boolean {
        return !!this.site;
    }

    recover(player: OathPlayer): void {
        if (!this.site) return;
        if (!new PayCostToBankEffect(this.game, player, this.site.recoverCost, this.site.recoverSuit).do()) throw new InvalidActionResolution("Cannot pay recover cost.");

        new TakeOwnableObjectEffect(this.game, player, this).do();
        this.original.facedown = false;
    }

    seize(player: OathPlayer) {
        new TakeOwnableObjectEffect(this.game, player, this).do();
        this.original.facedown = false;
    }

}
