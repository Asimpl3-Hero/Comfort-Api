import type { OrderRepositoryPort } from '../../../../../src/domain/ports/order-repository.port';
import type { PaymentGatewayPort } from '../../../../../src/domain/ports/payment-gateway.port';
import { WompiOrderStatusPollingService } from '../../../../../src/infrastructure/adapters/wompi/wompi-order-status-polling.service';
import { err, ok } from '../../../../../src/shared/railway/result';

describe('WompiOrderStatusPollingService', () => {
  const buildOrderRepository = (): jest.Mocked<OrderRepositoryPort> => ({
    createPending: jest.fn(),
    findById: jest.fn(),
    findByCustomerEmail: jest.fn(),
    findDeliveryByOrderId: jest.fn(),
    findPending: jest.fn(),
    approveOrderAndDecrementStock: jest.fn(),
    updateStatus: jest.fn(),
  });

  const buildPaymentGateway = (): jest.Mocked<PaymentGatewayPort> => ({
    createTransaction: jest.fn(),
    getTransactionStatus: jest.fn(),
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('finalizes order atomically when gateway approves payment', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    paymentGateway.getTransactionStatus.mockResolvedValue(
      ok({ providerStatus: 'APPROVED', orderStatus: 'APPROVED' }),
    );
    orderRepository.approveOrderAndDecrementStock.mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        quantity: 2,
        amountInCents: 1000,
        currency: 'COP',
        customerEmail: 'buyer@example.com',
        wompiTransactionId: 'tx1',
        status: 'APPROVED',
        createdAt: new Date(),
      }),
    );

    const service = new WompiOrderStatusPollingService(
      orderRepository,
      paymentGateway,
    );
    await service.start('o1', 'tx1');

    await jest.advanceTimersByTimeAsync(5000);

    expect(orderRepository.approveOrderAndDecrementStock).toHaveBeenCalledWith(
      'o1',
    );
    expect(orderRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('updates order to DECLINED when gateway declines payment', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    paymentGateway.getTransactionStatus.mockResolvedValue(
      ok({ providerStatus: 'DECLINED', orderStatus: 'DECLINED' }),
    );
    orderRepository.updateStatus.mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        quantity: 1,
        amountInCents: 1000,
        currency: 'COP',
        customerEmail: 'buyer@example.com',
        wompiTransactionId: 'tx1',
        status: 'DECLINED',
        createdAt: new Date(),
      }),
    );

    const service = new WompiOrderStatusPollingService(
      orderRepository,
      paymentGateway,
    );

    await service.start('o1', 'tx1');
    await jest.advanceTimersByTimeAsync(5000);

    expect(orderRepository.updateStatus).toHaveBeenCalledWith('o1', 'DECLINED');
    expect(
      orderRepository.approveOrderAndDecrementStock,
    ).not.toHaveBeenCalled();
  });

  it('stops polling after timeout without forcing DECLINED', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    paymentGateway.getTransactionStatus.mockResolvedValue(
      ok({ providerStatus: 'PENDING', orderStatus: 'PENDING' }),
    );
    const service = new WompiOrderStatusPollingService(
      orderRepository,
      paymentGateway,
    );
    await service.start('o1', 'tx1');

    await jest.advanceTimersByTimeAsync(60000);

    expect(orderRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not duplicate pollers for the same order id', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    paymentGateway.getTransactionStatus.mockResolvedValue(
      ok({ providerStatus: 'APPROVED', orderStatus: 'APPROVED' }),
    );
    orderRepository.approveOrderAndDecrementStock.mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        quantity: 1,
        amountInCents: 1000,
        currency: 'COP',
        customerEmail: 'buyer@example.com',
        wompiTransactionId: 'tx1',
        status: 'APPROVED',
        createdAt: new Date(),
      }),
    );

    const service = new WompiOrderStatusPollingService(
      orderRepository,
      paymentGateway,
    );

    await service.start('o1', 'tx1');
    await service.start('o1', 'tx1');
    await jest.advanceTimersByTimeAsync(5000);

    expect(paymentGateway.getTransactionStatus).toHaveBeenCalledTimes(1);
  });

  it('retries polling with backoff when gateway status check fails', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    paymentGateway.getTransactionStatus
      .mockResolvedValueOnce(
        err({ code: 'PAYMENT_PROVIDER_ERROR', message: 'temporary error' }),
      )
      .mockResolvedValueOnce(
        err({ code: 'PAYMENT_PROVIDER_ERROR', message: 'temporary error 2' }),
      )
      .mockResolvedValueOnce(
        ok({ providerStatus: 'APPROVED', orderStatus: 'APPROVED' }),
      );
    orderRepository.approveOrderAndDecrementStock.mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        quantity: 1,
        amountInCents: 1000,
        currency: 'COP',
        customerEmail: 'buyer@example.com',
        wompiTransactionId: 'tx1',
        status: 'APPROVED',
        createdAt: new Date(),
      }),
    );

    const service = new WompiOrderStatusPollingService(
      orderRepository,
      paymentGateway,
    );
    await service.start('o1', 'tx1');

    await jest.advanceTimersByTimeAsync(15000);
    expect(paymentGateway.getTransactionStatus).toHaveBeenCalledTimes(2);
    expect(
      orderRepository.approveOrderAndDecrementStock,
    ).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(5000);
    expect(paymentGateway.getTransactionStatus).toHaveBeenCalledTimes(3);
    expect(orderRepository.approveOrderAndDecrementStock).toHaveBeenCalledWith(
      'o1',
    );
  });

  it('stops polling after 5 failed retries', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    paymentGateway.getTransactionStatus.mockResolvedValue(
      err({ code: 'PAYMENT_PROVIDER_ERROR', message: 'temporary error' }),
    );

    const service = new WompiOrderStatusPollingService(
      orderRepository,
      paymentGateway,
    );
    await service.start('o1', 'tx1');

    await jest.advanceTimersByTimeAsync(70000);

    expect(paymentGateway.getTransactionStatus).toHaveBeenCalledTimes(5);
    expect(orderRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('handles pending-order rehydration failure gracefully', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    orderRepository.findPending.mockResolvedValue(
      err({ code: 'PERSISTENCE_ERROR', message: 'db failed' }),
    );

    const service = new WompiOrderStatusPollingService(
      orderRepository,
      paymentGateway,
    );

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(orderRepository.findPending).toHaveBeenCalledTimes(1);
  });

  it('rehydrates pending orders on module init', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    orderRepository.findPending.mockResolvedValue(
      ok([
        {
          id: 'o1',
          productId: 'p1',
          quantity: 1,
          amountInCents: 1000,
          currency: 'COP',
          customerEmail: 'buyer@example.com',
          wompiTransactionId: 'tx1',
          status: 'PENDING',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    );
    paymentGateway.getTransactionStatus.mockResolvedValue(
      ok({ providerStatus: 'APPROVED', orderStatus: 'APPROVED' }),
    );
    orderRepository.approveOrderAndDecrementStock.mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        quantity: 1,
        amountInCents: 1000,
        currency: 'COP',
        customerEmail: 'buyer@example.com',
        wompiTransactionId: 'tx1',
        status: 'APPROVED',
        createdAt: new Date(),
      }),
    );

    const service = new WompiOrderStatusPollingService(
      orderRepository,
      paymentGateway,
    );

    await service.onModuleInit();
    await jest.advanceTimersByTimeAsync(5000);

    expect(orderRepository.findPending).toHaveBeenCalledTimes(1);
    expect(orderRepository.approveOrderAndDecrementStock).toHaveBeenCalledWith(
      'o1',
    );
  });

  it('handles approval finalization failures without crashing', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    paymentGateway.getTransactionStatus.mockResolvedValue(
      ok({ providerStatus: 'APPROVED', orderStatus: 'APPROVED' }),
    );
    orderRepository.approveOrderAndDecrementStock.mockResolvedValue(
      err({ code: 'OUT_OF_STOCK', message: 'no units left' }),
    );

    const service = new WompiOrderStatusPollingService(
      orderRepository,
      paymentGateway,
    );

    await service.start('o1', 'tx1');
    await expect(jest.advanceTimersByTimeAsync(5000)).resolves.toBeUndefined();
  });

  it('retries when polling throws unexpectedly', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    paymentGateway.getTransactionStatus
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(
        ok({ providerStatus: 'APPROVED', orderStatus: 'APPROVED' }),
      );
    orderRepository.approveOrderAndDecrementStock.mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        quantity: 1,
        amountInCents: 1000,
        currency: 'COP',
        customerEmail: 'buyer@example.com',
        wompiTransactionId: 'tx1',
        status: 'APPROVED',
        createdAt: new Date(),
      }),
    );

    const service = new WompiOrderStatusPollingService(
      orderRepository,
      paymentGateway,
    );

    await service.start('o1', 'tx1');
    await jest.advanceTimersByTimeAsync(5000);
    await jest.advanceTimersByTimeAsync(5000);

    expect(paymentGateway.getTransactionStatus).toHaveBeenCalledTimes(2);
    expect(orderRepository.approveOrderAndDecrementStock).toHaveBeenCalledWith(
      'o1',
    );
  });
});
