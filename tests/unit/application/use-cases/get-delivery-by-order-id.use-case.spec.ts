import { GetDeliveryByOrderIdUseCase } from '../../../../src/application/use-cases/get-delivery-by-order-id.use-case';
import type { OrderRepositoryPort } from '../../../../src/domain/ports/order-repository.port';
import { err, ok } from '../../../../src/shared/railway/result';

describe('GetDeliveryByOrderIdUseCase', () => {
  const buildRepo = (): jest.Mocked<OrderRepositoryPort> => ({
    createPending: jest.fn(),
    findById: jest.fn(),
    findByCustomerEmail: jest.fn(),
    findDeliveryByOrderId: jest.fn(),
    findPending: jest.fn(),
    approveOrderAndDecrementStock: jest.fn(),
    updateStatus: jest.fn(),
  });

  it('returns delivery when order has shipping data', async () => {
    const repo = buildRepo();
    repo.findById.mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        quantity: 1,
        amountInCents: 1000,
        currency: 'COP',
        customerEmail: 'buyer@example.com',
        wompiTransactionId: 'tx1',
        shippingData: {
          fullName: 'Buyer',
          email: 'buyer@example.com',
          address1: 'Street 1',
          city: 'Bogota',
          state: 'Cundinamarca',
          zip: '110111',
        },
        status: 'PENDING',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );
    const useCase = new GetDeliveryByOrderIdUseCase(repo);

    const result = await useCase.execute('o1');

    expect(result.isOk()).toBe(true);
  });

  it('returns ORDER_NOT_FOUND when order is missing', async () => {
    const repo = buildRepo();
    repo.findById.mockResolvedValue(ok(null));
    const useCase = new GetDeliveryByOrderIdUseCase(repo);

    const result = await useCase.execute('missing');

    expect(result.isErr()).toBe(true);
    expect(
      result.match(
        () => null,
        (error) => error.code,
      ),
    ).toBe('ORDER_NOT_FOUND');
  });

  it('returns DELIVERY_NOT_FOUND when order has no shipping data', async () => {
    const repo = buildRepo();
    repo.findById.mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        quantity: 1,
        amountInCents: 1000,
        currency: 'COP',
        customerEmail: 'buyer@example.com',
        wompiTransactionId: 'tx1',
        status: 'PENDING',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );
    const useCase = new GetDeliveryByOrderIdUseCase(repo);

    const result = await useCase.execute('o1');

    expect(result.isErr()).toBe(true);
    expect(
      result.match(
        () => null,
        (error) => error.code,
      ),
    ).toBe('DELIVERY_NOT_FOUND');
  });

  it('propagates repository errors', async () => {
    const repo = buildRepo();
    repo.findById.mockResolvedValue(
      err({ code: 'PERSISTENCE_ERROR', message: 'db failed' }),
    );
    const useCase = new GetDeliveryByOrderIdUseCase(repo);

    const result = await useCase.execute('o1');
    expect(result.isErr()).toBe(true);
  });
});
