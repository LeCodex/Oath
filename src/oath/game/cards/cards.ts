import { InvalidActionResolution, CampaignSeizeSiteAction, RecoverAction } from "../actions/actions";
import { RecoverActionTarget, WithPowers, AtSite, OwnableObject, CampaignActionTarget } from "../interfaces";
import { Region } from "../board";
import { DiscardCardEffect, FlipSecretsEffect, MoveOwnWarbandsEffect, MoveResourcesToTargetEffect, PayCostToBankEffect, PutResourcesIntoBankEffect, TakeOwnableObjectEffect } from "../effects";
import { CardRestriction, OathResource, OathSuit, OathTypeVisionName, RegionName } from "../enums";
import { OathGame } from "../game";
import { Oath } from "../oaths";
import { OathPlayer } from "../player";
import { OathPower } from "../powers/powers";
import { GrandScepterExileCitizen, GrandScepterGrantCitizenship, GrandScepterPeek, GrandScepterRest, GrandScepterSeize } from "../powers/relics";
import { ConspiracyPower } from "../powers/visions";
import { ResourceCost, ResourcesAndWarbands } from "../resources";
import { Constructor } from "../utils";
import { DiscardOptions } from "./decks";
import { DenizenData } from "./denizens";


export abstract class OathCard extends ResourcesAndWarbands implements WithPowers {
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

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.name = this.name;
        obj.facedown = this.facedown;
        obj.seenBy = [...this.seenBy].map(e => e.color);
        return obj;
    }
}


export class Site extends OathCard implements CampaignActionTarget {
    region: Region;
    capacity: number;
    startingRelics: number;
    startingResources: Map<OathResource, number>;
    bandits = 1;

    recoverCost: ResourceCost;
    recoverSuit: OathSuit;

    denizens = new Set<Denizen>();
    relics = new Set<Relic>();

    defense = 1;
    force = this;

    constructor(
        game: OathGame,
        region: Region,
        name: string,
        powers: Iterable<Constructor<OathPower<Site>>>,
        capacity: number,
        startingRelics: number = 0,
        recoverCost: ResourceCost = new ResourceCost(),
        recoverSuit: OathSuit = OathSuit.None,
        startingResources: Iterable<[OathResource, number]> = []
    ) {
        super(game, name, powers);
        this.region = region;
        this.capacity = capacity;
        this.startingRelics = startingRelics;
        this.recoverCost = recoverCost;
        this.recoverSuit = recoverSuit;
        this.startingResources = new Map(startingResources);
    }

    get ruler(): OathPlayer | undefined {
        let max = 0, ruler = undefined;
        for (const [player, number] of this.warbands) {
            if (number > max) {
                max = number;
                ruler = player;
            } else if (number === max) {
                ruler = undefined;
            }
        }

        return ruler;
    }

    getWarbands(player: OathPlayer | undefined): number {
        if (!player) return this.bandits;
        return super.getWarbands(player);
    }

    reveal(): void {
        super.reveal();
        for (const relic of this.game.relicDeck.draw(this.startingRelics)) relic.putAtSite(this);
    }

    setupResources(): void {
        for (const [resource, amount] of this.startingResources) this.putResources(resource, amount);
    }

    hide(): void {
        super.hide();
        for (const relic of this.relics) { relic.setOwner(undefined); this.game.relicDeck.putCard(relic); }
        for (const [resource, amount] of this.resources) this.takeResources(resource, amount);
    }

    inRegion(regionName: RegionName) {
        return this.region.regionName === regionName;
    }

    addDenizen(card: Denizen) {
        this.denizens.add(card);
    }

    removeDenizen(card: Denizen): Denizen {
        if (this.denizens.delete(card)) card.site = undefined;
        return card;
    }

    addRelic(relic: Relic) {
        this.relics.add(relic);
    }

    removeRelic(relic: Relic): Relic {
        if (this.relics.delete(relic)) relic.site = undefined;
        return relic;
    }

    seize(player: OathPlayer) {
        if (this.ruler) new MoveOwnWarbandsEffect(this.ruler, this, this.ruler).doNext();
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

export abstract class OwnableCard extends OathCard implements OwnableObject {
    owner?: OathPlayer;

    get ruler() { return this.owner; }

    accessibleBy(player: OathPlayer | undefined): boolean {
        return player === this.owner;
    }

    abstract setOwner(newOwner?: OathPlayer): void;

    returnResources() {
        const amount = this.getResources(OathResource.Secret);
        if (amount) {
            new MoveResourcesToTargetEffect(this.game, this.game.currentPlayer, OathResource.Secret, amount, this.game.currentPlayer, this).do();
            new FlipSecretsEffect(this.game, this.game.currentPlayer, amount).do();
        }
    }

    // serialize(): Record<string, any> {
    //     const obj: Record<string, any> = super.serialize();
    //     obj.owner = this.owner?.color;
    //     return obj;
    // }
}

export class Relic extends OwnableCard implements RecoverActionTarget, CampaignActionTarget, AtSite {
    site?: Site;

    defense: number;
    get force() { return this.owner; }

    constructor(game: OathGame, name: string, defense: number, powers: Iterable<Constructor<OathPower<Relic>>>) {
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
    }

    seize(player: OathPlayer) {
        new TakeOwnableObjectEffect(this.game, player, this).doNext();
    }

    putOnBottom(player: OathPlayer) {
        new DiscardCardEffect(player, this, new DiscardOptions(this.game.relicDeck, true));
    }

    // serialize(): Record<string, any> {
    //     const obj: Record<string, any> = super.serialize();
    //     obj.site = this.site?.name;
    //     return obj;
    // }
}

export class GrandScepter extends Relic {
    seizedThisTurn = false;

    constructor(game: OathGame) {
        // TODO: Add allowing peeking for other players
        super(game, "GrandScepter", 5, [GrandScepterSeize, GrandScepterRest, GrandScepterPeek, GrandScepterGrantCitizenship, GrandScepterExileCitizen]);
    }
}

export abstract class WorldCard extends OwnableCard {
    setOwner(newOwner?: OathPlayer): void {
        if (this.owner) this.owner.removeAdviser(this);

        this.owner = newOwner;
        if (newOwner) newOwner.addAdviser(this);
    }
}

export class Denizen extends WorldCard implements AtSite {
    site?: Site;
    restriction: CardRestriction;
    locked: boolean;
    powers: Set<Constructor<OathPower<Denizen>>>;

    protected _suit: OathSuit;
    get suit() { return this.facedown ? OathSuit.None : this._suit; }
    set suit(_suit: OathSuit) { this._suit = _suit; }
    get ruler() { return super.ruler || this.site?.ruler; }
    get activelyLocked() { return this.locked && !this.facedown; }
    get data(): DenizenData { return [this._suit, [...this.powers], this.restriction, this.locked] }

    constructor(game: OathGame, name: string, suit: OathSuit, powers: Iterable<Constructor<OathPower<Denizen>>>, restriction: CardRestriction = CardRestriction.None, locked: boolean = false) {
        super(game, name, powers);
        this._suit = suit;
        this.restriction = restriction;
        this.locked = locked;
    }

    accessibleBy(player: OathPlayer): boolean {
        return super.accessibleBy(player) || player.leader === this.site?.ruler || this.site === player.site;
    }

    setOwner(newOwner?: OathPlayer): void {
        if (this.site) this.site.removeDenizen(this);
        super.setOwner(newOwner);
    }

    putAtSite(newSite: Site): void {
        this.setOwner(undefined);

        this.site = newSite;
        newSite.addDenizen(this);
    }

    returnResources(): void {
        super.returnResources();
        if (this.getResources(OathResource.Favor))
            new PutResourcesIntoBankEffect(this.game, this.game.currentPlayer, this.game.favorBanks.get(this.suit), this.getResources(OathResource.Favor), this).do();
    }

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.suit = this._suit;
        // obj.site = this.site?.name;
        obj.restriction = this.restriction;
        obj.locked = this.activelyLocked;
        return obj;
    }
}

export class Edifice extends Denizen {
    restriction = CardRestriction.Site;
    locked = true;
}

export abstract class VisionBack extends WorldCard {
    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.visionBack = true;
        return obj;
    }
}

export class Vision extends VisionBack {
    oath: Oath;

    constructor(oath: Oath) {
        super(oath.game, `Vision of ${OathTypeVisionName[oath.type]}`, []);
        this.oath = oath;
    }

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.vision = this.oath.type;
        return obj;
    }
}

export class Conspiracy extends VisionBack {
    constructor(game: OathGame) {
        super(game, "Conspiracy", [ConspiracyPower]);
    }
}
