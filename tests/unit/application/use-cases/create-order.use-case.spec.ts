import { CreateOrderUseCase } from '../../../../src/application/use-cases/create-order.use-case';
import { CreateOrderPaymentMethodResolver } from '../../../../src/application/services/create-order-payment-method.resolver';
import type { ProductRepositoryPort } from '../../../../src/domain/ports/product-repository.port';
import type { OrderRepositoryPort } from '../../../../src/domain/ports/order-repository.port';
import type { PaymentGatewayPort } from '../../../../src/domain/ports/payment-gateway.port';
import type { OrderStatusPollingPort } from '../../../../src/domain/ports/order-status-polling.port';
import { err, ok } from '../../../../src/shared/railway/result';

describe('CreateOrderUseCase', () => {
  const baseProduct = {
    id: 'f8f85493-3323-46b8-a6a6-0734496d72cd',
    name: 'Test Product',
    description: 'Test product description',
    priceInCents: 15000,
    stock: 20,
    currency: 'COP',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const baseOrder = {
    id: '97fb06c8-0df9-42a5-9534-732f54a08c72',
    productId: baseProduct.id,
    amountInCents: 15000,
    currency: 'COP',
    wompiTransactionId: 'wompi_tx_123',
    status: 'PENDING' as const,
    createdAt: new Date('2026-01-01T00:01:00.000Z'),
  };

  const createMocks = () => {
    const productRepository: jest.Mocked<ProductRepositoryPort> = {
      findAll: jest.fn(),
      findById: jest.fn(),
      decrementStock: jest.fn(),
    };

    const orderRepository: jest.Mocked<OrderRepositoryPort> = {
      createPending: jest.fn(),
      findById: jest.fn(),
      findPending: jest.fn(),
      updateStatus: jest.fn(),
    };

    const paymentGateway: jest.Mocked<PaymentGatewayPort> = {
      createTransaction: jest.fn(),
      getTransactionStatus: jest.fn(),
    };

    const pollingService: jest.Mocked<OrderStatusPollingPort> = {
      start: jest.fn(),
    };

    const useCase = new CreateOrderUseCase(
      productRepository,
      orderRepository,
      paymentGateway,
      pollingService,
      new CreateOrderPaymentMethodResolver(),
    );

    return {
      useCase,
      productRepository,
      orderRepository,
      paymentGateway,
      pollingService,
    };
  };

  it('returns PRODUCT_NOT_FOUND when product does not exist', async () => {
    const { useCase, productRepository } = createMocks();
    productRepository.findById.mockResolvedValue(ok(null));

    const result = await useCase.execute({
      productId: '8f867a86-a89f-4b77-af96-8df287f4de59',
    });

    expect(result.isErr()).toBe(true);
    const error = result.match(
      () => null,
      (errValue) => errValue,
    );
    expect(error).toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
    });
  });

  it('creates an order and starts background polling', async () => {
    const {
      useCase,
      productRepository,
      orderRepository,
      paymentGateway,
      pollingService,
    } = createMocks();

    productRepository.findById.mockResolvedValue(ok(baseProduct));
    paymentGateway.createTransaction.mockResolvedValue(
      ok({
        transactionId: baseOrder.wompiTransactionId,
        checkoutUrl: 'https://checkout.wompi.co/p/?reference=abc',
        providerStatus: 'PENDING',
      }),
    );
    orderRepository.createPending.mockResolvedValue(ok(baseOrder));
    pollingService.start.mockResolvedValue(ok(undefined));

    const result = await useCase.execute({
      productId: baseProduct.id,
      paymentMethodData: {
        cardToken: 'tok_test_card_123',
      },
    });

    expect(result.isOk()).toBe(true);
    const value = result.match(
      (okValue) => okValue,
      () => null,
    );

    expect(value).toEqual({
      orderId: baseOrder.id,
      checkoutUrl: 'https://checkout.wompi.co/p/?reference=abc',
      status: 'PENDING',
    });
    expect(paymentGateway.createTransaction).toHaveBeenCalledWith({
      orderReference: expect.any(String),
      amountInCents: baseProduct.priceInCents,
      currency: baseProduct.currency,
      paymentMethod: {
        type: 'CARD',
        cardToken: 'tok_test_card_123',
        installments: 1,
      },
    });
    expect(orderRepository.createPending).toHaveBeenCalledWith({
      productId: baseProduct.id,
      amountInCents: baseProduct.priceInCents,
      currency: baseProduct.currency,
      wompiTransactionId: baseOrder.wompiTransactionId,
    });
    expect(pollingService.start).toHaveBeenCalledWith(
      baseOrder.id,
      baseOrder.wompiTransactionId,
    );
  });

  it('propagates payment provider errors', async () => {
    const { useCase, productRepository, paymentGateway, orderRepository } =
      createMocks();

    productRepository.findById.mockResolvedValue(ok(baseProduct));
    paymentGateway.createTransaction.mockResolvedValue(
      err({
        code: 'PAYMENT_PROVIDER_ERROR',
        message: 'Wompi unavailable',
      }),
    );

    const result = await useCase.execute({
      productId: baseProduct.id,
      paymentMethodData: {
        cardToken: 'tok_test_card_123',
      },
    });

    expect(result.isErr()).toBe(true);
    expect(orderRepository.createPending).not.toHaveBeenCalled();
  });

  it('returns VALIDATION_ERROR when product has invalid amount', async () => {
    const { useCase, productRepository, paymentGateway } = createMocks();

    productRepository.findById.mockResolvedValue(
      ok({
        ...baseProduct,
        priceInCents: 0,
      }),
    );

    const result = await useCase.execute({
      productId: baseProduct.id,
    });

    expect(result.isErr()).toBe(true);
    expect(paymentGateway.createTransaction).not.toHaveBeenCalled();
  });

  it('returns OUT_OF_STOCK when product stock is zero', async () => {
    const { useCase, productRepository, paymentGateway } = createMocks();

    productRepository.findById.mockResolvedValue(
      ok({
        ...baseProduct,
        stock: 0,
      }),
    );

    const result = await useCase.execute({
      productId: baseProduct.id,
    });

    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('OUT_OF_STOCK');
    expect(paymentGateway.createTransaction).not.toHaveBeenCalled();
  });

  it('returns VALIDATION_ERROR for CARD when cardToken is not provided', async () => {
    const { useCase, productRepository, paymentGateway } = createMocks();
    productRepository.findById.mockResolvedValue(ok(baseProduct));

    const result = await useCase.execute({
      productId: baseProduct.id,
      paymentMethodType: 'CARD',
      paymentMethodData: {},
    });

    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
    expect(paymentGateway.createTransaction).not.toHaveBeenCalled();
  });

  it('rejects raw card fields for CARD and requires cardToken', async () => {
    const { useCase, productRepository, paymentGateway } = createMocks();
    productRepository.findById.mockResolvedValue(ok(baseProduct));

    const result = await useCase.execute({
      productId: baseProduct.id,
      paymentMethodType: 'CARD',
      paymentMethodData: {
        cardNumber: '4242424242424242',
        cardCvc: '123',
        cardExpMonth: '12',
        cardExpYear: '29',
        cardHolder: 'Sandbox User',
      } as any,
    });

    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('VALIDATION_ERROR');
    expect(error?.message).toContain('cardToken');
    expect(paymentGateway.createTransaction).not.toHaveBeenCalled();
  });

  it('sends NEQUI method when requested', async () => {
    const {
      useCase,
      productRepository,
      orderRepository,
      paymentGateway,
      pollingService,
    } = createMocks();

    productRepository.findById.mockResolvedValue(ok(baseProduct));
    paymentGateway.createTransaction.mockResolvedValue(
      ok({
        transactionId: baseOrder.wompiTransactionId,
        checkoutUrl: null,
        providerStatus: 'PENDING',
      }),
    );
    orderRepository.createPending.mockResolvedValue(ok(baseOrder));
    pollingService.start.mockResolvedValue(ok(undefined));

    const result = await useCase.execute({
      productId: baseProduct.id,
      paymentMethodType: 'NEQUI',
      paymentMethodData: {
        phoneNumber: '3991111111',
      },
    });

    expect(result.isOk()).toBe(true);
    expect(paymentGateway.createTransaction).toHaveBeenCalledWith({
      orderReference: expect.any(String),
      amountInCents: baseProduct.priceInCents,
      currency: baseProduct.currency,
      paymentMethod: {
        type: 'NEQUI',
        phoneNumber: '3991111111',
      },
    });
  });
});
