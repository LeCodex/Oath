import { MoveResourcesToTargetEffect } from "../effects/basic";
import { OathResource } from "../enums";
import { OathGame } from "../game";
import { OathPlayer, OwnableObject } from "../player";
import { OathPower } from "../powers/base";
import { ResourcesAndWarbands } from "../resources";
import { Constructor } from "../utils";


export abstract class OathCard extends ResourcesAndWarbands {
    name: string;
    facedown: boolean = true;
    seenBy: Set<OathPlayer> = new Set();
    powers: Set<Constructor<OathPower<OathCard>>>;

    constructor(game: OathGame, name: string, powers: Iterable<Constructor<OathPower<OathCard>>>) {
        super(game);
        this.name = name;
        this.powers = new Set<Constructor<OathPower<OathCard>>>();
        for (const power of powers) this.powers.add(power);
    }

    reveal() {
        this.facedown = false;
    }

    hide() {
        this.facedown = true;
    }

    peek(player: OathPlayer) {
        this.seenBy.add(player);
    }

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.name = this.name;
        obj.facedown = this.facedown;
        obj.seenBy = [...this.seenBy].map(e => e.color);
        return obj;
    }
}

export abstract class OwnableCard extends OathCard implements OwnableObject {
    owner?: OathPlayer;

    get ruler() { return this.owner; }

    accessibleBy(player: OathPlayer | undefined): boolean {
        return player?.leader.original === this.ruler?.original;
    }

    abstract setOwner(newOwner?: OathPlayer): void;

    returnResources() {
        if (this.getResources(OathResource.Secret))
            new MoveResourcesToTargetEffect(this.game, this.game.currentPlayer, OathResource.Secret, this.getResources(OathResource.Secret), this.game.currentPlayer, this).do();
    }

}

export abstract class WorldCard extends OwnableCard {
    setOwner(newOwner?: OathPlayer): void {
        if (this.owner) this.owner.removeAdviser(this);

        this.owner = newOwner;
        if (newOwner) newOwner.addAdviser(this);
    }
}
