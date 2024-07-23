import { OathType, BannerName } from "./enums";
import { OathGameObject } from "./gameObject";
import { OathPlayer } from "./player";


export abstract class Oath extends OathGameObject {
    type: OathType;

    abstract setup(): void;
    abstract scorePlayer(player: OathPlayer): number;
    abstract isSuccessor(player: OathPlayer): boolean;

    getCandidates(): Set<OathPlayer> {
        let max = 0;
        const candidates = new Set<OathPlayer>();
        for (const player of Object.values(this.game.players)) {
            const score = this.scorePlayer(player);
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
}

export class OathOfSupremacy extends Oath {
    type = OathType.Supremacy;

    setup() {
        // Chancellor already rules most sites
    }

    scorePlayer(player: OathPlayer): number {
        let total = 0;
        for (const site of this.game.board.sites())
            if (site.ruler === player) total++;

        return total;
    }

    isSuccessor(player: OathPlayer): boolean {
        return player.relics.size + player.banners.size > this.game.chancellor.relics.size + this.game.chancellor.banners.size;
    }
}

export class OathOfProtection extends Oath {
    type = OathType.Protection;

    setup() {
        // Chancellor already has the Scepter
    }

    scorePlayer(player: OathPlayer): number {
        return player.relics.size + player.banners.size;
    }

    isSuccessor(player: OathPlayer): boolean {
        return this.game.banners.get(BannerName.PeoplesFavor)?.owner?.original === player.original;
    }
}

export class OathOfThePeople extends Oath {
    type = OathType.ThePeople;

    setup() {
        this.game.banners.get(BannerName.PeoplesFavor)?.setOwner(this.game.chancellor);
    }

    scorePlayer(player: OathPlayer): number {
        return this.game.banners.get(BannerName.PeoplesFavor)?.owner?.original === player.original ? 1 : 0;
    }

    isSuccessor(player: OathPlayer): boolean {
        return this.game.banners.get(BannerName.DarkestSecret)?.owner?.original === player.original;
    }
}

export class OathOfDevotion extends Oath {
    type = OathType.Devotion;

    setup() {
        this.game.banners.get(BannerName.DarkestSecret)?.setOwner(this.game.chancellor);
    }

    scorePlayer(player: OathPlayer): number {
        return this.game.banners.get(BannerName.DarkestSecret)?.owner?.original === player.original ? 1 : 0;
    }

    isSuccessor(player: OathPlayer): boolean {
        return this.game.grandScepter.owner?.original === player.original;
    }
}

export const OathTypeToOath = {
    [OathType.Supremacy]: OathOfSupremacy,
    [OathType.Protection]: OathOfProtection,
    [OathType.ThePeople]: OathOfThePeople,
    [OathType.Devotion]: OathOfDevotion,
};
