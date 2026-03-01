export abstract class Result<T, E> {
  public static ok<T>(value: T): Result<T, never> {
    return new Ok(value);
  }

  public static err<E>(error: E): Result<never, E> {
    return new Err(error);
  }

  public abstract readonly type: 'ok' | 'err';

  public abstract map<U>(fn: (value: T) => U): Result<U, E>;

  public abstract flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E>;

  public abstract match<R>(onOk: (value: T) => R, onErr: (error: E) => R): R;

  public isOk(): this is Ok<T> {
    return this.type === 'ok';
  }

  public isErr(): this is Err<E> {
    return this.type === 'err';
  }
}

export class Ok<T> extends Result<T, never> {
  public readonly type = 'ok' as const;

  constructor(public readonly value: T) {
    super();
  }

  public map<U>(fn: (value: T) => U): Result<U, never> {
    return new Ok(fn(this.value));
  }

  public flatMap<U>(fn: (value: T) => Result<U, never>): Result<U, never> {
    return fn(this.value);
  }

  public match<R>(onOk: (value: T) => R, _onErr: (error: never) => R): R {
    return onOk(this.value);
  }
}

export class Err<E> extends Result<never, E> {
  public readonly type = 'err' as const;

  constructor(public readonly error: E) {
    super();
  }

  public map<U>(_fn: (value: never) => U): Result<U, E> {
    return new Err(this.error);
  }

  public flatMap<U>(_fn: (value: never) => Result<U, E>): Result<U, E> {
    return new Err(this.error);
  }

  public match<R>(_onOk: (value: never) => R, onErr: (error: E) => R): R {
    return onErr(this.error);
  }
}

export const ok = <T>(value: T): Result<T, never> => Result.ok(value);
export const err = <E>(error: E): Result<never, E> => Result.err(error);
