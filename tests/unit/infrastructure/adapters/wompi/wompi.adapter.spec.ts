import { OrderStatusService } from '../../../../../src/domain/services/order-status.service';
import { WompiAdapter } from '../../../../../src/infrastructure/adapters/wompi/wompi.adapter';
import { AppConfigService } from '../../../../../src/infrastructure/config/app-config.service';

describe('WompiAdapter', () => {
  const buildConfig = (
    overrides: Partial<AppConfigService> = {},
  ): AppConfigService =>
    ({
      wompiBaseUrl: 'https://api-sandbox.co.uat.wompi.dev/v1',
      wompiPrivateKey: 'private-key',
      wompiPublicKey: 'public-key',
      wompiAcceptanceToken: 'acceptance-token',
      wompiSandboxCardToken: undefined,
      wompiCustomerEmail: 'sandbox.user@comfort-api.local',
      ...overrides,
    }) as unknown as AppConfigService;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates transaction when provider responds with id and checkout_url', async () => {
    const adapter = new WompiAdapter(buildConfig(), new OrderStatusService());
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'tx1',
          status: 'PENDING',
          checkout_url: 'https://checkout.wompi.co/p/abc',
        },
      }),
    } as Response);

    const result = await adapter.createTransaction({
      orderReference: 'ref-1',
      amountInCents: 1000,
      currency: 'COP',
      paymentMethod: {
        type: 'CARD',
        cardToken: 'tok_test_123',
      },
    });

    expect(result.isOk()).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/transactions'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer private-key',
        }),
      }),
    );
  });

  it('tokenizes card data before creating transaction when cardToken is not provided', async () => {
    const adapter = new WompiAdapter(buildConfig(), new OrderStatusService());
    const fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'tok_generated_1' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'tx2', status: 'PENDING' } }),
      } as Response);

    const result = await adapter.createTransaction({
      orderReference: 'ref-2',
      amountInCents: 2500,
      currency: 'COP',
      paymentMethod: {
        type: 'CARD',
        cardData: {
          number: '4242424242424242',
          cvc: '123',
          expMonth: '12',
          expYear: '29',
          cardHolder: 'Sandbox User',
        },
      },
    });

    expect(result.isOk()).toBe(true);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/tokens/cards'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer public-key',
        }),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/transactions'),
      expect.any(Object),
    );
  });

  it('returns PAYMENT_PROVIDER_ERROR when transaction id is missing', async () => {
    const adapter = new WompiAdapter(buildConfig(), new OrderStatusService());
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { checkout_url: 'https://checkout.wompi.co' },
      }),
    } as Response);

    const result = await adapter.createTransaction({
      orderReference: 'ref-1',
      amountInCents: 1000,
      currency: 'COP',
      paymentMethod: {
        type: 'CARD',
        cardToken: 'tok_test_123',
      },
    });

    expect(result.isErr()).toBe(true);
  });

  it('allows null checkoutUrl when provider does not return redirect URLs', async () => {
    const adapter = new WompiAdapter(buildConfig(), new OrderStatusService());
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'tx1', status: 'PENDING' } }),
    } as Response);

    const result = await adapter.createTransaction({
      orderReference: 'ref-1',
      amountInCents: 1000,
      currency: 'COP',
      paymentMethod: {
        type: 'CARD',
        cardToken: 'tok_test_123',
      },
    });

    expect(result.isOk()).toBe(true);
    const value = result.match(
      (okValue) => okValue,
      () => null,
    );
    expect(value?.checkoutUrl).toBeNull();
  });

  it('fetches acceptance token from merchant endpoint when env token is placeholder', async () => {
    const adapter = new WompiAdapter(
      buildConfig({
        wompiAcceptanceToken: 'acceptance_token_from_wompi_sandbox',
      }),
      new OrderStatusService(),
    );
    const fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            presigned_acceptance: { acceptance_token: 'acceptance-live' },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'tx1', status: 'PENDING' } }),
      } as Response);

    const result = await adapter.createTransaction({
      orderReference: 'ref-3',
      amountInCents: 1000,
      currency: 'COP',
      paymentMethod: {
        type: 'CARD',
        cardToken: 'tok_test_123',
      },
    });

    expect(result.isOk()).toBe(true);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/merchants/public-key'),
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('maps transaction status to domain order status', async () => {
    const adapter = new WompiAdapter(buildConfig(), new OrderStatusService());
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: 'APPROVED' } }),
    } as Response);

    const result = await adapter.getTransactionStatus('tx1');

    expect(
      result.match(
        (v) => v.orderStatus,
        () => 'DECLINED',
      ),
    ).toBe('APPROVED');
  });

  it('maps 4xx provider responses to VALIDATION_ERROR', async () => {
    const adapter = new WompiAdapter(buildConfig(), new OrderStatusService());
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'invalid data' }),
    } as Response);

    const result = await adapter.getTransactionStatus('tx1');
    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns PAYMENT_PROVIDER_ERROR when fetch throws', async () => {
    const adapter = new WompiAdapter(buildConfig(), new OrderStatusService());
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    const result = await adapter.getTransactionStatus('tx1');

    expect(result.isErr()).toBe(true);
  });

  it('maps NEQUI payload in direct integration', async () => {
    const adapter = new WompiAdapter(buildConfig(), new OrderStatusService());
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'tx-nequi', status: 'PENDING' } }),
    } as Response);

    const result = await adapter.createTransaction({
      orderReference: 'ref-nequi',
      amountInCents: 1000,
      currency: 'COP',
      paymentMethod: {
        type: 'NEQUI',
        phoneNumber: '3991111111',
      },
    });

    expect(result.isOk()).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"type":"NEQUI"'),
      }),
    );
  });
});
