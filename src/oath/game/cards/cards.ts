import { CampaignActionTarget, CampaignSeizeSiteAction, InvalidActionResolution, RecoverAction, RecoverActionTarget } from "../actions";
import { Region } from "../board";
import { AddActionToStackEffect, MoveOwnWarbandsEffect, PayCostToBankEffect, TakeOwnableObjectEffect } from "../effects";
import { CardRestriction, OathResource, OathSuit, OathTypeVisionName, RegionName } from "../enums";
import { OathGame, Oath } from "../game";
import { OathPlayer, OwnableObject } from "../player";
import { ConspiracyPower, OathPower, VisionPower } from "../power";
import { ResourceCost, ResourcesAndWarbands } from "../resources";
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
}


export class Site extends OathCard implements CampaignActionTarget {
    region: Region;
    capacity: number;
    startingRelics: number;
    startingResources: Map<OathResource, number>;
    bandits = 1;

    recoverCost: ResourceCost;
    recoverSuit: OathSuit;

    denizens: Set<Denizen>;
    relics: Set<Relic>;

    defense = 1;
    pawnMustBeAtSite = false;

    constructor(
        game: OathGame,
        name: string, 
        powers: Iterable<Constructor<OathPower<Site>>>,
        capacity: number,
        startingRelics: number = 0,
        recoverCost: ResourceCost = new ResourceCost(),
        recoverSuit: OathSuit = OathSuit.None,
        startingResources: Iterable<[OathResource, number]> = []
    ) {
        super(game, name, powers);
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

    reveal(): void {
        super.reveal();
        for (const relic of this.game.relicDeck.draw(this.startingRelics)) this.addRelic(relic);
        for (const [resource, amount] of this.startingResources) this.putResources(resource, amount);
    }

    hide(): void {
        super.hide();
        for (const relic of this.relics) this.game.relicDeck.putCard(relic);
        for (const [resource, amount] of this.resources) this.takeResources(resource, amount);
    }

    inRegion(regionName: RegionName) {
        return this.region.regionName = regionName;
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
        if (this.ruler) new MoveOwnWarbandsEffect(this.ruler, this, this.ruler).do();
        new CampaignSeizeSiteAction(player, this).doNext();
    }
}

export abstract class OwnableCard extends OathCard implements OwnableObject {
    owner?: OathPlayer;

    get ruler() { return this.owner; }

    accessibleBy(player: OathPlayer | undefined): boolean {
        return player?.leader === this.ruler;
    }

    abstract setOwner(newOwner?: OathPlayer): void;
}

export class Relic extends OwnableCard implements RecoverActionTarget, CampaignActionTarget {
    site?: Site;

    defense: number;
    pawnMustBeAtSite = true;

    constructor(game: OathGame, name: string, powers: Iterable<Constructor<OathPower<Relic>>>, defense: number) {
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
        return action.player.site === this.site;
    }

    recover(player: OathPlayer): void {
        if (!this.site) return;
        if (!new PayCostToBankEffect(this.game, player, this.site.recoverCost, this.site.recoverSuit).do()) throw new InvalidActionResolution("Cannot pay recover cost.");

        new TakeOwnableObjectEffect(this.game, player, this).do();
        this.facedown = false;
    }

    seize(player: OathPlayer) {
        new TakeOwnableObjectEffect(this.game, player, this).do();
        this.facedown = false;
    }
}

export abstract class WorldCard extends OwnableCard {
    setOwner(newOwner?: OathPlayer): void {
        if (this.owner) this.owner.removeAdviser(this);

        this.owner = newOwner;
        if (newOwner) newOwner.addAdviser(this);
    }

    returnResources(): void {
        this.game.currentPlayer.putResources(OathResource.Secret, this.takeResources(OathResource.Secret));
        for (const player of this.warbands.keys()) player.moveWarbandsIntoBagFrom(this);
    }
}

export class Denizen extends WorldCard {
    site?: Site;
    restriction: CardRestriction;
    locked: boolean;

    protected _suit: OathSuit;
    get suit() { return this._suit; }
    set suit(_suit: OathSuit) { this._suit = _suit; }
    get ruler() { return super.ruler || this.site?.ruler; }
    get activelyLocked() { return this.locked && !this.facedown; }

    constructor(game: OathGame, name: string, suit: OathSuit, powers: Iterable<Constructor<OathPower<Denizen>>>, restriction: CardRestriction = CardRestriction.None, locked: boolean = false) {
        super(game, name, powers);
        this._suit = suit;
        this.restriction = restriction;
        this.locked = locked;
    }

    accessibleBy(player: OathPlayer): boolean {
        return super.accessibleBy(player) || this.site === player.site;
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
        this.game.favorBanks.get(this.suit)?.put(this.takeResources(OathResource.Favor));
    }
}

export abstract class Edifice extends Denizen {
    restriction = CardRestriction.Site;
    locked = true;
    ruined: boolean;

    get suit(): OathSuit { return this.ruined ? OathSuit.None : this._suit; }
}

export abstract class VisionBack extends WorldCard { }

export class Vision extends VisionBack {
    oath: Oath;

    constructor(oath: Oath) {
        super(oath.game, `Vision of ${OathTypeVisionName[oath.type]}`, [VisionPower]);
        this.oath = oath;
    }
}

export class Conspiracy extends VisionBack {
    constructor(game: OathGame) {
        super(game, "Conspiracy", [ConspiracyPower]);
    }
}
