import { cloneDeepWith } from 'lodash';

export type AbstractConstructor<T> = abstract new (...args: any) => T;
export type Constructor<T> = new (...args: any) => T;
export const isExtended = <T>(constructor: Constructor<any>, type: AbstractConstructor<T>): constructor is Constructor<T> => { return constructor.prototype instanceof type };

export abstract class CopiableWithOriginal { original = this; }  // Original should be idempotent
export function getCopyWithOriginal<T extends CopiableWithOriginal>(source: T): T {
    const customizer = (e: any, k: any) => {
        // if (k === "actionManager") return e;  // TODO: Move that into the game class?
        if (k === "original") return e;
    }
    const copy = cloneDeepWith(source, customizer) as T;
    return copy;
}
