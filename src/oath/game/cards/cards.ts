import { CampaignSeizeSiteAction, RecoverAction } from "../actions/actions";
import { RecoverActionTarget, WithPowers, AtSite, CampaignActionTarget, OwnableObject } from "../interfaces";
import { Region } from "../board";
import { DiscardCardEffect, FlipSecretsEffect, MoveOwnWarbandsEffect, MoveResourcesToTargetEffect, ParentToTargetEffect, PayCostToBankEffect, RevealCardEffect, TakeOwnableObjectEffect } from "../effects";
import { CardRestriction, OathSuit, OathTypeVisionName, PlayerColor, RegionName } from "../enums";
import { Oath } from "../oaths";
import { OathPlayer } from "../player";
import { OathPower } from "../powers/powers";
import { GrandScepterExileCitizen, GrandScepterGrantCitizenship, GrandScepterPeek, GrandScepterRest, GrandScepterSeize } from "../powers/relics";
import { ConspiracyPower } from "../powers/visions";
import { Favor, OathResource, OathResourceType, ResourceCost, ResourcesAndWarbands, Secret } from "../resources";
import { Constructor } from "../utils";
import { CardDeck, DiscardOptions } from "./decks";
import { DenizenData } from "./denizens";
import { FavorBank } from "../banks";


export abstract class OathCard extends ResourcesAndWarbands<string> implements WithPowers {
    name: string;
    facedown: boolean = true;
    seenBy: Set<OathPlayer> = new Set();
    powers: Set<Constructor<OathPower<OathCard>>>;

    constructor(name: string, powers: Iterable<Constructor<OathPower<OathCard>>>) {
        super(name);
        this.name = name;
        this.powers = new Set<Constructor<OathPower<OathCard>>>();
        for (const power of powers) this.powers.add(power);
    }

    abstract get facedownName(): string;
    abstract get discard(): CardDeck<OathCard> | undefined;
    
    reveal() {
        new RevealCardEffect(this.game, undefined, this).do();
        this.facedown = false;
    }
    
    hide() {
        this.facedown = true;
    }
    
    visualName(player?: OathPlayer) {
        return this.facedown && (!player || !this.seenBy.has(player)) ? this.facedownName : this.name;
    }

    returnResources() {
        const amount = this.byClass(Secret).length;
        if (amount) {
            new MoveResourcesToTargetEffect(this.game, this.game.currentPlayer, Secret, amount, this.game.currentPlayer, this).do();
            new FlipSecretsEffect(this.game, this.game.currentPlayer, amount).do();
        }
    }

    abstract accessibleBy(player: OathPlayer): boolean;

    serialize(): Record<string, any> {
        const obj = super.serialize();
        return {
            facedown: this.facedown,
            seenBy: [...this.seenBy].map(e => e.id),
            ...obj
        };
    }
}


export class Site extends OathCard implements CampaignActionTarget {
    region: Region;
    capacity: number;
    startingRelics: number;
    startingResources: Map<typeof OathResource, number>;
    bandits = 1;

    recoverCost: ResourceCost;
    recoverSuit: OathSuit;

    defense = 1;
    force = this;

    constructor(
        region: Region,
        name: string,
        capacity: number,
        powers: Iterable<Constructor<OathPower<Site>>>,
        startingRelics: number = 0,
        recoverCost: ResourceCost = new ResourceCost(),
        recoverSuit: OathSuit = OathSuit.None,
        startingResources: Iterable<[typeof OathResource, number]> = []
    ) {
        super(name, powers);
        this.region = region;
        this.capacity = capacity;
        this.startingRelics = startingRelics;
        this.recoverCost = recoverCost;
        this.recoverSuit = recoverSuit;
        this.startingResources = new Map(startingResources);
    }

    get facedownName(): string { return "Facedown site in " + this.region.name; }
    get discard(): CardDeck<Site> | undefined { return undefined; }
    get denizens() { return this.byClass(Denizen); }
    get relics() { return this.byClass(Relic); }

    get ruler(): OathPlayer | undefined {
        let max = 0, ruler = undefined;
        for (const player of this.game.byClass(OathPlayer)) {
            const amount = this.getWarbandsAmount(player.id);
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
        if (!color) return this.bandits;
        return super.getWarbandsAmount(color);
    }

    reveal(): void {
        super.reveal();
        for (const relic of this.game.relicDeck.draw(this.startingRelics)) this.addChild(relic);
    }

    setupResources(): void {
        for (const [resource, amount] of this.startingResources) this.putResources(resource, amount);
    }

    hide(): void {
        super.hide();
        for (const relic of this.relics) this.game.relicDeck.addChild(relic);
        for (const resource of this.resources) resource.prune();
    }

    inRegion(regionName: RegionName) {
        return this.region.regionName === regionName;
    }

    seize(player: OathPlayer) {
        if (this.ruler) new MoveOwnWarbandsEffect(this.ruler.leader, this, this.ruler).doNext();
        new CampaignSeizeSiteAction(player, this).doNext();
    }

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.capacity = this.capacity;
        obj.recoverCost = this.recoverCost.serialize();
        obj.recoverSuit = this.recoverSuit;
        obj.denizens = [...this.denizens].map(e => e.serialize());
        obj.relics = [...this.relics].map(e => e.serialize());
        return obj;
    }
}

export abstract class OwnableCard extends OathCard implements OwnableObject  {
    get owner() { return this.typedParent(OathPlayer); }
    protected _ruler() { return this.owner; }
    get ruler() { return this._ruler(); }
    set ruler(_ruler: OathPlayer | undefined) { this._ruler = () => _ruler; }
    get facedownName(): string { return (this.owner ? this.owner.name + "'s facedown" : "facedown") + " "; }

    setOwner(player?: OathPlayer): void {
        player?.addChild(this);
    }

    accessibleBy(player: OathPlayer | undefined): boolean {
        return player === this.owner;
    }
}

export class Relic extends OwnableCard implements RecoverActionTarget, CampaignActionTarget, AtSite {
    defense: number;
    get force() { return this.owner; }

    constructor(name: string, defense: number, powers: Iterable<Constructor<OathPower<Relic>>>) {
        super(name, powers);
        this.defense = defense;
    }
    
    get site() { return this.typedParent(Site); }
    get facedownName(): string { return super.facedownName + "relic" + (this.site ? " at " + this.site.name : ""); }
    get discard(): CardDeck<Relic> | undefined { return this.game.relicDeck; }

    canRecover(action: RecoverAction): boolean {
        return !!this.site;
    }

    recover(player: OathPlayer): void {
        if (!this.site) return;
        if (!new PayCostToBankEffect(this.game, player, this.site.recoverCost, this.site.recoverSuit).do())
            throw this.site.recoverCost.cannotPayError;
        
        new TakeOwnableObjectEffect(this.game, player, this).do();
    }

    seize(player: OathPlayer) {
        new TakeOwnableObjectEffect(this.game, player, this).doNext();
    }

    putOnBottom(player: OathPlayer) {
        new DiscardCardEffect(player, this, new DiscardOptions(this.game.relicDeck, true));
    }
}

export class GrandScepter extends Relic {
    seizedThisTurn = false;

    constructor() {
        // TODO: Add allowing peeking for other players
        super("GrandScepter", 5, [GrandScepterSeize, GrandScepterRest, GrandScepterPeek, GrandScepterGrantCitizenship, GrandScepterExileCitizen]);
    }
}

export abstract class WorldCard extends OwnableCard {
    get discard(): CardDeck<WorldCard> | undefined { return this.owner?.discard; }
}

export class Denizen extends WorldCard implements AtSite {
    site?: Site;
    restriction: CardRestriction;
    locked: boolean;
    powers: Set<Constructor<OathPower<Denizen>>>;

    constructor(name: string, suit: OathSuit, powers: Iterable<Constructor<OathPower<Denizen>>>, restriction: CardRestriction = CardRestriction.None, locked: boolean = false) {
        super(name, powers);
        this._suit = suit;
        this.restriction = restriction;
        this.locked = locked;
    }

    protected _ruler() { return super._ruler() || this.site?.ruler };
    protected _suit: OathSuit;
    get suit() { return this.facedown ? OathSuit.None : this._suit; }
    set suit(_suit: OathSuit) { this._suit = _suit; }
    get activelyLocked() { return this.locked && !this.facedown; }
    get facedownName(): string { return super.facedownName + "denizen" + (this.site ? " at " + this.site.name : ""); }
    get data(): DenizenData { return [this._suit, [...this.powers], this.restriction, this.locked]; }
    get discard(): CardDeck<WorldCard> | undefined { return super.discard || this.site && this.game.board.nextRegion(this.site.region)?.discard; }

    accessibleBy(player: OathPlayer): boolean {
        return super.accessibleBy(player) || player.leader === this.site?.ruler || this.site === player.site;
    }

    returnResources(): void {
        super.returnResources();
        const favor = this.getResources(Favor);
        if (favor.length)
            new ParentToTargetEffect(this.game, this.game.currentPlayer, favor, this.game.byClass(FavorBank).byId(this.suit)[0]).do();
    }

    serialize(): Record<string, any> {
        const obj = super.serialize();
        return {
            suit: this._suit,
            restriction: this.restriction,
            locked: this.activelyLocked,
            ...obj
        };
    }
}

export class Edifice extends Denizen {
    restriction = CardRestriction.Site;
    locked = true;
}

export abstract class VisionBack extends WorldCard {
    get facedownName(): string { return super.facedownName + "vision"; }

    serialize(): Record<string, any> {
        const obj = super.serialize();
        return {
            visionBack: true,
            ...obj
        };
    }
}

export class Vision extends VisionBack {
    oath: Oath;

    constructor(oath: Oath) {
        super(`Vision of ${OathTypeVisionName[oath.id]}`, []);
        this.oath = oath;
    }

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.vision = this.oath.id;
        return obj;
    }
}

export class Conspiracy extends VisionBack {
    constructor() {
        super("Conspiracy", [ConspiracyPower]);
    }
}
