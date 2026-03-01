import { Err, Ok, Result, err, ok } from '../../../../src/shared/railway/result';

describe('Result', () => {
  it('maps Ok values', () => {
    const result = ok(2).map((n) => n * 2);
    expect(result.isOk()).toBe(true);
    expect(result.match((v) => v, () => 0)).toBe(4);
  });

  it('keeps Err through map and flatMap', () => {
    const result = err('boom')
      .map((v: never) => v)
      .flatMap((v: never) => ok(v));

    expect(result.isErr()).toBe(true);
    expect(result.match(() => '', (e) => e)).toBe('boom');
  });

  it('flatMaps Ok to Err', () => {
    const result = ok(1).flatMap(() => err('failure'));
    expect(result.isErr()).toBe(true);
  });

  it('supports class constructors directly', () => {
    const okResult = new Ok('value');
    const errResult = new Err('error');

    expect(Result.ok('value').match((v) => v, () => '')).toBe(
      okResult.value,
    );
    expect(Result.err('error').match(() => '', (e) => e)).toBe(
      errResult.error,
    );
  });
});
