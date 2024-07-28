import { OwnableCard } from "../cards/base";
import { OathGameObject } from "../gameObject";
import { ActionPower } from "../powers/base";
import { InvalidActionResolution, AbstractConstructor } from "../utils";
import { OathAction, SelectNOf } from "./base";
import { WakeAction, RestAction, CampaignAtttackAction, CampaignDefenseAction } from "./major";


export class ChooseModifiers extends OathAction {
    readonly selects: { modifiers: SelectNOf<ActionModifier<any>>; };
    readonly parameters: { modifiers: ActionModifier<any>[]; };
    readonly next: ModifiableAction;
    readonly executeImmediately: boolean;
    readonly message = "Choose modifiers";

    persistentModifiers: Set<ActionModifier<any>>;

    constructor(next: ModifiableAction, executeImmediately: boolean = false) {
        super(next.player, true); // Not copying for performance reasons, since this copy should never be accessed
        this.next = next;
        this.executeImmediately = executeImmediately;
    }

    start() {
        this.persistentModifiers = new Set();
        const choices = new Map<string, ActionModifier<any>>();
        for (const modifier of ChooseModifiers.gatherModifiers(this.next)) {
            if (modifier.mustUse)
                this.persistentModifiers.add(modifier);

            else
                choices.set(modifier.name, modifier);
        }
        this.selects.modifiers = new SelectNOf(choices);

        // NOTE: For ignore loops, all powers in the loop are ignored.
        const ignore = new Set<ActionModifier<any>>();
        for (const modifier of choices.values())
            for (const toIgnore of modifier.applyImmediately([...choices.values()]))
                ignore.add(toIgnore);

        for (const modifier of ignore) {
            choices.delete(modifier.name);
            this.persistentModifiers.delete(modifier);
        }

        return super.start();
    }

    static gatherModifiers(action: ModifiableAction): ActionModifier<any>[] {
        const instances: ActionModifier<any>[] = [];

        for (const [source, modifier] of action.game.getPowers((ActionModifier<any>))) {
            const instance = new modifier(source, action);
            if (action instanceof instance.modifiedAction && instance.canUse()) instances.push(instance);
        };

        return instances;
    }

    execute() {
        const modifiers = [...this.persistentModifiers, ...this.parameters.modifiers];
        if (!this.next.applyModifiers(modifiers)) return;

        if (this.executeImmediately)
            this.next.execute();

        else
            this.next.doNextWithoutModifiers();
    }
}

export abstract class ModifiableAction extends OathAction {
    modifiers: ActionModifier<any>[];

    doNext(executeImmediately: boolean = false): void {
        new ChooseModifiers(this, executeImmediately).doNext();
    }

    doNextWithoutModifiers(): void {
        super.doNext();
    }

    applyModifiers(modifiers: ActionModifier<any>[]): boolean {
        this.modifiers = modifiers;

        let interrupt = false;
        for (const modifier of modifiers) {
            if (!modifier.payCost(this.player))
                throw new InvalidActionResolution("Cannot pay the resource cost of all the modifiers.");

            if (!modifier.applyBefore()) interrupt = true;
        }
        if (interrupt) return false;

        return true;
    }

    start(): boolean {
        for (const modifier of this.modifiers) modifier.applyAtStart();
        return super.start();
    }

    execute() {
        for (const modifier of this.modifiers) modifier.applyDuring();
        this.modifiedExecution();
        for (const modifier of this.modifiers) modifier.applyAfter();
    }

    abstract modifiedExecution(): void;

    serialize(): Record<string, any> {
        const obj = super.serialize();
        obj.modifiers = this.modifiers.map(e => e.constructor.name);
        return obj;
    }
}

export abstract class ActionModifier<T extends OathGameObject> extends ActionPower<T> {
    abstract modifiedAction: AbstractConstructor<ModifiableAction>;
    abstract action: ModifiableAction;
    mustUse = false;

    canUse(): boolean {
        return true;
    }

    applyImmediately(modifiers: ActionModifier<any>[]): Iterable<ActionModifier<any>> { return []; } // Applied right after all the possible modifiers are collected
    applyBefore(): boolean { return true; } // Applied before the action is added to the list. If returns false, it will not be added
    applyAtStart(): void { } // Applied when the action starts and selects are setup (before choices are made)
    applyDuring(): void { } // Applied right before the execution of the action
    applyAfter(): void { } // Applied after the execution of the action
}

export abstract class EnemyActionModifier<T extends OwnableCard> extends ActionModifier<T> {
    mustUse = true;

    canUse(): boolean {
        return this.source.ruler === undefined || this.source.ruler.enemyWith(this.action.player);
    }
}

export abstract class AccessedActionModifier<T extends OwnableCard> extends ActionModifier<T> {
    canUse(): boolean {
        return this.source.accessibleBy(this.action.player) && this.source.empty;
    }
}

export abstract class WakePower<T extends OwnableCard> extends AccessedActionModifier<T> {
    modifiedAction = WakeAction;
    action: WakeAction;
    mustUse = true;
}

export abstract class RestPower<T extends OwnableCard> extends AccessedActionModifier<T> {
    modifiedAction = RestAction;
    action: RestAction;
    mustUse = true;
}

export abstract class BattlePlan<T extends OwnableCard> extends ActionModifier<T> {
    canUse(): boolean {
        return this.action.player.rules(this.source);
    }
}

export abstract class AttackerBattlePlan<T extends OwnableCard> extends BattlePlan<T> {
    modifiedAction = CampaignAtttackAction;
    action: CampaignAtttackAction;
}

export abstract class DefenderBattlePlan<T extends OwnableCard> extends BattlePlan<T> {
    modifiedAction = CampaignDefenseAction;
    action: CampaignDefenseAction;
}
