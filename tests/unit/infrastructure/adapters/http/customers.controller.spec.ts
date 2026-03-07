import { GetCustomerOrdersUseCase } from '../../../../../src/application/use-cases/get-customer-orders.use-case';
import { CustomersController } from '../../../../../src/infrastructure/adapters/http/customers.controller';
import { err, ok } from '../../../../../src/shared/railway/result';

describe('CustomersController', () => {
  const getCustomerOrdersUseCase = {
    execute: jest.fn(),
  } as unknown as GetCustomerOrdersUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns customer profile from latest order', async () => {
    (getCustomerOrdersUseCase.execute as jest.Mock).mockResolvedValue(
      ok([
        {
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
            phone: '3001234567',
            address1: 'Street 1',
            city: 'Bogota',
            state: 'Cundinamarca',
            zip: '110111',
          },
          status: 'PENDING',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    );

    const controller = new CustomersController(getCustomerOrdersUseCase);
    const response = await controller.getCustomerProfile('buyer@example.com');

    expect(response).toEqual({
      email: 'buyer@example.com',
      full_name: 'Buyer',
      phone: '3001234567',
      last_order_id: 'o1',
      last_order_status: 'PENDING',
    });
  });

  it('returns mapped customer orders', async () => {
    (getCustomerOrdersUseCase.execute as jest.Mock).mockResolvedValue(
      ok([
        {
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
        },
      ]),
    );

    const controller = new CustomersController(getCustomerOrdersUseCase);
    const response = await controller.getCustomerOrders('buyer@example.com');

    expect(response).toEqual([
      {
        id: 'o1',
        product_id: 'p1',
        quantity: 1,
        amount_in_cents: 1000,
        currency: 'COP',
        status: 'PENDING',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
  });

  it('throws 404 when customer has no orders', async () => {
    (getCustomerOrdersUseCase.execute as jest.Mock).mockResolvedValue(ok([]));
    const controller = new CustomersController(getCustomerOrdersUseCase);

    await expect(
      controller.getCustomerProfile('missing@example.com'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('maps use case errors to http exception', async () => {
    (getCustomerOrdersUseCase.execute as jest.Mock).mockResolvedValue(
      err({ code: 'PERSISTENCE_ERROR', message: 'db failed' }),
    );
    const controller = new CustomersController(getCustomerOrdersUseCase);

    await expect(
      controller.getCustomerOrders('buyer@example.com'),
    ).rejects.toMatchObject({ status: 500 });
  });
});
