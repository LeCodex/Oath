import { CampaignSeizeSiteAction, RecoverAction } from "../actions/actions";
import { RecoverActionTarget, WithPowers, AtSite, CampaignActionTarget, OwnableObject, HiddenInformation } from "../interfaces";
import { Region } from "../map";
import { DiscardCardEffect, FlipSecretsEffect, MoveOwnWarbandsEffect, MoveResourcesToTargetEffect, ParentToTargetEffect, PayCostToBankEffect, RevealCardEffect, TakeOwnableObjectEffect } from "../actions/effects";
import { CardRestriction, OathSuit, OathType, OathTypeVisionName, PlayerColor, RegionKey } from "../enums";
import { Oath } from "../oaths";
import { OathPlayer } from "../player";
import { OathPower } from "../powers/powers";
import { ConspiracyPower } from "../powers/visions";
import { Favor, OathResource, ResourceCost, ResourcesAndWarbands, Secret } from "../resources";
import { Constructor } from "../utils";
import { CardDeck, Discard, DiscardOptions, RelicDeck } from "./decks";
import { denizenData } from "./denizens";
import { FavorBank } from "../banks";
import { sitesData } from "./sites";
import { relicsData } from "./relics";


export abstract class OathCard extends ResourcesAndWarbands<string> implements HiddenInformation, WithPowers {
    facedown: boolean = true;
    seenBy: Set<OathPlayer> = new Set();
    powers: Set<Constructor<OathPower<OathCard>>>;

    get name() { return this.id; }
    get key() { return this.id; }
    get active(): boolean { return !this.facedown; }

    constructor(id: string, powers: Iterable<Constructor<OathPower<OathCard>>>) {
        super(id);
        this.powers = new Set(powers);
    }

    abstract get facedownName(): string;
    abstract get discard(): CardDeck<OathCard> | undefined;
    
    turnFaceup() {
        new RevealCardEffect(this.game, undefined, this).doNext();
        this.facedown = false;
    }
    
    turnFacedown() {
        this.facedown = true;
    }
    
    visualName(player?: OathPlayer) {
        return this.facedown && (!player || !this.seenBy.has(player)) ? this.facedownName : this.name;
    }

    returnResources() {
        const amount = this.byClass(Secret).length;
        if (amount) {
            new MoveResourcesToTargetEffect(this.game, this.game.currentPlayer, Secret, amount, this.game.currentPlayer, this).doNext();
            new FlipSecretsEffect(this.game, this.game.currentPlayer, amount).doNext();
        }
    }

    abstract accessibleBy(player: OathPlayer): boolean;

    liteSerialize() {
        const obj = {
            ...super.liteSerialize(),
            facedown: this.facedown,
            seenBy: [...this.seenBy].map(e => e.key) as number[] | undefined
        };
        if (obj.seenBy?.length === 0) delete obj.seenBy;
        return obj;
    }

    parse(obj: ReturnType<this["liteSerialize"]>, allowCreation?: boolean): void {
        super.parse(obj, allowCreation);
        this.facedown = obj.facedown;
        this.seenBy = new Set(obj.seenBy ? this.game.players.filter(e => obj.seenBy?.includes(e.key)) : []);
    }
}


export class Site extends OathCard implements CampaignActionTarget {
    type = "site";
    capacity: number;
    startingRelics: number;
    startingResources: Map<typeof OathResource, number>;
    bandits = 1;

    recoverCost: ResourceCost;
    recoverSuit: OathSuit;

    defense = 1;
    force = this;

    constructor(id: keyof typeof sitesData) {
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
        return player.site === this || player === this.ruler;
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

    seize(player: OathPlayer) {
        if (this.ruler) new MoveOwnWarbandsEffect(this.ruler.leader, this, this.ruler.board).doNext();
        new CampaignSeizeSiteAction(player, this).doNext();
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
    type = "relic";
    defense: number;
    get force() { return this.owner?.board; }

    constructor(id: keyof typeof relicsData) {
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

    recover(player: OathPlayer): void {
        if (!this.site) return;
        const cost = this.site.recoverCost;
        new PayCostToBankEffect(this.game, player, cost, this.site.recoverSuit).doNext(success => {
            if (!success) throw cost.cannotPayError;
            new TakeOwnableObjectEffect(this.game, player, this).doNext();
        })
    }

    seize(player: OathPlayer) {
        new TakeOwnableObjectEffect(this.game, player, this).doNext();
    }

    putOnBottom(player: OathPlayer) {
        new DiscardCardEffect(player, this, new DiscardOptions(this.game.relicDeck, true)).doNext();
    }
}

export class GrandScepter extends Relic {
    seizedThisTurn = false;

    constructor() {
        super("GrandScepter");
    }
}

export abstract class WorldCard extends OwnableCard {
    get discard(): Discard | undefined { return this.owner?.discard; }
}

export class Denizen extends WorldCard implements AtSite {
    type = "denizen";
    restriction: CardRestriction;
    locked: boolean;
    powers: Set<Constructor<OathPower<Denizen>>>;

    constructor(id: keyof typeof denizenData) {
        const data = denizenData[id];
        if (!data) throw TypeError(`${id} is not a valid Denizen id`);
        super(id, data[1]);
        this._suit = data[0];
        this.restriction = data[2] ?? CardRestriction.None;
        this.locked = data[3] ?? false;
    }

    get site() { return this.typedParent(Site); }
    protected _ruler() { return super._ruler() || this.site?.ruler };
    protected _suit: OathSuit;
    get suit() { return this.facedown ? OathSuit.None : this._suit; }
    set suit(_suit: OathSuit) { this._suit = _suit; }
    get activelyLocked() { return this.locked && !this.facedown; }
    get facedownName(): string { return super.facedownName + "denizen" + (this.site ? " at " + this.site.name : ""); }
    get discard(): Discard | undefined { return super.discard || this.site && this.game.map.nextRegion(this.site.region)?.discard; }

    accessibleBy(player: OathPlayer): boolean {
        return super.accessibleBy(player) || player.leader === this.site?.ruler || this.site === player.site;
    }

    returnResources(): void {
        super.returnResources();
        const favor = this.byClass(Favor);
        if (favor.length)
            new ParentToTargetEffect(this.game, this.game.currentPlayer, favor, this.game.byClass(FavorBank).byKey(this.suit)[0]).doNext();
    }

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
    type = "vision";

    get facedownName(): string { return super.facedownName + "vision"; }
}

export class Vision extends VisionBack {
    readonly id: keyof typeof OathType;
    oath: Oath;

    constructor(id: keyof typeof OathType) {
        super(id, []);
        this.oath = new Oath().setType(OathType[id]);
    }

    get name() { return `VisionOf${this.key}` }
    get key() { return OathTypeVisionName[this.id]; }
}

export class Conspiracy extends VisionBack {
    constructor() {
        super("Conspiracy", [ConspiracyPower]);
    }
}
