import { GetCustomerOrdersUseCase } from '../../../../src/application/use-cases/get-customer-orders.use-case';
import type { OrderRepositoryPort } from '../../../../src/domain/ports/order-repository.port';
import { err, ok } from '../../../../src/shared/railway/result';

describe('GetCustomerOrdersUseCase', () => {
  const buildRepo = (): jest.Mocked<OrderRepositoryPort> => ({
    createPending: jest.fn(),
    findById: jest.fn(),
    findByCustomerEmail: jest.fn(),
    findDeliveryByOrderId: jest.fn(),
    findPending: jest.fn(),
    approveOrderAndDecrementStock: jest.fn(),
    updateStatus: jest.fn(),
  });

  it('returns customer orders when repository succeeds', async () => {
    const repo = buildRepo();
    repo.findByCustomerEmail.mockResolvedValue(ok([]));
    const useCase = new GetCustomerOrdersUseCase(repo);

    const result = await useCase.execute('buyer@example.com');

    expect(result.isOk()).toBe(true);
    expect(repo.findByCustomerEmail).toHaveBeenCalledWith('buyer@example.com');
  });

  it('propagates repository error', async () => {
    const repo = buildRepo();
    repo.findByCustomerEmail.mockResolvedValue(
      err({ code: 'PERSISTENCE_ERROR', message: 'db failed' }),
    );
    const useCase = new GetCustomerOrdersUseCase(repo);

    const result = await useCase.execute('buyer@example.com');

    expect(result.isErr()).toBe(true);
  });
});
