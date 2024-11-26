import { ChooseSuitsAction, RecoverAction, RecoverBannerPitchAction } from "./actions/actions";
import { RecoverActionTarget, CampaignActionTarget, WithPowers, OwnableObject } from "./interfaces";
import { TakeOwnableObjectEffect, SetPeoplesFavorMobState, ParentToTargetEffect, UnparentEffect, BurnResourcesEffect, MoveResourcesToTargetEffect } from "./actions/effects";
import { isEnumKey, OathSuit } from "./enums";
import { OathPlayer } from "./player";
import { PeoplesFavorSearch, PeoplesFavorWake, DarkestSecretPower } from "./powers/banners";
import { OathPower } from "./powers/powers";
import { Constructor } from "./utils";
import { Favor, OathResourceType, ResourcesAndWarbands, Secret } from "./resources";

export abstract class ResourceBank<U = any> extends ResourcesAndWarbands<U> {
    resourceType: OathResourceType;

    get amount() { return this.byClass(this.resourceType).length; }

    get(amount: number) {
        return this.byClass(this.resourceType).max(amount);
    }
}

export class FavorBank extends ResourceBank<OathSuit> {
    id: keyof typeof OathSuit;
    type = "favorBank";
    name: string;
    resourceType = Favor;

    constructor(id: keyof typeof OathSuit) {
        if (!isEnumKey(id, OathSuit)) throw TypeError(`${id} is not a valid suit`);
        super(id);
        this.name = id + " Bank";
    }

    get key() { return OathSuit[this.id]; }
}

export abstract class Banner extends ResourceBank<string> implements RecoverActionTarget, CampaignActionTarget, WithPowers, OwnableObject {
    type = "banner";
    name: string;
    powers: Set<Constructor<OathPower<Banner>>>;
    active = true;
    min = 1;

    get key() { return this.id; }
    get owner() { return this.typedParent(OathPlayer); }
    get defense() { return this.amount; }
    get force() { return this.owner; }

    setOwner(player?: OathPlayer): void {
        player?.addChild(this);
    }

    canRecover(action: RecoverAction): boolean {
        return action.player.byClass(this.resourceType).length > this.amount;
    }

    recover(player: OathPlayer): void {
        new RecoverBannerPitchAction(player, this).doNext();
    }

    finishRecovery(player: OathPlayer, amount: number): void {
        // Banner-specific logic
        new ParentToTargetEffect(this.game, player, this.byClass(this.resourceType).max(amount), this).doNext();
        this.handleRecovery(player);
        new TakeOwnableObjectEffect(this.game, player, this).doNext();
    }

    seize(player: OathPlayer) {
        new TakeOwnableObjectEffect(this.game, player, this).doNext();
        new BurnResourcesEffect(this.game, player, this.resourceType, 2, this).doNext();
    }

    abstract handleRecovery(player: OathPlayer): void;
}

export class PeoplesFavor extends Banner {
    name = "PeoplesFavor";
    resourceType = Favor;
    powers = new Set([PeoplesFavorSearch, PeoplesFavorWake]);
    isMob: boolean;

    constructor() {
        super("peoplesFavor");
    }

    handleRecovery(player: OathPlayer) {
        new SetPeoplesFavorMobState(this.game, player, false).doNext();
        new ChooseSuitsAction(
            player, "Choose where to start returning the favor (" + this.amount + ")",
            (suits: OathSuit[]) => {
                let suit = suits[0];
                if (suit === undefined) return;

                let amount = this.amount;
                while (amount > 0) {
                    const bank = this.game.byClass(FavorBank).byKey(suit)[0];
                    if (bank) {
                        new MoveResourcesToTargetEffect(this.game, player, bank.resourceType, 1, bank).doNext();
                        amount--;
                    }
                    if (++suit > OathSuit.Nomad) suit = OathSuit.Discord;
                }
            }
        ).doNext();
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            isMob: this.isMob
        };
    }

    parse(obj: Record<string, any>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.isMob = obj.isMob;
    }
}

export class DarkestSecret extends Banner {
    name = "DarkestSecret";
    resourceType = Secret;
    powers = new Set([DarkestSecretPower]);

    constructor() {
        super("darkestSecret");
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
        new MoveResourcesToTargetEffect(this.game, player, this.resourceType, 1, this).doNext();
        if (this.owner) new MoveResourcesToTargetEffect(this.game, this.owner, this.resourceType, this.amount - 1, this).doNext();
    }
}
