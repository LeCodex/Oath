import { MoveOwnWarbandsEffect } from "../effects/basic";
import { CampaignSeizeSiteAction } from "../actions/major";
import { CampaignActionTarget } from "../actions/types";
import { Region } from "../board";
import { OathResource, OathSuit, RegionName } from "../enums";
import { OathGame } from "../game";
import { OathPlayer } from "../player";
import { OathPower } from "../powers/base";
import { ResourceCost } from "../resources";
import { Constructor } from "../utils";
import { OathCard } from "./base";
import { Relic } from "./relics";
import { Denizen } from "./denizens";


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
        for (const relic of this.game.relicDeck.draw(this.startingRelics)) relic.putAtSite(this);
        for (const [resource, amount] of this.startingResources) this.putResources(resource, amount);
    }

    hide(): void {
        super.hide();
        for (const relic of this.relics) this.game.relicDeck.putCard(relic);
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
        if (this.ruler) new MoveOwnWarbandsEffect(this.ruler, this, this.ruler).do();
        new CampaignSeizeSiteAction(player.original, this).doNext();
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
