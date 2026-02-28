import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  public get databaseUrl(): string {
    return this.getOrThrow('DATABASE_URL');
  }

  public get wompiBaseUrl(): string {
    return this.getOrThrow('WOMPI_BASE_URL');
  }

  public get wompiPublicKey(): string {
    return this.getOrThrow('WOMPI_PUBLIC_KEY');
  }

  public get wompiPrivateKey(): string {
    return this.getOrThrow('WOMPI_PRIVATE_KEY');
  }

  private getOrThrow(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
  }
}
