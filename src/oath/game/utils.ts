type AbstractConstructor<T> = abstract new (...args: any) => T;
type Constructor<T> = new (...args: any) => T;
interface StringObject<T> { [key: string]: T; }
const isExtended = <T>(constructor: Constructor<any>, type: AbstractConstructor<T>): constructor is Constructor<T> => { return constructor.prototype instanceof type };

abstract class InternalData<T> {
    instance: T;

    constructor(instance: T) {
        this.instance = instance;
    } 

    proxy() {  // Creates a copy with all dynamic fields filled statically
        return {...this};
    }
}