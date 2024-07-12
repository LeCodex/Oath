import { CampaignActionTarget, PeoplesFavorReturnAction, RecoverAction, RecoverActionTarget, RecoverBannerPitchAction } from "./actions";
import { AddActionToStackEffect, PutResourcesIntoBankEffect, SetPeoplesFavorMobState, TakeOwnableObjectEffect, TakeResourcesFromBankEffect } from "./effects";
import { OathResource } from "./enums"
import { OathGame, OathGameObject } from "./game";
import { OwnableObject } from "./player";
import { OathPlayer } from "./player";
import { DarkestSecretPower as DarkestSecretSearch, OathPower, PeoplesFavorSearch, PeoplesFavorWake } from "./power";

export abstract class ResourceBank extends OathGameObject {
    type: OathResource;
    amount: number;

    constructor(game: OathGame, amount: number = 0) {
        super(game);
        this.amount = amount;
    }

    put(amount: number): number {
        return this.amount += amount;
    }

    take(amount: number = Infinity): number {
        const oldAmount = this.amount;
        const newAmount = Math.max(this.amount - amount, 0);
        const diff = oldAmount - newAmount;

        this.amount -= diff;
        return diff;
    }

    moveTo(other: ResourceBank, amount: number = Infinity): number {
        const amountMoved = this.take(this.amount);
        other.put(amountMoved);
        return amountMoved;
    }
}

export class FavorBank extends ResourceBank {
    static type = OathResource.Favor;
}

export abstract class Banner extends ResourceBank implements OwnableObject, RecoverActionTarget, CampaignActionTarget {
    name: string
    owner?: OathPlayer;
    powers: Constructor<OathPower<Banner>>[];

    get defense() { return this.amount; }
    pawnMustBeAtSite = true;

    setOwner(newOwner?: OathPlayer) {
        if (this.owner) this.owner.removeBanner(this);

        this.owner = newOwner;
        if (newOwner) newOwner.addBanner(this);
    }

    canRecover(action: RecoverAction): boolean {
        return action.data.getResources(this.type) > this.amount;
    }

    recover(player: OathPlayer): void {
        new TakeOwnableObjectEffect(this.game, player.data, this).do();
        new AddActionToStackEffect(new RecoverBannerPitchAction(player.data, this)).do();
    }
    
    finishRecovery(amount: number): void {
        if (!this.owner) return;

        // Banner-specific logic
        this.handleRecovery(this.owner);
        new PutResourcesIntoBankEffect(this.game, this.owner?.data, this, amount).do();
    }

    seize(player: OathPlayer) {
        new TakeOwnableObjectEffect(this.game, player.data, this).do();
        this.amount = Math.max(1, this.amount - 2);
    }

    abstract handleRecovery(player: OathPlayer): void;
}

export class PeoplesFavor extends Banner {
    name = "People's Favor";
    type = OathResource.Favor;
    powers = [PeoplesFavorSearch, PeoplesFavorWake];
    isMob: boolean;

    handleRecovery(player: OathPlayer) {
        new SetPeoplesFavorMobState(this.game, player.data, this, false).do();
        new AddActionToStackEffect(new PeoplesFavorReturnAction(player.data, this.take())).do();
    }
}

export class DarkestSecret extends Banner {
    name = "Darkest Secret";
    type = OathResource.Secret;
    powers = [DarkestSecretSearch];

    canRecover(action: RecoverAction): boolean {
        if (!super.canRecover(action)) return false;
        if (!this.owner || this.owner === action.player) return true;

        for (const denizen of this.owner.data.site.denizens) {
            if (this.owner.data.adviserSuitCount(denizen.suit) === 0) {
                return true;
            }
        }

        return false;
    }

    handleRecovery(player: OathPlayer) {
        new TakeResourcesFromBankEffect(this.game, player.data, this, 1).do();
        if (this.owner) new TakeResourcesFromBankEffect(this.game, this.owner.data, this, Infinity).do();
    }
}


export class ResourcesAndWarbandsData<T extends ResourcesAndWarbands> extends InternalData<T> {
    resources = new Map<OathResource, number>();
    warbands = new Map<OathPlayer, number>();
    
    get empty(): boolean {
        for (const amount of this.resources.values()) if (amount) return false;
        return true;
    }

    getResources(resource: OathResource): number {
        return this.resources.get(resource) || 0;
    }
    
    getWarbands(player: OathPlayer): number {
        return this.warbands.get(player) || 0;
    }
}

export abstract class ResourcesAndWarbands extends OathGameObject {
    data: ResourcesAndWarbandsData<any> = new ResourcesAndWarbandsData(this);

    putResources(resource: OathResource, amount: number): number {
        const newAmount = this.data.getResources(resource) + amount;
        this.data.resources.set(resource, newAmount);
        return newAmount;
    }
    
    putResourcesIntoBank(bank: ResourceBank | undefined, amount: number = Infinity): number {
        if (!bank) return 0;
        const numberMoved = this.takeResources(bank.type, amount);
        bank.put(numberMoved);
        return numberMoved;
    }

    takeResources(resource: OathResource, amount: number = Infinity): number {
        const oldAmount = (this.data.resources.get(resource) || 0);
        const newAmount = Math.max(oldAmount - amount, 0);
        this.data.resources.set(resource, newAmount);
        return oldAmount - newAmount;
    }

    takeResourcesFromBank(bank: ResourceBank | undefined, amount: number = Infinity): number {
        if (!bank) return 0;
        const numberMoved = bank.take(amount);
        this.putResources(bank.type, numberMoved);
        return numberMoved;
    }

    moveResourcesTo(resource: OathResource, target: ResourcesAndWarbands | undefined, amount: number = Infinity, exact: boolean = false): number {
        if (exact && this.data.getResources(resource) < amount) return 0;
        const numberMoved = this.takeResources(resource, amount);
        if (target) target.putResources(resource, numberMoved);
        return numberMoved;
    }

    putWarbands(player: OathPlayer, amount: number): number {
        const newAmount = this.data.getWarbands(player) + amount;
        this.data.warbands.set(player, newAmount);
        return newAmount;
    }

    takeWarbands(player: OathPlayer, amount: number = Infinity): number {
        const oldAmount = (this.data.warbands.get(player) || 0);
        const newAmount = Math.max(oldAmount - amount, 0);
        this.data.warbands.set(player, newAmount);
        return oldAmount - newAmount;
    }

    moveWarbandsTo(player: OathPlayer, target: ResourcesAndWarbands, amount: number = Infinity): number {
        const numberMoved = this.takeWarbands(player, amount);
        target.putWarbands(player, numberMoved);
        return numberMoved;
    }
}

export class ResourceCost {
    placedResources: Map<OathResource, number>;
    burntResources: Map<OathResource, number>;

    constructor(placedResources: Iterable<[OathResource, number]> = [], burntResources: Iterable<[OathResource, number]> = []) {
        this.placedResources = new Map(placedResources);
        this.burntResources = new Map(burntResources);
    }

    get totalResources(): Map<OathResource, number> {
        const total = new Map<OathResource, number>();
        for (const [resource, amount] of this.placedResources) total.set(resource, amount);
        for (const [resource, amount] of this.burntResources) total.set(resource, (total.get(resource) || 0) + amount);
        return total;
    }

    get free(): boolean {
        for (const amount of this.placedResources.values()) if (amount) return false;
        for (const amount of this.burntResources.values()) if (amount) return false;
        return true;
    }

    add(other: ResourceCost) {
        for (const [resource, amount] of other.placedResources) this.placedResources.set(resource, (this.placedResources.get(resource) || 0) + amount);
        for (const [resource, amount] of other.burntResources) this.burntResources.set(resource, (this.burntResources.get(resource) || 0) + amount);
    }
}