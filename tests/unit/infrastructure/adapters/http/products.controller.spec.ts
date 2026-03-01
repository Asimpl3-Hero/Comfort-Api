import { GetProductsUseCase } from '../../../../../src/application/use-cases/get-products.use-case';
import { ProductsController } from '../../../../../src/infrastructure/adapters/http/products.controller';
import { err, ok } from '../../../../../src/shared/railway/result';

describe('ProductsController', () => {
  it('returns mapped products from use case', async () => {
    const useCase = {
      execute: jest.fn().mockResolvedValue(
        ok([
          {
            id: 'p1',
            name: 'Product',
            description: 'Desc',
            priceInCents: 1000,
            stock: 7,
            currency: 'COP',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ]),
      ),
    } as unknown as GetProductsUseCase;

    const controller = new ProductsController(useCase);
    const response = await controller.getProducts();

    expect(response).toEqual([
      {
        id: 'p1',
        name: 'Product',
        description: 'Desc',
        price_in_cents: 1000,
        stock: 7,
        currency: 'COP',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
  });

  it('throws mapped http exception when use case returns error', async () => {
    const useCase = {
      execute: jest
        .fn()
        .mockResolvedValue(
          err({ code: 'PERSISTENCE_ERROR', message: 'db unavailable' }),
        ),
    } as unknown as GetProductsUseCase;

    const controller = new ProductsController(useCase);

    await expect(controller.getProducts()).rejects.toMatchObject({
      status: 500,
    });
  });
});
