import type { RecoverAction } from "../actions";
import type { RecoverActionTarget, CampaignActionTarget, WithPowers, OwnableObject } from "./interfaces";
import { OathSuit } from "../enums";
import { Constructor, isEnumKey } from "../utils";
import { OathPlayer } from "./player";
import type { OathResource, OathResourceType } from "./resources";
import { Favor, Secret } from "./resources";
import { Container } from "./gameObject";
import type { BannerPowerName } from "../powers/classIndex";

export class FavorBank extends Container<Favor, OathSuit> {
    declare readonly id: keyof typeof OathSuit;
    readonly type = "favorBank";
    declare cls: typeof Favor;

    constructor(id: keyof typeof OathSuit) {
        if (!isEnumKey(id, OathSuit)) throw TypeError(`${id} is not a valid suit`);
        super(id, Favor);
    }

    get name() { return `${this.id}Bank`; }
    get key() { return OathSuit[this.id]; }
}

export abstract class Banner<T extends OathResource = OathResource> extends Container<T, string> implements OwnableObject, RecoverActionTarget, CampaignActionTarget, WithPowers {
    readonly type = "banner";
    powers: Set<BannerPowerName>;
    active = true;
    min = 1;

    get key() { return this.id; }
    get owner() { return this.typedParent(OathPlayer); }
    get defense() { return this.amount; }
    get force() { return this.owner; }

    constructor(id: string, cls: Constructor<T>) {
        super(id, cls);
        this.powers.add("BannerRecover");
        this.powers.add("BannerSeize");
    }

    setOwner(player?: OathPlayer): void {
        player?.addChild(this);
    }

    canRecover(action: RecoverAction): boolean {
        return action.player.byClass(this.cls).length > this.amount;
    }
}

export class PeoplesFavor extends Banner<Favor> {
    declare readonly id: "PeoplesFavor";
    name = "PeoplesFavor";
    powers = new Set<BannerPowerName>(["PeoplesFavorSearch" ,"PeoplesFavorWake"]);
    declare cls: typeof Favor;
    isMob: boolean;

    constructor() {
        super("PeoplesFavor", Favor);
    }

    // handleRecovery(player: OathPlayer) {
    //     let amount = this.amount;
    //     new SetPeoplesFavorMobState(this.game, player, false).doNext();
    //     new ChooseSuitsAction(
    //         player, "Choose where to start returning the favor (" + amount + ")",
    //         (suits: OathSuit[]) => {
    //             let suit = suits[0];
    //             if (suit === undefined) return;

    //             while (amount > 0) {
    //                 const bank = this.game.byClass(FavorBank).byKey(suit)[0];
    //                 if (bank) {
    //                     new TransferResourcesEffect(this.game, new ResourceTransferContext(player, this, new ResourceCost([[bank.cls, 1]]), bank, this)).doNext();
    //                     amount--;
    //                 }
    //                 if (++suit > OathSuit.Nomad) suit = OathSuit.Discord;
    //             }
    //         }
    //     ).doNext();
    // }

    liteSerialize() {
        return {
            ...super.liteSerialize(),
            isMob: this.isMob
        };
    }

    parse(obj: ReturnType<this["liteSerialize"]>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.isMob = obj.isMob;
    }
}

export class DarkestSecret extends Banner<Secret> {
    declare readonly id: "DarkestSecret";
    name = "DarkestSecret";
    powers = new Set<BannerPowerName>(["DarkestSecretPower"]);
    declare cls: typeof Secret;

    constructor() {
        super("DarkestSecret", Secret);
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

    // handleRecovery(player: OathPlayer) {
    //     new TransferResourcesEffect(this.game, new ResourceTransferContext(player, this, new ResourceCost([[this.cls, 1]]), player, this)).doNext();
    //     if (this.owner)
    //         new TransferResourcesEffect(this.game, new ResourceTransferContext(this.owner, this, new ResourceCost([[this.cls, this.amount - 1]]), this)).doNext();
    // }
}
