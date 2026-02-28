import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  ORDER_REPOSITORY_PORT,
} from '../../../domain/ports/order-repository.port';
import type { OrderRepositoryPort } from '../../../domain/ports/order-repository.port';
import {
  PAYMENT_GATEWAY_PORT,
} from '../../../domain/ports/payment-gateway.port';
import type { PaymentGatewayPort } from '../../../domain/ports/payment-gateway.port';
import type { WompiTransactionStatus } from '../../../domain/ports/payment-gateway.port';
import type { OrderStatusPollingPort } from '../../../domain/ports/order-status-polling.port';
import { AppError } from '../../../shared/errors/app-error';
import { Ok, Result, ok } from '../../../shared/railway/result';

const POLLING_INTERVAL_MS = 5000;
const POLLING_TIMEOUT_MS = 60000;

@Injectable()
export class WompiOrderStatusPollingService
  implements OrderStatusPollingPort, OnModuleDestroy
{
  private readonly logger = new Logger(WompiOrderStatusPollingService.name);
  private readonly activePollers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepository: OrderRepositoryPort,
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly paymentGateway: PaymentGatewayPort,
  ) {}

  public async start(
    orderId: string,
    wompiTransactionId: string,
  ): Promise<Result<void, AppError>> {
    if (this.activePollers.has(orderId)) {
      return ok(undefined);
    }

    const startedAt = Date.now();
    const timer = setInterval(async () => {
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
        return;
      }
      const transactionStatus =
        (transactionStatusResult as Ok<WompiTransactionStatus>).value;

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
        }
      }
    }, POLLING_INTERVAL_MS);

    this.activePollers.set(orderId, timer);
    return ok(undefined);
  }

  public onModuleDestroy(): void {
    for (const timer of this.activePollers.values()) {
      clearInterval(timer);
    }

    this.activePollers.clear();
  }

  private stop(orderId: string): void {
    const timer = this.activePollers.get(orderId);
    if (!timer) {
      return;
    }

    clearInterval(timer);
    this.activePollers.delete(orderId);
  }
}
