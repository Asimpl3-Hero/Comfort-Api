import { AppConfigService } from '../../../../../src/infrastructure/config/app-config.service';
import { WompiHttpClient } from '../../../../../src/infrastructure/adapters/wompi/wompi-http.client';

describe('WompiHttpClient', () => {
  const config = {
    wompiBaseUrl: 'https://api-sandbox.co.uat.wompi.dev/v1',
    wompiPrivateKey: 'private-key',
  } as AppConfigService;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends private Authorization header', async () => {
    const client = new WompiHttpClient(config);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'tx1' } }),
    } as Response);

    const result = await client.request<{ data: { id: string } }>(
      '/transactions',
      { method: 'GET' },
      'private',
    );

    expect(result.isOk()).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api-sandbox.co.uat.wompi.dev/v1/transactions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer private-key',
        }),
      }),
    );
  });

  it('maps 4xx responses to VALIDATION_ERROR', async () => {
    const client = new WompiHttpClient(config);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'invalid' }),
    } as Response);

    const result = await client.request(
      '/transactions',
      { method: 'POST' },
      'private',
    );
    const error = result.match(
      () => null,
      (errValue) => errValue,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
  });

  it('maps thrown errors to PAYMENT_PROVIDER_ERROR', async () => {
    const client = new WompiHttpClient(config);
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network'));

    const result = await client.request(
      '/transactions',
      { method: 'GET' },
      'none',
    );
    const error = result.match(
      () => null,
      (errValue) => errValue,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('PAYMENT_PROVIDER_ERROR');
  });
});
