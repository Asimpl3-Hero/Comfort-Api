import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProductsController } from '../src/infrastructure/adapters/http/products.controller';
import { GetProductsUseCase } from '../src/application/use-cases/get-products.use-case';
import { PRODUCT_REPOSITORY_PORT } from '../src/domain/ports/product-repository.port';
import type { ProductRepositoryPort } from '../src/domain/ports/product-repository.port';
import { ok } from '../src/shared/railway/result';

describe('ProductsController (e2e)', () => {
  let app: INestApplication<App>;
  const productRepositoryMock: jest.Mocked<ProductRepositoryPort> = {
    findAll: jest.fn(),
    findById: jest.fn(),
  };

  beforeAll(async () => {
    productRepositoryMock.findAll.mockResolvedValue(
      ok([
        {
          id: '53ca8c5d-8e2b-4740-aa07-f5d5f42d2554',
          name: 'Mock Product',
          description: 'Mocked for e2e',
          priceInCents: 10000,
          currency: 'COP',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        GetProductsUseCase,
        {
          provide: PRODUCT_REPOSITORY_PORT,
          useValue: productRepositoryMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
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
          currency: 'COP',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ]);
  });
});
