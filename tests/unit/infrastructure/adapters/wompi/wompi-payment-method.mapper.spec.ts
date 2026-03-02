import { WompiPaymentMethodMapper } from '../../../../../src/infrastructure/adapters/wompi/wompi-payment-method.mapper';

describe('WompiPaymentMethodMapper', () => {
  const mapper = new WompiPaymentMethodMapper();

  it('maps CARD with valid token', () => {
    const result = mapper.map({
      type: 'CARD',
      cardToken: 'tok_test_123',
      installments: 2,
    });

    expect(result.isOk()).toBe(true);
    const value = result.match(
      (okValue) => okValue,
      () => null,
    );
    expect(value).toEqual({
      type: 'CARD',
      token: 'tok_test_123',
      installments: 2,
    });
  });

  it('returns VALIDATION_ERROR for CARD placeholder token', () => {
    const result = mapper.map({
      type: 'CARD',
      cardToken: 'tok_test_from_wompi_sandbox',
    } as any);

    const error = result.match(
      () => null,
      (errValue) => errValue,
    );
    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
  });

  it('maps NEQUI method', () => {
    const result = mapper.map({
      type: 'NEQUI',
      phoneNumber: '3991111111',
    });

    expect(result.isOk()).toBe(true);
    expect(
      result.match(
        (okValue) => okValue.type,
        () => null,
      ),
    ).toBe('NEQUI');
  });

  it('maps BANCOLOMBIA_TRANSFER with sandbox status', () => {
    const result = mapper.map({
      type: 'BANCOLOMBIA_TRANSFER',
      paymentDescription: 'Pago',
      sandboxStatus: 'APPROVED',
    });

    expect(result.isOk()).toBe(true);
    const value = result.match(
      (okValue) => okValue,
      () => null,
    );
    expect(value).toEqual({
      type: 'BANCOLOMBIA_TRANSFER',
      payment_description: 'Pago',
      sandbox_status: 'APPROVED',
    });
  });
});
