import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '../../../../src/infrastructure/config/app-config.service';

describe('AppConfigService', () => {
  it('returns configured values for required keys', () => {
    const configService = {
      get: jest.fn((key: string) => `${key}_VALUE`),
    } as unknown as ConfigService;
    const service = new AppConfigService(configService);

    expect(service.databaseUrl).toBe('DATABASE_URL_VALUE');
    expect(service.wompiBaseUrl).toBe('WOMPI_BASE_URL_VALUE');
    expect(service.wompiPublicKey).toBe('WOMPI_PUBLIC_KEY_VALUE');
    expect(service.wompiPrivateKey).toBe('WOMPI_PRIVATE_KEY_VALUE');
    expect(service.wompiAcceptanceToken).toBe('WOMPI_ACCEPTANCE_TOKEN_VALUE');
    expect(service.wompiSandboxCardToken).toBe('WOMPI_SANDBOX_CARD_TOKEN_VALUE');
    expect(service.wompiCustomerEmail).toBe('WOMPI_CUSTOMER_EMAIL_VALUE');
  });

  it('returns undefined for optional keys when missing', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'WOMPI_ACCEPTANCE_TOKEN' || key === 'WOMPI_SANDBOX_CARD_TOKEN') {
          return undefined;
        }
        return `${key}_VALUE`;
      }),
    } as unknown as ConfigService;
    const service = new AppConfigService(configService);

    expect(service.wompiAcceptanceToken).toBeUndefined();
    expect(service.wompiSandboxCardToken).toBeUndefined();
  });

  it('throws when a required key is missing', () => {
    const configService = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;
    const service = new AppConfigService(configService);

    expect(() => service.databaseUrl).toThrow(
      'Missing required environment variable: DATABASE_URL',
    );
  });
});
