import { CreateOrderUseCase } from '../../../../../src/application/use-cases/create-order.use-case';
import { GetOrderByIdUseCase } from '../../../../../src/application/use-cases/get-order-by-id.use-case';
import { OrdersController } from '../../../../../src/infrastructure/adapters/http/orders.controller';
import { err, ok } from '../../../../../src/shared/railway/result';

describe('OrdersController', () => {
  const createUseCase = {
    execute: jest.fn(),
  } as unknown as CreateOrderUseCase;
  const getByIdUseCase = {
    execute: jest.fn(),
  } as unknown as GetOrderByIdUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns order creation response', async () => {
    (createUseCase.execute as jest.Mock).mockResolvedValue(
      ok({
        orderId: 'o1',
        checkoutUrl: 'https://checkout.example',
        status: 'PENDING',
      }),
    );

    const controller = new OrdersController(createUseCase, getByIdUseCase);
    const response = await controller.createOrder({
      productId: '4f3aef36-b1e6-4514-b0d5-1de4f5c8d548',
      customerEmail: 'buyer@example.com',
    });

    expect(response).toEqual({
      orderId: 'o1',
      checkoutUrl: 'https://checkout.example',
      status: 'PENDING',
    });
  });

  it('throws http exception when creation fails', async () => {
    (createUseCase.execute as jest.Mock).mockResolvedValue(
      err({ code: 'PRODUCT_NOT_FOUND', message: 'not found' }),
    );

    const controller = new OrdersController(createUseCase, getByIdUseCase);

    await expect(
      controller.createOrder({
        productId: '4f3aef36-b1e6-4514-b0d5-1de4f5c8d548',
        customerEmail: 'buyer@example.com',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns mapped order payload for get by id', async () => {
    (getByIdUseCase.execute as jest.Mock).mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        quantity: 2,
        amountInCents: 1000,
        currency: 'COP',
        wompiTransactionId: 'tx1',
        status: 'PENDING',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );

    const controller = new OrdersController(createUseCase, getByIdUseCase);
    const response = await controller.getOrderById('o1');

    expect(response).toEqual({
      id: 'o1',
      product_id: 'p1',
      quantity: 2,
      amount_in_cents: 1000,
      currency: 'COP',
      wompi_transaction_id: 'tx1',
      shipping_data: null,
      status: 'PENDING',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  it('throws http exception when get by id fails', async () => {
    (getByIdUseCase.execute as jest.Mock).mockResolvedValue(
      err({ code: 'ORDER_NOT_FOUND', message: 'missing' }),
    );

    const controller = new OrdersController(createUseCase, getByIdUseCase);

    await expect(controller.getOrderById('missing')).rejects.toMatchObject({
      status: 404,
    });
  });
});
