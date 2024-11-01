import { ChooseSuitsAction, RecoverAction, RecoverBannerPitchAction } from "./actions/actions";
import { RecoverActionTarget, CampaignActionTarget, WithPowers, OwnableObject } from "./interfaces";
import { TakeOwnableObjectEffect, SetPeoplesFavorMobState, ParentToTargetEffect, UnparentEffect, BurnResourcesEffect, MoveResourcesToTargetEffect } from "./effects";
import { OathSuit, OathSuitName } from "./enums";
import { OathPlayer } from "./player";
import { PeoplesFavorSearch, PeoplesFavorWake, DarkestSecretPower } from "./powers/banners";
import { OathPower } from "./powers/powers";
import { Constructor } from "./utils";
import { Favor, OathResourceType, ResourcesAndWarbands, Secret } from "./resources";

export abstract class ResourceBank<U = any> extends ResourcesAndWarbands<U> {
    type: OathResourceType;

    get amount() { return this.byClass(this.type).length; }

    get(amount: number) {
        return this.byClass(this.type).max(amount);
    }
}

export class FavorBank extends ResourceBank<OathSuit> {
    name: string;
    type = Favor;

    constructor(id: OathSuit, startingAmount: number) {
        super(id);
        this.name = OathSuitName[id] + " Bank";
        this.putResources(Favor, startingAmount);
    }
}

export abstract class Banner extends ResourceBank<string> implements RecoverActionTarget, CampaignActionTarget, WithPowers, OwnableObject {
    name: string;
    powers: Set<Constructor<OathPower<Banner>>>;
    min = 1;

    get owner() { return this.typedParent(OathPlayer); }
    get defense() { return this.amount; }
    get force() { return this.owner; }

    setOwner(player?: OathPlayer): void {
        player?.addChild(this);
    }

    canRecover(action: RecoverAction): boolean {
        return action.player.getResources(this.type).length > this.amount;
    }

    recover(player: OathPlayer): void {
        new RecoverBannerPitchAction(player, this).doNext();
    }

    finishRecovery(player: OathPlayer, amount: number): void {
        // Banner-specific logic
        new ParentToTargetEffect(this.game, player, this.getResources(this.type, amount)).doNext();
        this.handleRecovery(player);
        new TakeOwnableObjectEffect(this.game, player, this).do();
    }

    seize(player: OathPlayer) {
        new TakeOwnableObjectEffect(this.game, player, this).doNext();
        new BurnResourcesEffect(this.game, player, this.getResources(this.type, 2)).doNext();
    }

    abstract handleRecovery(player: OathPlayer): void;
}

export class PeoplesFavor extends Banner {
    name = "PeoplesFavor";
    type = Favor;
    powers = new Set([PeoplesFavorSearch, PeoplesFavorWake]);
    isMob: boolean;

    constructor() {
        super("peoplesFavor");
        this.putResources(Favor, 1);
    }

    handleRecovery(player: OathPlayer) {
        new SetPeoplesFavorMobState(this.game, player, false).do();
        new ChooseSuitsAction(
            player, "Choose where to start returning the favor (" + this.amount + ")",
            (suits: OathSuit[]) => {
                let suit = suits[0];
                if (suit === undefined) return;

                let amount = this.amount;
                while (amount > 0) {
                    const bank = this.game.byClass(FavorBank).byId(suit)[0];
                    if (bank) {
                        new MoveResourcesToTargetEffect(this.game, player, bank.original.type, 1, bank.original).do();
                        amount--;
                    }
                    if (++suit > OathSuit.Nomad) suit = OathSuit.Discord;
                }
            }
        ).doNext();
    }

    serialize(): Record<string, any> {
        const obj = super.serialize();
        return {
            isMob: this.isMob,
            ...obj
        };
    }
}

export class DarkestSecret extends Banner {
    name = "DarkestSecret";
    type = Secret;
    powers = new Set([DarkestSecretPower]);

    constructor() {
        super("darkestSecret");
        this.putResources(Secret, 1);
    }

    canRecover(action: RecoverAction): boolean {
        if (!super.canRecover(action)) return false;
        if (!this.owner || this.owner === action.player) return true;

        for (const denizen of this.owner.site.denizens) {
            if (this.owner.suitAdviserCount(denizen.suit) === 0) {
                return true;
            }
        }

        return false;
    }

    handleRecovery(player: OathPlayer) {
        new MoveResourcesToTargetEffect(this.game, player, this.type, 1, this).doNext();
        if (this.owner) new MoveResourcesToTargetEffect(this.game, this.owner, this.type, this.amount - 1, this).doNext();
    }
}
