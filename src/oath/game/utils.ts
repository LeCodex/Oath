type AbstractConstructor<T> = abstract new (...args: any) => T;
type Constructor<T> = new (...args: any) => T;
interface StringObject<T> { [key: string]: T; }
const isExtended = <T>(constructor: Constructor<any>, type: AbstractConstructor<T>): constructor is Constructor<T> => { return constructor.prototype instanceof type };