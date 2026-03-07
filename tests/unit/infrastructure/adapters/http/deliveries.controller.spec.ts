import { GetDeliveryByOrderIdUseCase } from '../../../../../src/application/use-cases/get-delivery-by-order-id.use-case';
import { GetOrderByIdUseCase } from '../../../../../src/application/use-cases/get-order-by-id.use-case';
import { DeliveriesController } from '../../../../../src/infrastructure/adapters/http/deliveries.controller';
import { err, ok } from '../../../../../src/shared/railway/result';

describe('DeliveriesController', () => {
  const getDeliveryByOrderIdUseCase = {
    execute: jest.fn(),
  } as unknown as GetDeliveryByOrderIdUseCase;
  const getOrderByIdUseCase = {
    execute: jest.fn(),
  } as unknown as GetOrderByIdUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns delivery payload', async () => {
    (getOrderByIdUseCase.execute as jest.Mock).mockResolvedValue(
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
    (getDeliveryByOrderIdUseCase.execute as jest.Mock).mockResolvedValue(
      ok({
        fullName: 'Buyer',
        email: 'buyer@example.com',
        address1: 'Street 1',
        city: 'Bogota',
        state: 'Cundinamarca',
        zip: '110111',
      }),
    );

    const controller = new DeliveriesController(
      getDeliveryByOrderIdUseCase,
      getOrderByIdUseCase,
    );
    const response = await controller.getDeliveryByOrderId(
      '97fb06c8-0df9-42a5-9534-732f54a08c72',
    );

    expect(response).toEqual({
      order_id: '97fb06c8-0df9-42a5-9534-732f54a08c72',
      status: 'PENDING',
      shipping_data: {
        fullName: 'Buyer',
        email: 'buyer@example.com',
        address1: 'Street 1',
        city: 'Bogota',
        state: 'Cundinamarca',
        zip: '110111',
      },
    });
  });

  it('maps order errors to http exception', async () => {
    (getOrderByIdUseCase.execute as jest.Mock).mockResolvedValue(
      err({ code: 'ORDER_NOT_FOUND', message: 'missing' }),
    );
    (getDeliveryByOrderIdUseCase.execute as jest.Mock).mockResolvedValue(
      err({ code: 'DELIVERY_NOT_FOUND', message: 'missing delivery' }),
    );

    const controller = new DeliveriesController(
      getDeliveryByOrderIdUseCase,
      getOrderByIdUseCase,
    );

    await expect(
      controller.getDeliveryByOrderId('97fb06c8-0df9-42a5-9534-732f54a08c72'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('maps delivery errors to http exception', async () => {
    (getOrderByIdUseCase.execute as jest.Mock).mockResolvedValue(
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
    (getDeliveryByOrderIdUseCase.execute as jest.Mock).mockResolvedValue(
      err({ code: 'DELIVERY_NOT_FOUND', message: 'missing delivery' }),
    );

    const controller = new DeliveriesController(
      getDeliveryByOrderIdUseCase,
      getOrderByIdUseCase,
    );

    await expect(
      controller.getDeliveryByOrderId('97fb06c8-0df9-42a5-9534-732f54a08c72'),
    ).rejects.toMatchObject({ status: 404 });
  });
});
