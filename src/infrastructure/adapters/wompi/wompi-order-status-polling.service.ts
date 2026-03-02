import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ORDER_REPOSITORY_PORT } from '../../../domain/ports/order-repository.port';
import type { OrderRepositoryPort } from '../../../domain/ports/order-repository.port';
import { PRODUCT_REPOSITORY_PORT } from '../../../domain/ports/product-repository.port';
import type { ProductRepositoryPort } from '../../../domain/ports/product-repository.port';
import { PAYMENT_GATEWAY_PORT } from '../../../domain/ports/payment-gateway.port';
import type { PaymentGatewayPort } from '../../../domain/ports/payment-gateway.port';
import type { WompiTransactionStatus } from '../../../domain/ports/payment-gateway.port';
import type { OrderStatusPollingPort } from '../../../domain/ports/order-status-polling.port';
import { AppError } from '../../../shared/errors/app-error';
import { Ok, Result, err, ok } from '../../../shared/railway/result';

const POLLING_INTERVAL_MS = 5000;
const POLLING_TIMEOUT_MS = 60000;

@Injectable()
export class WompiOrderStatusPollingService
  implements OrderStatusPollingPort, OnModuleDestroy, OnModuleInit
{
  private readonly logger = new Logger(WompiOrderStatusPollingService.name);
  private readonly activePollers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepository: OrderRepositoryPort,
    @Inject(PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly paymentGateway: PaymentGatewayPort,
  ) {}

  public async start(
    orderId: string,
    wompiTransactionId: string,
  ): Promise<Result<void, AppError>> {
    return this.startInternal(orderId, wompiTransactionId, Date.now());
  }

  public async onModuleInit(): Promise<void> {
    const pendingOrdersResult = await this.orderRepository.findPending();
    if (pendingOrdersResult.isErr()) {
      this.logger.error('Failed to rehydrate pending orders for polling.');
      return;
    }

    const pendingOrders = pendingOrdersResult.match(
      (orders) => orders,
      () => [],
    );

    for (const order of pendingOrders) {
      const resumed = await this.startInternal(
        order.id,
        order.wompiTransactionId,
        order.createdAt.getTime(),
      );
      if (resumed.isErr()) {
        this.logger.warn(`Could not resume polling for order ${order.id}.`);
      }
    }
  }

  public onModuleDestroy(): void {
    for (const timer of this.activePollers.values()) {
      clearTimeout(timer);
    }

    this.activePollers.clear();
  }

  private async startInternal(
    orderId: string,
    wompiTransactionId: string,
    startedAt: number,
  ): Promise<Result<void, AppError>> {
    if (this.activePollers.has(orderId)) {
      return ok(undefined);
    }

    try {
      this.scheduleNextPoll(orderId, wompiTransactionId, startedAt);
      return ok(undefined);
    } catch (cause) {
      return err({
        code: 'POLLING_ERROR',
        message: 'Failed to initialize polling.',
        details: cause,
      });
    }
  }

  private scheduleNextPoll(
    orderId: string,
    wompiTransactionId: string,
    startedAt: number,
  ): void {
    const timer = setTimeout(async () => {
      try {
        const elapsed = Date.now() - startedAt;

        if (elapsed >= POLLING_TIMEOUT_MS) {
          this.stop(orderId);
          const timeoutUpdateResult = await this.orderRepository.updateStatus(
            orderId,
            'DECLINED',
          );

          if (timeoutUpdateResult.isErr()) {
            this.logger.error(
              `Failed to set order ${orderId} as DECLINED after polling timeout.`,
            );
          }

          return;
        }

        const transactionStatusResult =
          await this.paymentGateway.getTransactionStatus(wompiTransactionId);

        if (transactionStatusResult.isErr()) {
          this.logger.warn(
            `Polling Wompi transaction ${wompiTransactionId} failed for order ${orderId}.`,
          );
          this.scheduleNextPoll(orderId, wompiTransactionId, startedAt);
          return;
        }
        const transactionStatus = (
          transactionStatusResult as Ok<WompiTransactionStatus>
        ).value;

        const orderStatus = transactionStatus.orderStatus;

        if (orderStatus === 'APPROVED' || orderStatus === 'DECLINED') {
          this.stop(orderId);

          const updateResult = await this.orderRepository.updateStatus(
            orderId,
            orderStatus,
          );

          if (updateResult.isErr()) {
            this.logger.error(
              `Failed to update order ${orderId} with status ${orderStatus}.`,
            );
            return;
          }

          if (orderStatus === 'APPROVED') {
            const updatedOrder = updateResult.match(
              (order) => order,
              () => null,
            );

            if (updatedOrder) {
              const stockResult = await this.productRepository.decrementStock(
                updatedOrder.productId,
                updatedOrder.quantity,
              );

              if (stockResult.isErr()) {
                this.logger.error(
                  `Failed to decrement stock for product ${updatedOrder.productId} after approving order ${orderId}.`,
                );
              }
            }
          }
          return;
        }

        this.scheduleNextPoll(orderId, wompiTransactionId, startedAt);
      } catch (cause) {
        this.logger.error(
          `Unexpected polling error for order ${orderId}.`,
          cause instanceof Error ? cause.stack : undefined,
        );
        this.scheduleNextPoll(orderId, wompiTransactionId, startedAt);
      }
    }, POLLING_INTERVAL_MS);

    this.activePollers.set(orderId, timer);
  }

  private stop(orderId: string): void {
    const timer = this.activePollers.get(orderId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.activePollers.delete(orderId);
  }
}
