import _ from 'lodash';

export type AbstractConstructor<T> = abstract new (...args: any) => T;
export type Constructor<T> = new (...args: any) => T;
export interface StringObject<T> { [key: string]: T; }
export const isExtended = <T>(constructor: Constructor<any>, type: AbstractConstructor<T>): constructor is Constructor<T> => { return constructor.prototype instanceof type };

export type CopyWithOriginal<T> = T & { original: T };
export function getCopyWithOriginal<T>(source: T): CopyWithOriginal<T> {
    const copy = _.cloneDeep(source) as CopyWithOriginal<T>;
    copy.original = source;
    return copy;
}
