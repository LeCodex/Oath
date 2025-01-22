import type { Relic } from "../model/cards";
import { OathGameObject } from "../model/gameObject";
import type { CampaignActionTarget, WithPowers } from "../model/interfaces";
import type { PowerName } from "./classIndex";


export class RelicWrapper extends OathGameObject<Relic["key"]> implements CampaignActionTarget, WithPowers {
    readonly type = "relic";
    defense = 1;
    force = undefined;
    relic: Relic;
    powers = new Set<PowerName>(["RelicWrapperSeize"]);
    active = true;

    constructor(relic: Relic) {
        super(relic.id);
        this.relic = relic;
    }

    get name() { return this.relic.name; }
    get key() { return this.relic.key; }
}
