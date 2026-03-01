import { OrderStatusService } from '../../../../../src/domain/services/order-status.service';
import { WompiAdapter } from '../../../../../src/infrastructure/adapters/wompi/wompi.adapter';
import { AppConfigService } from '../../../../../src/infrastructure/config/app-config.service';

describe('WompiAdapter', () => {
  const appConfig = {
    wompiBaseUrl: 'https://api-sandbox.co.uat.wompi.dev/v1',
    wompiPrivateKey: 'private-key',
    wompiPublicKey: 'public-key',
    wompiAcceptanceToken: 'acceptance-token',
    wompiSandboxCardToken: 'card-token',
    wompiCustomerEmail: 'sandbox.user@comfort-api.local',
  } as unknown as AppConfigService;

  const adapter = new WompiAdapter(appConfig, new OrderStatusService());

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates transaction when provider responds with id and checkout_url', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
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
    });

    expect(result.isOk()).toBe(true);
  });

  it('returns PAYMENT_PROVIDER_ERROR when transaction id is missing', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { checkout_url: 'https://checkout.wompi.co' } }),
    } as Response);

    const result = await adapter.createTransaction({
      orderReference: 'ref-1',
      amountInCents: 1000,
      currency: 'COP',
    });

    expect(result.isErr()).toBe(true);
  });

  it('returns PAYMENT_PROVIDER_ERROR when checkout_url is missing', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'tx1', status: 'PENDING' } }),
    } as Response);

    const result = await adapter.createTransaction({
      orderReference: 'ref-1',
      amountInCents: 1000,
      currency: 'COP',
    });

    expect(result.isErr()).toBe(true);
  });

  it('maps transaction status to domain order status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: 'APPROVED' } }),
    } as Response);

    const result = await adapter.getTransactionStatus('tx1');

    expect(result.match((v) => v.orderStatus, () => 'DECLINED')).toBe('APPROVED');
  });

  it('returns PAYMENT_PROVIDER_ERROR on non-ok response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad request' }),
    } as Response);

    const result = await adapter.getTransactionStatus('tx1');

    expect(result.isErr()).toBe(true);
  });

  it('returns PAYMENT_PROVIDER_ERROR when fetch throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    const result = await adapter.getTransactionStatus('tx1');

    expect(result.isErr()).toBe(true);
  });
});
