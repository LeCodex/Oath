import { CampaignBanishPlayerAction } from "./actions/actions";
import { CampaignActionTarget, AtSite } from "./interfaces";
import { Denizen, OwnableCard, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { Discard } from "./cards/decks";
import { BurnResourcesEffect, FlipSecretsEffect, GainSupplyEffect, MoveResourcesToTargetEffect } from "./effects";
import { OathSuit, PlayerColor } from "./enums";
import { OathWarband, ResourcesAndWarbands, Favor, OathResourceType } from "./resources";
import { Container } from "./gameObject";
import { Banner } from "./banks";
import { Reliquary } from "./reliquary";

export class WarbandsSupply extends Container<OathWarband, PlayerColor> {
    type = "bag";

    constructor(color: PlayerColor) {
        super(color, OathWarband);
    }

    serialize(): Record<string, any> | undefined {
        return undefined;
    }
}

export abstract class OathPlayer extends ResourcesAndWarbands<PlayerColor> implements CampaignActionTarget, AtSite {
    type = "player";
    supply: number = 7;
    site: Site;  // Could be done through parenting, but causes too many issues
    bag: WarbandsSupply;
    
    defense = 2;
    force = this;

    constructor(id: PlayerColor) {
        super(id);
        this.bag = this.addChild(new WarbandsSupply(id));
    }

    get advisers() { return this.byClass(WorldCard); }
    get denizens() { return this.byClass(Denizen); }
    get relics() { return this.byClass(Relic); }
    get banners()  { return this.byClass(Banner); }

    get isImperial(): boolean { return false; }
    get leader(): OathPlayer { return this.isImperial ? this.game.chancellor : this; }
    get discard(): Discard { return this.game.board.nextRegion(this.site.region)?.discard || this.site.region.discard; }
    get ruledSuits(): number { return [0, 1, 2, 3, 4, 5].reduce((a, e) => a + (this.suitRuledCount(e) > 0 ? 1 : 0), 0); }
    get ruledSites(): number { return [...this.game.board.sites()].reduce((a, e) => a + (e.ruler === this ? 1 : 0), 0); }

    getAllResources(type: OathResourceType): number {
        let amount = this.getResources(type).length;
        for (const site of this.game.board.sites())
            for (const denizen of site.denizens)
                amount += denizen.getResources(type).length;

        for (const player of this.game.players) {
            for (const adviser of player.advisers)
                amount += adviser.getResources(type).length;

            for (const relic of player.relics)
                amount += relic.getResources(type).length;
        }

        return amount;
    }

    suitAdviserCount(suit: OathSuit): number {
        let total = 0;
        for (const adviser of this.denizens) if (!adviser.facedown && adviser.suit === suit) total++;
        return total;
    }

    suitRuledCount(suit: OathSuit): number {
        let total = 0;
        for (const site of this.game.board.sites())
            for (const denizen of site.denizens)
                if (this.rules(denizen)) total++;

        return this.suitAdviserCount(suit) + total;
    }

    rules(card: OwnableCard) {
        return card.ruler === this.leader || card.ruler === this;
    }

    enemyWith(player: OathPlayer | undefined) {
        if (player === this) return false;
        if (!this.isImperial) return true;
        return !player || !player?.isImperial;
    }

    moveOwnWarbands(from: ResourcesAndWarbands, to: ResourcesAndWarbands, amount: number): number {
        return from.moveWarbandsTo(this.id, to, amount);
    }

    gainSupply(amount: number) {
        this.supply = Math.min(7, this.supply + amount);
    }

    paySupply(amount: number): boolean {
        if (this.supply < amount) return false;
        this.supply -= amount;
        return true;
    }

    seize(player: OathPlayer) {
        new BurnResourcesEffect(this.game, this, this.getResources(Favor, Math.floor(this.getResources(Favor).length / 2))).doNext();
        new CampaignBanishPlayerAction(player, this).doNext();
    }

    rest() {
        this.returnResources();
    }

    returnResources() {
        for (const site of this.game.board.sites())
            for (const denizen of site.denizens)
                denizen.returnResources();

        for (const player of this.game.players) {
            for (const adviser of player.advisers)
                adviser.returnResources();

            for (const relic of player.relics)
                relic.returnResources();
        }

        new FlipSecretsEffect(this.game, this, Infinity, false).do();
    }

    serialize(): Record<string, any> {
        return {
            name: this.name,
            supply: this.supply,
            site: this.site?.id,
            ...super.serialize()
        };
    }
}

export class Chancellor extends OathPlayer {
    name = "Chancellor";
    reliquary: Reliquary;

    constructor() {
        super(PlayerColor.Purple);
        this.reliquary = this.addChild(new Reliquary());
        for (let i = 0; i < 24; i ++) this.bag.addChild(new OathWarband(this.id));
    }

    get isImperial(): boolean { return true; }

    rest() {
        super.rest();

        let amount: number;
        if (this.bag.amount >= 18) amount = 6;
        else if (this.bag.amount >= 11) amount = 5;
        else if (this.bag.amount >= 4) amount = 4;
        else amount = 3;

        new GainSupplyEffect(this, amount).do();
    }
}

export class VisionSlot extends Container<Vision, PlayerColor> {
    type = "visionSlot";

    constructor(color: PlayerColor) {
        super(color, Vision);
    }
}

export class Exile extends OathPlayer {
    name: string;
    isCitizen: boolean;
    visionSlot: VisionSlot;

    constructor(color: PlayerColor) {
        super(color);
        this.name = "Exile " + color;
        this.visionSlot = this.addChild(new VisionSlot(color));
        for (let i = 0; i < 14; i ++) this.bag.addChild(new OathWarband(this.id));
    }

    get isImperial(): boolean { return this.isCitizen; }
    get vision() { return this.visionSlot.children[0]; }

    setVision(newVision?: Vision) {
        const oldVision = this.visionSlot.children[0]?.unparent();
        if (newVision) this.visionSlot.addChild(newVision);
        return oldVision;
    }

    rest() {
        super.rest();

        if (this.isImperial) {
            new GainSupplyEffect(this, this.game.chancellor.supply).do();
            return;
        }

        let amount: number;
        if (this.bag.amount >= 9) amount = 6;
        else if (this.bag.amount >= 4) amount = 5;
        else amount = 4;

        new GainSupplyEffect(this, amount).do();
    }

    serialize(): Record<string, any> {
        const obj = super.serialize();
        return {
            ...obj,
            isCitizen: this.isCitizen
        };
    }
}
