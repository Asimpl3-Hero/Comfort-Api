import { Money } from '../../../../src/domain/value-objects/money.vo';

describe('Money', () => {
  it('creates money when data is valid', () => {
    const result = Money.create(1500, 'cop');

    expect(result.isOk()).toBe(true);
    const value = result.match(
      (okValue) => okValue,
      () => null,
    );
    expect(value?.amountInCents).toBe(1500);
    expect(value?.currency).toBe('COP');
  });

  it('returns VALIDATION_ERROR when amount is invalid', () => {
    const result = Money.create(0, 'COP');

    expect(result.isErr()).toBe(true);
  });

  it('returns VALIDATION_ERROR when currency is invalid', () => {
    const result = Money.create(1000, 'CO');

    expect(result.isErr()).toBe(true);
  });
});
