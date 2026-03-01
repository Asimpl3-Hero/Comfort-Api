import { GetProductsUseCase } from '../../../../src/application/use-cases/get-products.use-case';
import type { ProductRepositoryPort } from '../../../../src/domain/ports/product-repository.port';
import { err, ok } from '../../../../src/shared/railway/result';

describe('GetProductsUseCase', () => {
  it('returns products from repository', async () => {
    const repo: jest.Mocked<ProductRepositoryPort> = {
      findAll: jest.fn().mockResolvedValue(
        ok([
          {
            id: 'p1',
            name: 'Product',
            description: 'Desc',
            priceInCents: 1000,
            stock: 5,
            currency: 'COP',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ]),
      ),
      findById: jest.fn(),
      decrementStock: jest.fn(),
    };

    const useCase = new GetProductsUseCase(repo);
    const result = await useCase.execute();

    expect(repo.findAll).toHaveBeenCalledTimes(1);
    expect(result.isOk()).toBe(true);
  });

  it('propagates repository errors', async () => {
    const repo: jest.Mocked<ProductRepositoryPort> = {
      findAll: jest
        .fn()
        .mockResolvedValue(
          err({ code: 'PERSISTENCE_ERROR', message: 'db error' }),
        ),
      findById: jest.fn(),
      decrementStock: jest.fn(),
    };

    const useCase = new GetProductsUseCase(repo);
    const result = await useCase.execute();

    expect(result.isErr()).toBe(true);
  });
});
