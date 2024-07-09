type Constructor<T> = abstract new (...args: any) => T;
type ConcreteConstructor<T> = new (...args: any) => T;