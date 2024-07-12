import _ from 'lodash';

export type AbstractConstructor<T> = abstract new (...args: any) => T;
export type Constructor<T> = new (...args: any) => T;
export interface StringObject<T> { [key: string]: T; }
export const isExtended = <T>(constructor: Constructor<any>, type: AbstractConstructor<T>): constructor is Constructor<T> => { return constructor.prototype instanceof type };

export abstract class CopiableWithOriginal { original = this; }  // Original should be idempotent
export function getCopyWithOriginal<T extends CopiableWithOriginal>(source: T): T {
    const customizer = (e: any, k: any, o: any, s: any) => { if (k === "original" && s && s.get(o)) s.get(o).original = o.original; }
    const copy = _.cloneDeepWith(source, customizer) as T;
    copy.original = "original" in source ? source.original as T : source ;
    return copy;
}
