type AbstractConstructor<T> = abstract new (...args: any) => T;
type Constructor<T> = new (...args: any) => T;
interface StringObject<T> { [key: string]: T; }
