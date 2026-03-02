import { AppConfigService } from '../../../../../src/infrastructure/config/app-config.service';
import { WompiAcceptanceTokenService } from '../../../../../src/infrastructure/adapters/wompi/wompi-acceptance-token.service';
import { WompiHttpClient } from '../../../../../src/infrastructure/adapters/wompi/wompi-http.client';
import { err, ok } from '../../../../../src/shared/railway/result';

describe('WompiAcceptanceTokenService', () => {
  const buildService = ({
    acceptanceToken = 'acceptance-token',
    requestResult = ok({
      data: { presigned_acceptance: { acceptance_token: 'merchant-token' } },
    }),
  }: {
    acceptanceToken?: string;
    requestResult?: ReturnType<typeof ok> | ReturnType<typeof err>;
  } = {}) => {
    const config = {
      wompiAcceptanceToken: acceptanceToken,
      wompiPublicKey: 'public-key',
    } as AppConfigService;

    const httpClient = {
      request: jest.fn().mockResolvedValue(requestResult),
    } as unknown as WompiHttpClient;

    return {
      service: new WompiAcceptanceTokenService(config, httpClient),
      httpClient,
    };
  };

  it('returns configured acceptance token when present', async () => {
    const { service, httpClient } = buildService();

    const result = await service.resolve();

    expect(result.isOk()).toBe(true);
    expect(
      result.match(
        (value) => value,
        () => null,
      ),
    ).toBe('acceptance-token');
    expect((httpClient as any).request).not.toHaveBeenCalled();
  });

  it('fetches token from merchant endpoint when configured token is placeholder', async () => {
    const { service, httpClient } = buildService({
      acceptanceToken: 'acceptance_token_from_wompi_sandbox',
    });

    const result = await service.resolve();

    expect(result.isOk()).toBe(true);
    expect((httpClient as any).request).toHaveBeenCalledWith(
      '/merchants/public-key',
      { method: 'GET' },
      'none',
    );
  });

  it('returns PAYMENT_PROVIDER_ERROR when merchant response has no token', async () => {
    const { service } = buildService({
      acceptanceToken: 'acceptance_token_from_wompi_sandbox',
      requestResult: ok({ data: {} }),
    });

    const result = await service.resolve();
    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('PAYMENT_PROVIDER_ERROR');
  });

  it('propagates client errors', async () => {
    const providerError = err({
      code: 'PAYMENT_PROVIDER_ERROR',
      message: 'network',
    });
    const { service } = buildService({
      acceptanceToken: 'acceptance_token_from_wompi_sandbox',
      requestResult: providerError,
    });

    const result = await service.resolve();

    expect(result.isErr()).toBe(true);
  });
});
