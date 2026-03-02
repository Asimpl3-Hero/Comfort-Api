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

  it('returns VALIDATION_ERROR for invalid NEQUI phone', () => {
    const result = resolver.resolve('NEQUI', { phoneNumber: '123' });
    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
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

  it('returns VALIDATION_ERROR for invalid PSE userType', () => {
    const result = resolver.resolve('PSE', {
      userType: 2,
      userLegalIdType: 'CC',
      userLegalId: '1999888777',
      financialInstitutionCode: '1',
      paymentDescription: 'Pago Comfort',
    } as any);
    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for invalid PSE document type', () => {
    const result = resolver.resolve('PSE', {
      userType: 0,
      userLegalIdType: 'PP' as any,
      userLegalId: '1999888777',
      financialInstitutionCode: '1',
      paymentDescription: 'Pago Comfort',
    });
    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for missing PSE userLegalId', () => {
    const result = resolver.resolve('PSE', {
      userType: 0,
      userLegalIdType: 'CC',
      financialInstitutionCode: '1',
      paymentDescription: 'Pago Comfort',
    });
    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for missing PSE financialInstitutionCode', () => {
    const result = resolver.resolve('PSE', {
      userType: 0,
      userLegalIdType: 'CC',
      userLegalId: '1999888777',
      paymentDescription: 'Pago Comfort',
    });
    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for invalid PSE paymentDescription', () => {
    const result = resolver.resolve('PSE', {
      userType: 0,
      userLegalIdType: 'CC',
      userLegalId: '1999888777',
      financialInstitutionCode: '1',
      paymentDescription: 'x'.repeat(31),
    });
    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
  });

  it('maps BANCOLOMBIA_TRANSFER method', () => {
    const result = resolver.resolve('BANCOLOMBIA_TRANSFER', {
      paymentDescription: 'Pago Comfort',
      sandboxStatus: 'APPROVED',
    });

    expect(result.isOk()).toBe(true);
    expect(
      result.match(
        (value) => value,
        () => null,
      ),
    ).toEqual({
      type: 'BANCOLOMBIA_TRANSFER',
      paymentDescription: 'Pago Comfort',
      sandboxStatus: 'APPROVED',
    });
  });

  it('returns VALIDATION_ERROR for invalid BANCOLOMBIA_TRANSFER paymentDescription', () => {
    const result = resolver.resolve('BANCOLOMBIA_TRANSFER', {
      paymentDescription: 'x'.repeat(65),
    });
    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
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
