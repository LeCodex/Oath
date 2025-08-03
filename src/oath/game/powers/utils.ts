import { CapacityModifier } from ".";
import { type CapacityInformation } from "../actions";
import type { Denizen, Relic, Site, WorldCard } from "../model/cards";
import { OathGameObject } from "../model/gameObject";
import type { CampaignActionTarget, WithPowers } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import type { MaskProxyManager} from "../utils";
import { isExtended } from "../utils";
import { powersIndex, type PowerName } from "./classIndex";
import type { OathPowerManager } from "./manager";


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

export function getCapacityInformation(
    powerManager: OathPowerManager,
    maskProxyManager: MaskProxyManager,
    siteProxy: Site | undefined,
    playerProxy: OathPlayer,
    playingProxy?: WorldCard,
    facedown: boolean = false
): CapacityInformation {
    const takesNoSpaceProxies = new Set<WorldCard>();
    const targetProxy = siteProxy ? siteProxy.denizens : playerProxy.advisers;
    let ignoresCapacity = false;
    let capacity = siteProxy ? siteProxy.capacity : 3;

    const capacityModifiers: CapacityModifier<WorldCard>[] = [];
    for (const [sourceProxy, modifier] of powerManager.getPowers(CapacityModifier)) {
        const instance = new modifier(sourceProxy.original, playerProxy.original, maskProxyManager);
        if (instance.canUse(playerProxy, siteProxy)) capacityModifiers.push(instance);
    }

    if (playingProxy && !facedown) {
        for (const name of playingProxy.powers) {
            const modifier = powersIndex[name];
            if (isExtended(modifier, CapacityModifier)) {
                const instance = new modifier(powerManager, playingProxy.original as Denizen, playerProxy.original, maskProxyManager);
                capacityModifiers.push(instance);  // Always assume the card influences the capacity
            }
        }
    }

    for (const capacityModifier of capacityModifiers) {
        const [cap, noSpaceProxy] = capacityModifier.updateCapacityInformation(targetProxy);
        capacity = Math.min(capacity, cap);
        for (const cardProxy of noSpaceProxy) takesNoSpaceProxies.add(cardProxy);
        if (playingProxy) ignoresCapacity ||= capacityModifier.ignoreCapacity(playingProxy);
    }

    return { capacity, takesSpaceInTargetProxies: targetProxy.filter((e) => !takesNoSpaceProxies.has(e)), ignoresCapacity };
}
