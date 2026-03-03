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

const POLLING_BASE_INTERVAL_MS = 5000;
const POLLING_MAX_BACKOFF_MS = 15000;
const POLLING_TIMEOUT_MS = 60000;

interface PollerState {
  timer: NodeJS.Timeout;
  consecutiveFailures: number;
}

@Injectable()
export class WompiOrderStatusPollingService
  implements OrderStatusPollingPort, OnModuleDestroy, OnModuleInit
{
  private readonly logger = new Logger(WompiOrderStatusPollingService.name);
  private readonly activePollers = new Map<string, PollerState>();

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
    for (const state of this.activePollers.values()) {
      clearTimeout(state.timer);
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
    delayMs = POLLING_BASE_INTERVAL_MS,
  ): void {
    const timer = setTimeout(async () => {
      try {
        const elapsed = Date.now() - startedAt;

        if (elapsed >= POLLING_TIMEOUT_MS) {
          this.stop(orderId);
          this.logger.warn(
            `Polling timeout reached for order ${orderId} after ${elapsed}ms. Keeping status as PENDING.`,
          );
          return;
        }

        const transactionStatusResult =
          await this.paymentGateway.getTransactionStatus(wompiTransactionId);

        if (transactionStatusResult.isErr()) {
          const appError = transactionStatusResult.match(
            () => null,
            (error) => error,
          );
          const consecutiveFailures = this.bumpFailureCount(orderId);
          const retryDelayMs =
            this.computeRetryDelayMs(consecutiveFailures);
          this.logger.warn(
            `Polling Wompi transaction ${wompiTransactionId} failed for order ${orderId}. retryInMs=${retryDelayMs} error=${this.formatAppError(appError)}`,
          );
          this.scheduleNextPoll(
            orderId,
            wompiTransactionId,
            startedAt,
            retryDelayMs,
          );
          return;
        }
        this.resetFailureCount(orderId);
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

        this.scheduleNextPoll(
          orderId,
          wompiTransactionId,
          startedAt,
          POLLING_BASE_INTERVAL_MS,
        );
      } catch (cause) {
        const consecutiveFailures = this.bumpFailureCount(orderId);
        const retryDelayMs = this.computeRetryDelayMs(consecutiveFailures);
        this.logger.error(
          `Unexpected polling error for order ${orderId}. retryInMs=${retryDelayMs}`,
          cause instanceof Error ? cause.stack : undefined,
        );
        this.scheduleNextPoll(
          orderId,
          wompiTransactionId,
          startedAt,
          retryDelayMs,
        );
      }
    }, delayMs);

    this.setPollerState(orderId, timer);
  }

  private stop(orderId: string): void {
    const state = this.activePollers.get(orderId);
    if (!state) {
      return;
    }

    clearTimeout(state.timer);
    this.activePollers.delete(orderId);
  }

  private setPollerState(orderId: string, timer: NodeJS.Timeout): void {
    const previousState = this.activePollers.get(orderId);
    this.activePollers.set(orderId, {
      timer,
      consecutiveFailures: previousState?.consecutiveFailures ?? 0,
    });
  }

  private bumpFailureCount(orderId: string): number {
    const state = this.activePollers.get(orderId);
    if (!state) {
      return 1;
    }

    const consecutiveFailures = state.consecutiveFailures + 1;
    this.activePollers.set(orderId, {
      ...state,
      consecutiveFailures,
    });
    return consecutiveFailures;
  }

  private resetFailureCount(orderId: string): void {
    const state = this.activePollers.get(orderId);
    if (!state || state.consecutiveFailures === 0) {
      return;
    }

    this.activePollers.set(orderId, {
      ...state,
      consecutiveFailures: 0,
    });
  }

  private computeRetryDelayMs(consecutiveFailures: number): number {
    const exponent = Math.max(0, consecutiveFailures - 1);
    return Math.min(
      POLLING_BASE_INTERVAL_MS * 2 ** exponent,
      POLLING_MAX_BACKOFF_MS,
    );
  }

  private formatAppError(error: AppError | null): string {
    if (!error) {
      return 'unknown';
    }

    const details =
      error.details === undefined
        ? ''
        : ` details=${this.safeStringify(error.details)}`;

    return `code=${error.code} message="${error.message}"${details}`;
  }

  private safeStringify(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
