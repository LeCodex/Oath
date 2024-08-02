import { OathType, BannerName } from "./enums";
import { OathGameObject } from "./gameObject";
import { OathPlayer } from "./player";


export abstract class Oath extends OathGameObject {
    type: OathType;

    abstract setup(): void;
    abstract scoreForOathkeeper(player: OathPlayer): number;
    abstract scoreForSuccessor(player: OathPlayer): number;

    getCandidates(evaluation: (player: OathPlayer) => number): Set<OathPlayer> {
        let max = 0;
        const candidates = new Set<OathPlayer>();
        for (const player of Object.values(this.game.players)) {
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
    type = OathType.Supremacy;

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
        return player.relics.size + player.banners.size;
    }
}

export class OathOfProtection extends Oath {
    type = OathType.Protection;

    setup() {
        // Chancellor already has the Scepter
    }

    scoreForOathkeeper(player: OathPlayer): number {
        return player.relics.size + player.banners.size;
    }

    scoreForSuccessor(player: OathPlayer): number {
        return this.game.banners.get(BannerName.PeoplesFavor)?.owner?.original === player.original ? 1 : 0;
    }
}

export class OathOfThePeople extends Oath {
    type = OathType.ThePeople;

    setup() {
        this.game.banners.get(BannerName.PeoplesFavor)?.setOwner(this.game.chancellor);
    }

    scoreForOathkeeper(player: OathPlayer): number {
        return this.game.banners.get(BannerName.PeoplesFavor)?.owner?.original === player.original ? 1 : 0;
    }

    scoreForSuccessor(player: OathPlayer): number {
        return this.game.banners.get(BannerName.DarkestSecret)?.owner?.original === player.original ? 1 : 0;
    }
}

export class OathOfDevotion extends Oath {
    type = OathType.Devotion;

    setup() {
        this.game.banners.get(BannerName.DarkestSecret)?.setOwner(this.game.chancellor);
    }

    scoreForOathkeeper(player: OathPlayer): number {
        return this.game.banners.get(BannerName.DarkestSecret)?.owner?.original === player.original ? 1 : 0;
    }

    scoreForSuccessor(player: OathPlayer): number {
        return this.game.grandScepter.owner?.original === player.original ? 1 : 0;
    }
}

export const OathTypeToOath = {
    [OathType.Supremacy]: OathOfSupremacy,
    [OathType.Protection]: OathOfProtection,
    [OathType.ThePeople]: OathOfThePeople,
    [OathType.Devotion]: OathOfDevotion,
};
