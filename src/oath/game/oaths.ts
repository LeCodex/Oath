import { DarkestSecret, PeoplesFavor } from "./banks";
import { OathType, isEnumKey } from "./enums";
import { OathGameObject } from "./gameObject";
import { OwnableObject, WithPowers } from "./interfaces";
import { OathPlayer } from "./player";
import { OathDefense } from "./powers/visions";


export abstract class Oath extends OathGameObject<OathType> implements OwnableObject, WithPowers {
    type = "oath";
    id: keyof typeof OathType;
    active = true;
    powers = new Set([OathDefense]);
    
    constructor(id: keyof typeof OathType) {
        if (!isEnumKey(id, OathType)) throw TypeError(`${id} is not a valid oath type`);
        super(id);
    }
    
    get key() { return OathType[this.id]; }
    get owner() { return this.typedParent(OathPlayer); }
    
    abstract setup(): void;
    abstract scoreForOathkeeper(player: OathPlayer): number;
    abstract scoreForSuccessor(player: OathPlayer): number;
    
    setOwner(player?: OathPlayer): void {
        player?.addChild(this);
    }

    getCandidates(evaluation: (player: OathPlayer) => number): Set<OathPlayer> {
        let max = 0;
        const candidates = new Set<OathPlayer>();
        for (const player of this.game.byClass(OathPlayer)) {
            const score = evaluation(player);
            if (score > max) {
                candidates.clear();
                candidates.add(player);
                max = score;
            } else if (score === max) {
                candidates.add(player);
            }
        }

        return candidates;
    }

    getOathkeeperCandidates(): Set<OathPlayer> {
        return this.getCandidates(this.scoreForOathkeeper.bind(this));
    }

    getSuccessorCandidates(): Set<OathPlayer> {
        return this.getCandidates(this.scoreForSuccessor.bind(this));
    }
}

export class OathOfSupremacy extends Oath {
    constructor() {
        super("Supremacy");
    }

    setup() {
        // Chancellor already rules most sites
    }

    scoreForOathkeeper(player: OathPlayer): number {
        let total = 0;
        for (const site of this.game.board.sites())
            if (site.ruler === player) total++;

        return total;
    }

    scoreForSuccessor(player: OathPlayer): number {
        return player.relics.length + player.banners.length;
    }
}

export class OathOfProtection extends Oath {
    constructor() {
        super("Protection");
    }

    setup() {
        // Chancellor already has the Scepter
    }

    scoreForOathkeeper(player: OathPlayer): number {
        return player.relics.length + player.banners.length;
    }

    scoreForSuccessor(player: OathPlayer): number {
        return this.game.byClass(PeoplesFavor)[0]?.parent === player ? 1 : 0;
    }
}

export class OathOfThePeople extends Oath {
    constructor() {
        super("ThePeople");
    }

    setup() {
        const banner = this.game.byClass(PeoplesFavor)[0];
        if (banner) this.game.chancellor.addChild(banner);
    }

    scoreForOathkeeper(player: OathPlayer): number {
        return this.game.byClass(PeoplesFavor)[0]?.parent === player ? 1 : 0;
    }

    scoreForSuccessor(player: OathPlayer): number {
        return this.game.byClass(DarkestSecret)[0]?.parent === player ? 1 : 0;
    }
}

export class OathOfDevotion extends Oath {
    constructor() {
        super("Devotion");
    }

    setup() {
        const banner = this.game.byClass(DarkestSecret)[0];
        if (banner) this.game.chancellor.addChild(banner);
    }

    scoreForOathkeeper(player: OathPlayer): number {
        return this.game.byClass(DarkestSecret)[0]?.parent === player ? 1 : 0;
    }

    scoreForSuccessor(player: OathPlayer): number {
        return this.game.grandScepter.parent === player ? 1 : 0;
    }
}

export const OathTypeToOath = {
    "Supremacy": OathOfSupremacy,
    "Protection": OathOfProtection,
    "ThePeople": OathOfThePeople,
    "Devotion": OathOfDevotion,
};
