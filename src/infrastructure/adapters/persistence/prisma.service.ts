import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(appConfigService: AppConfigService) {
    super({
      datasources: {
        db: {
          url: appConfigService.databaseUrl,
        },
      },
    });
  }

  public async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
