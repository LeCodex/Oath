import type { RecoverAction } from "../actions";
import type { RecoverActionTarget, WithPowers, AtSite, CampaignActionTarget, OwnableObject, HiddenInformation } from "./interfaces";
import { Region } from "./map";
import type { PlayerColor, RegionKey } from "../enums";
import { CardRestriction, OathSuit, OathType, OathTypeVisionName } from "../enums";
import { OathPlayer } from "./player";
import type { OathResource} from "./resources";
import { ResourcesAndWarbands } from "./resources";
import { ResourceCost } from "../costs";
import type { CardDeck, Discard, RelicDeck } from "./decks";
import type { DenizenName } from "../cards/denizens";
import { denizenData } from "../cards/denizens";
import type { SiteName } from "../cards/sites";
import { sitesData } from "../cards/sites";
import type { RelicName } from "../cards/relics";
import { relicsData } from "../cards/relics";
import type { CardPowerName, DenizenPowerName, RelicPowerName, SitePowerName, VisionPowerName } from "../powers/classIndex";
import { Oath } from "./oaths";


export abstract class OathCard extends ResourcesAndWarbands<string> implements HiddenInformation, WithPowers {
    facedown: boolean = true;
    seenBy: Set<OathPlayer> = new Set();
    powers: Set<CardPowerName>;

    get key() { return this.id; }
    get name() { return this.id; }
    get active(): boolean { return !this.facedown; }

    constructor(id: string, powers: Iterable<CardPowerName>) {
        super(id);
        this.powers = new Set(powers);
    }

    abstract get facedownName(): string;
    abstract get discard(): CardDeck<OathCard> | undefined;
    
    turnFaceup() {
        // new RevealCardEffect(this.game, undefined, this).doNext();
        this.facedown = false;
    }
    
    turnFacedown() {
        this.facedown = true;
    }
    
    visualName(player?: OathPlayer) {
        return this.facedown && (!player || !this.seenBy.has(player)) ? this.facedownName : this.name;
    }

    abstract accessibleBy(player: OathPlayer): boolean;

    liteSerialize() {
        const obj = {
            ...super.liteSerialize(),
            facedown: this.facedown,
            seenBy: [...this.seenBy].map((e) => e.key).toSorted() as number[] | undefined
        };
        if (obj.seenBy?.length === 0) delete obj.seenBy;
        return obj;
    }

    parse(obj: ReturnType<this["liteSerialize"]>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.facedown = obj.facedown;
        this.seenBy = new Set(obj.seenBy ? this.game.players.filter((e) => obj.seenBy?.includes(e.key)) : []);
    }
}


export class Site extends OathCard implements CampaignActionTarget {
    declare readonly id: SiteName;
    readonly type = "site";
    declare powers: Set<SitePowerName>;
    capacity: number;
    startingRelics: number;
    startingResources: Map<typeof OathResource, number>;
    bandits = 1;

    recoverCost: ResourceCost;
    recoverSuit: OathSuit;

    defense = 1;
    force = this;

    constructor(id: SiteName) {
        const data = sitesData[id];
        if (!data) throw TypeError(`${id} is not a valid Site id`);
        super(id, data[1]);
        this.capacity = data[0];
        this.startingRelics = data[2] ?? 0;
        this.recoverCost = data[3] ?? new ResourceCost();
        this.recoverSuit = data[4] ?? OathSuit.None;
        this.startingResources = new Map(data[5]);
    }

    get region() { return this.typedParent(Region); }
    get facedownName(): string { return "Facedown site in " + this.region?.name; }
    get discard(): CardDeck<Site> | undefined { return undefined; }
    get denizens() { return this.byClass(Denizen); }
    get relics() { return this.byClass(Relic); }

    get ruler(): OathPlayer | undefined {
        let max = 0, ruler = undefined;
        for (const player of this.game.players) {
            const amount = this.getWarbandsAmount(player.board.key);
            if (amount > max) {
                max = amount;
                ruler = player;
            } else if (amount === max) {
                ruler = undefined;
            }
        }

        return ruler;
    }

    accessibleBy(player: OathPlayer): boolean {
        return player.site === this || player.leader === this.ruler;
    }

    getWarbandsAmount(color?: PlayerColor): number {
        if (color === undefined) return this.bandits;
        return super.getWarbandsAmount(color);
    }

    turnFaceup(): void {
        super.turnFaceup();
        for (const relic of this.game.relicDeck.draw(this.startingRelics)) this.addChild(relic);
        this.setupResources();
    }

    setupResources(): void {
        for (const [resource, amount] of this.startingResources) resource.putOn(this, amount);
    }

    turnFacedown(): void {
        super.turnFacedown();
        for (const relic of this.relics) this.game.relicDeck.addChild(relic);
        for (const resource of this.resources) resource.prune();
    }

    inRegion(regionKey: RegionKey) {
        return this.region?.key === regionKey;
    }

    constSerialize(): Record<`_${string}`, any> {
        return {
            ...super.constSerialize(),
            _capacity: this.capacity,
            _recoverCost: this.recoverCost.serialize(),
            _recoverSuit: this.recoverSuit
        };
    }
}

export abstract class OwnableCard extends OathCard implements OwnableObject  {
    get owner() { return this.typedParent(OathPlayer); }
    protected _ruler() { return this.owner; }
    get ruler() { return this._ruler(); }
    set ruler(_ruler: OathPlayer | undefined) { this._ruler = () => _ruler; }
    get facedownName(): string { return `${this.owner ? this.owner.name + "'s facedown" : "Facedown"} `; }

    setOwner(player?: OathPlayer): void {
        player?.addChild(this);
    }

    accessibleBy(player: OathPlayer | undefined): boolean {
        return player === this.owner;
    }
}

export class Relic extends OwnableCard implements RecoverActionTarget, CampaignActionTarget, AtSite {
    declare readonly id: RelicName;
    readonly type = "relic";
    declare powers: Set<RelicPowerName>;
    defense: number;
    get force() { return this.owner; }

    constructor(id: RelicName) {
        const data = relicsData[id];
        if (!data) throw TypeError(`${id} is not a valid Relic id`);
        super(id, data[1]);
        this.defense = data[0];
    }
    
    get site() { return this.typedParent(Site); }
    get facedownName(): string { return super.facedownName + "relic" + (this.site ? " at " + this.site.name : ""); }
    get discard(): RelicDeck | undefined { return this.game.relicDeck; }

    canRecover(action: RecoverAction): boolean {
        return !!this.site;
    }
}
export class GrandScepter extends Relic {
    declare readonly id: "GrandScepter";

    constructor() {
        super("GrandScepter");
    }
}

export abstract class WorldCard extends OwnableCard {
    get discard(): Discard | undefined { return this.owner?.discard; }
}

export class Denizen extends WorldCard implements AtSite {
    declare readonly id: DenizenName;
    readonly type = "denizen";
    declare powers: Set<DenizenPowerName>;
    restriction: CardRestriction;
    locked: boolean;

    constructor(id: DenizenName) {
        const data = denizenData[id];
        if (!data) throw TypeError(`${id} is not a valid Denizen id`);
        super(id, data[1]);
        this._suit = data[0];
        this.restriction = data[2] ?? CardRestriction.None;
        this.locked = data[3] ?? false;
    }

    get site() { return this.typedParent(Site); }
    protected _ruler() { return super._ruler() ?? this.site?.ruler };
    protected _suit: OathSuit;
    get suit() { return this.facedown ? OathSuit.None : this._suit; }
    set suit(_suit: OathSuit) { this._suit = _suit; }
    get activelyLocked() { return this.locked && !this.facedown; }
    get facedownName(): string { return super.facedownName + "denizen" + (this.site ? " at " + this.site.name : ""); }
    get discard(): Discard | undefined { return super.discard || this.site && this.game.map.nextRegion(this.site.region)?.discard; }

    accessibleBy(player: OathPlayer): boolean {
        return super.accessibleBy(player) || player.leader === this.site?.ruler || this.site === player.site;
    }

    // returnResources(): void {
    //     super.returnResources();
    //     const favor = this.byClass(Favor);
    //     if (favor.length)
    //         new ParentToTargetEffect(this.game, this.game.currentPlayer, favor, this.game.byClass(FavorBank).byKey(this.suit)[0]).doNext();
    // }

    constSerialize(): Record<`_${string}`, any> {
        return {
            ...super.constSerialize(),
            _suit: OathSuit[this._suit],
            _restriction: this.restriction,
            _locked: this.activelyLocked
        };
    }
}

export class Edifice extends Denizen {
    restriction = CardRestriction.Site;
    locked = true;
}

export abstract class VisionBack extends WorldCard {
    readonly type = "vision";
    declare powers: Set<VisionPowerName>;

    constructor(id: string, powers: Iterable<VisionPowerName>) {
        super(id, powers);
    }

    get facedownName(): string { return super.facedownName + "vision"; }
}

export class Vision extends VisionBack {
    declare readonly id: keyof typeof OathType;
    oath: Oath;

    constructor(id: keyof typeof OathType) {
        super(id, []);
        this.oath = new Oath(this.game, OathType[id]);
    }

    get name() { return `VisionOf${this.key}` }
    get key() { return OathTypeVisionName[this.id]; }
}

export class Conspiracy extends VisionBack {
    declare readonly id: "Conspiracy";

    constructor() {
        super("Conspiracy", ["ConspiracyWhenPlayed"]);
    }
}
