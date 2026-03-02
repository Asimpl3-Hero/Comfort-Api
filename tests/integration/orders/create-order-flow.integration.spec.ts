import { CreateOrderUseCase } from '../../../src/application/use-cases/create-order.use-case';
import { CreateOrderPaymentMethodResolver } from '../../../src/application/services/create-order-payment-method.resolver';
import { GetOrderByIdUseCase } from '../../../src/application/use-cases/get-order-by-id.use-case';
import { buildProduct } from '../../helpers/factories/order.factory';
import {
  FixedSuccessPaymentGateway,
  InMemoryOrderRepository,
  InMemoryProductRepository,
  SpyPollingService,
} from '../../helpers/mocks/ports.mock';

describe('Order Flow Integration', () => {
  it('creates a pending order and allows reading it by id', async () => {
    const product = buildProduct();
    const productRepository = new InMemoryProductRepository([product]);
    const orderRepository = new InMemoryOrderRepository();
    const paymentGateway = new FixedSuccessPaymentGateway();
    const pollingService = new SpyPollingService();

    const createOrderUseCase = new CreateOrderUseCase(
      productRepository,
      orderRepository,
      paymentGateway,
      pollingService,
      new CreateOrderPaymentMethodResolver(),
    );
    const getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepository);

    const createResult = await createOrderUseCase.execute({
      productId: product.id,
      customerEmail: 'buyer@example.com',
      paymentMethodData: {
        cardToken: 'tok_test_card_123',
      },
    });

    expect(createResult.isOk()).toBe(true);
    const created = createResult.match(
      (value) => value,
      () => null,
    );

    expect(created).not.toBeNull();
    expect(created?.status).toBe('PENDING');
    expect(pollingService.calls).toHaveLength(1);

    const orderId = created?.orderId ?? '';
    const getResult = await getOrderByIdUseCase.execute(orderId);
    const storedOrder = getResult.match(
      (value) => value,
      () => null,
    );

    expect(storedOrder?.id).toBe(orderId);
    expect(storedOrder?.productId).toBe(product.id);
    expect(storedOrder?.status).toBe('PENDING');
  });

  it('returns PRODUCT_NOT_FOUND when product does not exist', async () => {
    const productRepository = new InMemoryProductRepository([]);
    const orderRepository = new InMemoryOrderRepository();
    const paymentGateway = new FixedSuccessPaymentGateway();
    const pollingService = new SpyPollingService();

    const createOrderUseCase = new CreateOrderUseCase(
      productRepository,
      orderRepository,
      paymentGateway,
      pollingService,
      new CreateOrderPaymentMethodResolver(),
    );

    const result = await createOrderUseCase.execute({
      productId: 'missing-product',
      customerEmail: 'buyer@example.com',
    });

    expect(result.isErr()).toBe(true);
    const error = result.match(
      () => null,
      (value) => value,
    );
    expect(error?.code).toBe('PRODUCT_NOT_FOUND');
    expect(pollingService.calls).toHaveLength(0);
  });
});
