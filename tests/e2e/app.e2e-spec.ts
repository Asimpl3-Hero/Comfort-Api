import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PRODUCT_REPOSITORY_PORT } from '../../src/domain/ports/product-repository.port';
import { ORDER_REPOSITORY_PORT } from '../../src/domain/ports/order-repository.port';
import { PAYMENT_GATEWAY_PORT } from '../../src/domain/ports/payment-gateway.port';
import { ORDER_STATUS_POLLING_PORT } from '../../src/domain/ports/order-status-polling.port';
import type { ProductRepositoryPort } from '../../src/domain/ports/product-repository.port';
import type { OrderRepositoryPort } from '../../src/domain/ports/order-repository.port';
import type { PaymentGatewayPort } from '../../src/domain/ports/payment-gateway.port';
import type { OrderStatusPollingPort } from '../../src/domain/ports/order-status-polling.port';
import { PrismaService } from '../../src/infrastructure/adapters/persistence/prisma.service';
import { ok } from '../../src/shared/railway/result';

describe('ProductsController (e2e)', () => {
  let app: INestApplication<App>;
  const productRepositoryMock: jest.Mocked<ProductRepositoryPort> = {
    findAll: jest.fn(),
    findById: jest.fn(),
    decrementStock: jest.fn(),
  };
  const orderRepositoryMock: jest.Mocked<OrderRepositoryPort> = {
    createPending: jest.fn(),
    findById: jest.fn(),
    findPending: jest.fn(),
    updateStatus: jest.fn(),
  };
  const paymentGatewayMock: jest.Mocked<PaymentGatewayPort> = {
    createTransaction: jest.fn(),
    getTransactionStatus: jest.fn(),
  };
  const pollingMock: jest.Mocked<OrderStatusPollingPort> = {
    start: jest.fn(),
  };
  const prismaMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  beforeAll(async () => {
    productRepositoryMock.findAll.mockResolvedValue(
      ok([
        {
          id: '53ca8c5d-8e2b-4740-aa07-f5d5f42d2554',
          name: 'Mock Product',
          description: 'Mocked for e2e',
          priceInCents: 10000,
          imageUrl: 'https://placehold.co/640x860/png?text=Mock+Product',
          stock: 4,
          currency: 'COP',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    );
    orderRepositoryMock.findPending.mockResolvedValue(ok([]));

    const moduleBuilder = Test.createTestingModule({
      imports: [AppModule],
    });

    moduleBuilder
      .overrideProvider(PRODUCT_REPOSITORY_PORT)
      .useValue(productRepositoryMock);
    moduleBuilder
      .overrideProvider(ORDER_REPOSITORY_PORT)
      .useValue(orderRepositoryMock);
    moduleBuilder
      .overrideProvider(PAYMENT_GATEWAY_PORT)
      .useValue(paymentGatewayMock);
    moduleBuilder
      .overrideProvider(ORDER_STATUS_POLLING_PORT)
      .useValue(pollingMock);
    moduleBuilder.overrideProvider(PrismaService).useValue(prismaMock);

    const moduleFixture: TestingModule = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/products (GET)', () => {
    return request(app.getHttpServer())
      .get('/products')
      .expect(200)
      .expect([
        {
          id: '53ca8c5d-8e2b-4740-aa07-f5d5f42d2554',
          name: 'Mock Product',
          description: 'Mocked for e2e',
          price_in_cents: 10000,
          image_url: 'https://placehold.co/640x860/png?text=Mock+Product',
          imageUrl: 'https://placehold.co/640x860/png?text=Mock+Product',
          stock: 4,
          currency: 'COP',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ]);
  });

  it('/health (GET)', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
      }),
    );
    expect(typeof response.body.timestamp).toBe('string');
    expect(typeof response.body.uptime_in_seconds).toBe('number');
  });

  it('/orders (POST) should validate uuid and return 400 on invalid payload', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .send({ productId: 'not-a-uuid' })
      .expect(400);
  });

  it('/orders (POST) should reject raw card fields and require cardToken for CARD', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .send({
        productId: '53ca8c5d-8e2b-4740-aa07-f5d5f42d2554',
        customerEmail: 'buyer@example.com',
        paymentMethodType: 'CARD',
        paymentMethodData: {
          cardNumber: '4242424242424242',
        },
      })
      .expect(400);
  });
});
