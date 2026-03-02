import { CreateOrderPaymentMethodResolver } from '../../../../src/application/services/create-order-payment-method.resolver';

describe('CreateOrderPaymentMethodResolver', () => {
  const resolver = new CreateOrderPaymentMethodResolver();

  it('returns CARD with token by default', () => {
    const result = resolver.resolve(undefined, { cardToken: 'tok_test_123' });

    expect(result.isOk()).toBe(true);
    expect(
      result.match(
        (value) => value,
        () => null,
      ),
    ).toEqual({
      type: 'CARD',
      cardToken: 'tok_test_123',
      installments: 1,
    });
  });

  it('returns VALIDATION_ERROR when CARD token is missing', () => {
    const result = resolver.resolve('CARD', {});

    const error = result.match(
      () => null,
      (value) => value,
    );
    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
  });

  it('maps NEQUI method', () => {
    const result = resolver.resolve('NEQUI', { phoneNumber: '3991111111' });

    expect(result.isOk()).toBe(true);
    expect(
      result.match(
        (value) => value.type,
        () => null,
      ),
    ).toBe('NEQUI');
  });

  it('maps PSE method', () => {
    const result = resolver.resolve('PSE', {
      userType: 0,
      userLegalIdType: 'CC',
      userLegalId: '1999888777',
      financialInstitutionCode: '1',
      paymentDescription: 'Pago Comfort',
    });

    expect(result.isOk()).toBe(true);
    expect(
      result.match(
        (value) => value.type,
        () => null,
      ),
    ).toBe('PSE');
  });

  it('returns VALIDATION_ERROR for unsupported method', () => {
    const result = resolver.resolve('UNKNOWN' as any, {});

    const error = result.match(
      () => null,
      (value) => value,
    );
    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
  });
});
