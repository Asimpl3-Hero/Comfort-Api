import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case';
import { GetOrderByIdUseCase } from './application/use-cases/get-order-by-id.use-case';
import { GetProductsUseCase } from './application/use-cases/get-products.use-case';
import { OrderStatusService } from './domain/services/order-status.service';
import { ProductsController } from './infrastructure/adapters/http/products.controller';
import { OrdersController } from './infrastructure/adapters/http/orders.controller';
import { PrismaOrderRepositoryAdapter } from './infrastructure/adapters/persistence/prisma-order.repository.adapter';
import { PrismaProductRepositoryAdapter } from './infrastructure/adapters/persistence/prisma-product.repository.adapter';
import { PrismaService } from './infrastructure/adapters/persistence/prisma.service';
import { WompiOrderStatusPollingService } from './infrastructure/adapters/wompi/wompi-order-status-polling.service';
import { WompiAdapter } from './infrastructure/adapters/wompi/wompi.adapter';
import { AppConfigService } from './infrastructure/config/app-config.service';
import { PRODUCT_REPOSITORY_PORT } from './domain/ports/product-repository.port';
import { ORDER_REPOSITORY_PORT } from './domain/ports/order-repository.port';
import { PAYMENT_GATEWAY_PORT } from './domain/ports/payment-gateway.port';
import { ORDER_STATUS_POLLING_PORT } from './domain/ports/order-status-polling.port';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [ProductsController, OrdersController],
  providers: [
    AppConfigService,
    PrismaService,
    CreateOrderUseCase,
    GetProductsUseCase,
    GetOrderByIdUseCase,
    {
      provide: PRODUCT_REPOSITORY_PORT,
      useClass: PrismaProductRepositoryAdapter,
    },
    {
      provide: ORDER_REPOSITORY_PORT,
      useClass: PrismaOrderRepositoryAdapter,
    },
    {
      provide: PAYMENT_GATEWAY_PORT,
      useClass: WompiAdapter,
    },
    {
      provide: ORDER_STATUS_POLLING_PORT,
      useClass: WompiOrderStatusPollingService,
    },
    {
      provide: OrderStatusService,
      useValue: new OrderStatusService(),
    },
  ],
})
export class AppModule {}
