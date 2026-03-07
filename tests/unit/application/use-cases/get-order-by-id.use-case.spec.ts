import { GetOrderByIdUseCase } from '../../../../src/application/use-cases/get-order-by-id.use-case';
import type { OrderRepositoryPort } from '../../../../src/domain/ports/order-repository.port';
import { err, ok } from '../../../../src/shared/railway/result';

describe('GetOrderByIdUseCase', () => {
  const order = {
    id: 'o1',
    productId: 'p1',
    quantity: 1,
    amountInCents: 1000,
    currency: 'COP',
    customerEmail: 'buyer@example.com',
    wompiTransactionId: 'tx1',
    status: 'PENDING' as const,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const buildRepo = (): jest.Mocked<OrderRepositoryPort> => ({
    createPending: jest.fn(),
    findById: jest.fn(),
    findByCustomerEmail: jest.fn(),
    findDeliveryByOrderId: jest.fn(),
    findPending: jest.fn(),
    approveOrderAndDecrementStock: jest.fn(),
    updateStatus: jest.fn(),
  });

  it('returns order when found', async () => {
    const repo = buildRepo();
    repo.findById.mockResolvedValue(ok(order));
    const useCase = new GetOrderByIdUseCase(repo);

    const result = await useCase.execute('o1');

    expect(result.isOk()).toBe(true);
  });

  it('returns ORDER_NOT_FOUND when order does not exist', async () => {
    const repo = buildRepo();
    repo.findById.mockResolvedValue(ok(null));
    const useCase = new GetOrderByIdUseCase(repo);

    const result = await useCase.execute('missing');

    expect(result.isErr()).toBe(true);
    const error = result.match(
      () => null,
      (e) => e,
    );
    expect(error?.code).toBe('ORDER_NOT_FOUND');
  });

  it('propagates repository error', async () => {
    const repo = buildRepo();
    repo.findById.mockResolvedValue(
      err({ code: 'PERSISTENCE_ERROR', message: 'db failed' }),
    );
    const useCase = new GetOrderByIdUseCase(repo);

    const result = await useCase.execute('o1');

    expect(result.isErr()).toBe(true);
  });
});
