import type { Denizen } from "../model/cards";
import { RollResult, AttackDie, DefenseDie } from "../dice";
import type { CampaignActionTarget } from "../model/interfaces";
import type { OathPlayer } from "../model/player";
import { ExileBoard } from "../model/player";
import type { ResourcesAndWarbands } from "../model/resources";
import type { MaskProxyManager } from "../utils";
import type { ResourceCost } from "../costs";
import { CampaignKillWarbandsInForceAction } from ".";
import { DiscardCardEffect, RollDiceEffect } from "./effects";
import type { OathActionManager } from "./manager";
import { recordMethodExecutionTime } from "../../utils";


export class EventPublisher<E extends Record<string, any[]>> {
    private listeners: { [K in keyof E]?: Set<(...args: E[K]) => void> } = {};

    on<K extends keyof E>(event: K, listener: (...args: E[K]) => void) {
        if (!this.listeners[event]) this.listeners[event] = new Set();
        this.listeners[event].add(listener);
    }

    off<K extends keyof E>(event: K, listener: (...args: E[K]) => void) {
        if (!this.listeners[event]) return;
        this.listeners[event].delete(listener);
    }

    @recordMethodExecutionTime.skip()
    emit<K extends keyof E>(event: K, ...args: E[K]) {
        if (!this.listeners[event]) return;
        for (const listener of this.listeners[event]) {
            listener(...args);
        }
    }
}

export class CampaignEndCallback {
    constructor(
        public resolve: () => void,
        public name: string,
        public orderAgnostic: boolean = true
    ) { }
}

export class CampaignResult {
    attacker: OathPlayer;
    defender: OathPlayer | undefined;
    defenderAllies = new Set<OathPlayer>();

    targets = new Set<CampaignActionTarget>();
    atkPool: number;
    defPool: number;
    atkForce: Set<ResourcesAndWarbands>; // The force is all your warbands on the objects in this set
    defForce: Set<ResourcesAndWarbands>;
    endCallbacks: CampaignEndCallback[] = [];

    atkRoll: RollResult<AttackDie>;
    defRoll: RollResult<DefenseDie>;

    ignoreKilling: boolean = false;
    attackerKillsNoWarbands: boolean = false;
    defenderKillsNoWarbands: boolean = false;
    attackerKillsEntireForce: boolean = false;
    defenderKillsEntireForce: boolean = false;
    sacrificeValue: number = 1;

    successful: boolean;
    attackerLoss: number = 0;
    defenderLoss: number = 0;

    constructor(public actionManager: OathActionManager) {
        this.atkRoll = new RollResult(this.game.random, new AttackDie());
        this.defRoll = new RollResult(this.game.random, new DefenseDie());
    }

    get game() { return this.actionManager.game; }
    get winner() { return this.successful ? this.attacker : this.defender; }
    get loser() { return this.successful ? this.defender : this.attacker; }
    get loserTotalForce() { return this.successful ? this.totalDefForce : this.totalAtkForce; }
    get loserKillsNoWarbands() { return this.successful ? this.defenderKillsNoWarbands : this.attackerKillsNoWarbands; }
    get loserKillsEntireForce() { return this.successful ? this.defenderKillsEntireForce : this.attackerKillsEntireForce; }
    get loserLoss() { return this.successful ? this.defenderLoss : this.attackerLoss; }
    get loserKills() { return this.successful ? this.defenderKills : this.attackerKills; }

    get totalAtkForce() { return [...this.atkForce].reduce((a, e) => a + e.getWarbandsAmount(this.attacker.leader.board.key), 0); }
    get totalDefForce() { return [...this.defForce].reduce((a, e) => a + e.getWarbandsAmount(this.defender?.leader.board.key), 0); }

    get atk() { return this.atkRoll.value; }
    get def() { return this.defRoll.value + this.totalDefForce; }

    get requiredSacrifice() {
        const diff = this.def - this.atk + 1;
        return this.sacrificeValue === 0 ? diff > 0 ? Infinity : 0 : Math.ceil(diff / this.sacrificeValue);
    }
    get couldSacrifice() { return this.requiredSacrifice > 0 && this.requiredSacrifice <= this.totalAtkForce; }

    areEnemies(player1: OathPlayer | undefined, player2: OathPlayer | undefined) {
        return (
            (player1 === this.defender || !!player1 && this.defenderAllies.has(player1)) && player2 === this.attacker ||
            (player2 === this.defender || !!player2 && this.defenderAllies.has(player2)) && player1 === this.attacker
        )
    }

    atEnd(callback: CampaignEndCallback) {
        this.endCallbacks.push(callback);
    }

    discardAtEnd(denizen: Denizen) {
        this.atEnd(new CampaignEndCallback(
            () => new DiscardCardEffect(this.actionManager, denizen.ruler ?? this.attacker, denizen).doNext(), `Discard ${denizen.name}`
        ));
    }

    onSuccessful(successful: boolean, callback: CampaignEndCallback) {
        const originalResolve = callback.resolve;
        callback.resolve = () => { if (this.successful === successful) originalResolve(); };
        this.atEnd(callback);
    }

    onAttackWin(callback: CampaignEndCallback) {
        return this.onSuccessful(true, callback);
    }

    onDefenseWin(callback: CampaignEndCallback) {
        return this.onSuccessful(false, callback);
    }

    checkForImperialInfighting(maskProxyManager: MaskProxyManager) {
        if (maskProxyManager.get(this.defender)?.isImperial) {
            if (this.attacker.board instanceof ExileBoard) // Citizen attacks: revoke Citizen priviledges
                maskProxyManager.get(this.attacker.board).isCitizen = false;
            else if (this.defender?.board instanceof ExileBoard) // Chancellor attacks: revoke defender's Citizen priviledges
                maskProxyManager.get(this.defender.board).isCitizen = false;
        }
    }

    attackerKills(amount: number) {
        if (amount) new CampaignKillWarbandsInForceAction(this.actionManager, this, true, amount).doNext();
    }

    defenderKills(amount: number) {
        if (!this.defender) return;
        if (amount) new CampaignKillWarbandsInForceAction(this.actionManager, this, false, amount).doNext();
    }

    resolve(callback: () => void) {
        new RollDiceEffect(this.actionManager, this.attacker, this.atkRoll, this.atkPool).doNext();
        const pool = this.defPool + (this.atkPool < 0 ? -this.atkPool : 0);
        new RollDiceEffect(this.actionManager, this.defender, this.defRoll, pool).doNext(callback);
    }
}

export class InvalidActionResolution extends Error { }

export function cannotPayError(cost: ResourceCost) {
    let message = "Cannot pay resource cost: ";
    message += cost.toString();
    return new InvalidActionResolution(message);
}