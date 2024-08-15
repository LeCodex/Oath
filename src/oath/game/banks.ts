import { ChooseSuitAction, RecoverAction, RecoverBannerPitchAction } from "./actions/actions";
import { RecoverActionTarget, CampaignActionTarget, WithPowers, OwnableObject } from "./interfaces";
import { PutResourcesIntoBankEffect, TakeOwnableObjectEffect, SetPeoplesFavorMobState, TakeResourcesFromBankEffect, MoveBankResourcesEffect } from "./effects";
import { OathResource, OathSuit } from "./enums";
import { OathGame } from "./game";
import { OathGameObject } from "./gameObject";
import { OathPlayer } from "./player";
import { PeoplesFavorSearch, PeoplesFavorWake, DarkestSecretPower } from "./powers/banners";
import { OathPower } from "./powers/powers";
import { Constructor } from "./utils";


export abstract class ResourceBank extends OathGameObject {
    type: OathResource;
    amount: number;
    min = 0;

    constructor(game: OathGame, amount: number = 0) {
        super(game);
        this.amount = Math.max(this.min, amount);
    }

    put(amount: number): number {
        this.amount += amount;
        return this.amount;
    }

    take(amount: number = Infinity): number {
        const oldAmount = this.amount;
        const newAmount = Math.max(this.amount - amount, this.min);
        const diff = oldAmount - newAmount;

        this.amount -= diff;
        return diff;
    }

    moveTo(other: ResourceBank, amount: number = Infinity): number {
        const amountMoved = this.take(amount);
        other.put(amountMoved);
        return amountMoved;
    }

    serialize(): Record<string, any> {
        return {
            amount: this.amount,
            type: this.type
        };
    }
}

export class FavorBank extends ResourceBank {
    type = OathResource.Favor;
}

export abstract class Banner extends ResourceBank implements OwnableObject, RecoverActionTarget, CampaignActionTarget, WithPowers {
    name: string;
    owner?: OathPlayer;
    powers: Set<Constructor<OathPower<Banner>>>;
    min = 1;

    get defense() { return this.amount; }
    get force() { return this.owner; }

    setOwner(newOwner?: OathPlayer) {
        if (this.owner) this.owner.removeBanner(this);
        this.owner = newOwner;
        if (newOwner) newOwner.addBanner(this);
    }

    canRecover(action: RecoverAction): boolean {
        return action.player.getResources(this.type) > this.amount;
    }

    recover(player: OathPlayer): void {
        new RecoverBannerPitchAction(player, this).doNext();
    }

    finishRecovery(player: OathPlayer, amount: number): void {
        // Banner-specific logic
        new PutResourcesIntoBankEffect(this.game, player, this, amount).doNext();
        this.handleRecovery(player);
        new TakeOwnableObjectEffect(this.game, player, this).do();
    }

    seize(player: OathPlayer) {
        new TakeOwnableObjectEffect(this.game, player, this).doNext();
        new TakeResourcesFromBankEffect(this.game, undefined, this, 2).doNext();
    }

    abstract handleRecovery(player: OathPlayer): void;

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.name = this.name;
        obj.owner = this.owner?.color;
        return obj;
    }
}

export class PeoplesFavor extends Banner {
    name = "People's Favor";
    type = OathResource.Favor;
    powers = new Set([PeoplesFavorSearch, PeoplesFavorWake]);
    isMob: boolean;

    handleRecovery(player: OathPlayer) {
        new SetPeoplesFavorMobState(this.game, player, false).do();
        new ChooseSuitAction(
            player, "Choose where to start returning the favor (" + this.amount + ")",
            (suit: OathSuit | undefined) => {
                if (suit === undefined) return;

                let amount = this.amount;
                while (amount > 0) {
                    const bank = this.game.favorBanks.get(suit);
                    if (bank) {
                        new MoveBankResourcesEffect(this.game, player, this, bank.original, 1).do();
                        amount--;
                    }
                    if (++suit > OathSuit.Nomad) suit = OathSuit.Discord;
                }
            }
        ).doNext();
    }

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.isMob = this.isMob;
        return obj;
    }
}

export class DarkestSecret extends Banner {
    name = "Darkest Secret";
    type = OathResource.Secret;
    powers = new Set([DarkestSecretPower]);

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
        new TakeResourcesFromBankEffect(this.game, player, this, 1).doNext();
        if (this.owner) new TakeResourcesFromBankEffect(this.game, this.owner, this, this.amount - 1).doNext();
    }
}
