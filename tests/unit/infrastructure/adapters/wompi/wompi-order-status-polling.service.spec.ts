import type { OrderRepositoryPort } from '../../../../../src/domain/ports/order-repository.port';
import type { PaymentGatewayPort } from '../../../../../src/domain/ports/payment-gateway.port';
import { WompiOrderStatusPollingService } from '../../../../../src/infrastructure/adapters/wompi/wompi-order-status-polling.service';
import { err, ok } from '../../../../../src/shared/railway/result';

describe('WompiOrderStatusPollingService', () => {
  const buildOrderRepository = (): jest.Mocked<OrderRepositoryPort> => ({
    createPending: jest.fn(),
    findById: jest.fn(),
    findPending: jest.fn(),
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

  it('updates order to APPROVED when gateway approves payment', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    paymentGateway.getTransactionStatus.mockResolvedValue(
      ok({ providerStatus: 'APPROVED', orderStatus: 'APPROVED' }),
    );
    orderRepository.updateStatus.mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        amountInCents: 1000,
        currency: 'COP',
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

    expect(orderRepository.updateStatus).toHaveBeenCalledWith('o1', 'APPROVED');
  });

  it('marks order as DECLINED when timeout is reached', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    paymentGateway.getTransactionStatus.mockResolvedValue(
      ok({ providerStatus: 'PENDING', orderStatus: 'PENDING' }),
    );
    orderRepository.updateStatus.mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        amountInCents: 1000,
        currency: 'COP',
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

    await jest.advanceTimersByTimeAsync(60000);

    expect(orderRepository.updateStatus).toHaveBeenCalledWith('o1', 'DECLINED');
  });

  it('does not duplicate pollers for the same order id', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    paymentGateway.getTransactionStatus.mockResolvedValue(
      ok({ providerStatus: 'APPROVED', orderStatus: 'APPROVED' }),
    );
    orderRepository.updateStatus.mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        amountInCents: 1000,
        currency: 'COP',
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

  it('retries polling when gateway status check fails', async () => {
    const orderRepository = buildOrderRepository();
    const paymentGateway = buildPaymentGateway();
    paymentGateway.getTransactionStatus
      .mockResolvedValueOnce(
        err({ code: 'PAYMENT_PROVIDER_ERROR', message: 'temporary error' }),
      )
      .mockResolvedValueOnce(
        ok({ providerStatus: 'APPROVED', orderStatus: 'APPROVED' }),
      );
    orderRepository.updateStatus.mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        amountInCents: 1000,
        currency: 'COP',
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

    await jest.advanceTimersByTimeAsync(10000);

    expect(paymentGateway.getTransactionStatus).toHaveBeenCalledTimes(2);
    expect(orderRepository.updateStatus).toHaveBeenCalledWith('o1', 'APPROVED');
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
          amountInCents: 1000,
          currency: 'COP',
          wompiTransactionId: 'tx1',
          status: 'PENDING',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    );
    paymentGateway.getTransactionStatus.mockResolvedValue(
      ok({ providerStatus: 'APPROVED', orderStatus: 'APPROVED' }),
    );
    orderRepository.updateStatus.mockResolvedValue(
      ok({
        id: 'o1',
        productId: 'p1',
        amountInCents: 1000,
        currency: 'COP',
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
    expect(orderRepository.updateStatus).toHaveBeenCalledWith('o1', 'APPROVED');
  });
});
