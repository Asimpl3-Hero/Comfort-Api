import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PRODUCT_REPOSITORY_PORT } from '../../domain/ports/product-repository.port';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port';
import { ORDER_REPOSITORY_PORT } from '../../domain/ports/order-repository.port';
import type { OrderRepositoryPort } from '../../domain/ports/order-repository.port';
import { ORDER_STATUS_POLLING_PORT } from '../../domain/ports/order-status-polling.port';
import type { OrderStatusPollingPort } from '../../domain/ports/order-status-polling.port';
import { PAYMENT_GATEWAY_PORT } from '../../domain/ports/payment-gateway.port';
import type {
  CreatedWompiTransaction,
  PaymentMethodInput,
  PaymentMethodType,
  PaymentGatewayPort,
} from '../../domain/ports/payment-gateway.port';
import type { Product } from '../../domain/entities/product.entity';
import type { Order, ShippingData } from '../../domain/entities/order.entity';
import { Money } from '../../domain/value-objects/money.vo';
import { AppError } from '../../shared/errors/app-error';
import { Result, err } from '../../shared/railway/result';
import { OrderCreatedResponseDto } from '../dto/order-created-response.dto';
import {
  CreateOrderPaymentMethodData,
  CreateOrderPaymentMethodResolver,
} from '../services/create-order-payment-method.resolver';

export interface CreateOrderInput {
  productId: string;
  quantity?: number;
  customerEmail: string;
  shippingData?: ShippingData;
  paymentMethodType?: PaymentMethodType;
  paymentMethodData?: CreateOrderPaymentMethodData;
}

interface CreateOrderContextBase {
  input: CreateOrderInput;
  quantity: number;
}

interface CreateOrderContextWithProduct extends CreateOrderContextBase {
  product: Product;
}

interface CreateOrderContextWithMoney extends CreateOrderContextWithProduct {
  money: Money;
}

interface CreateOrderContextWithPaymentMethod
  extends CreateOrderContextWithMoney {
  paymentMethod: PaymentMethodInput;
}

interface CreateOrderContextWithPayment
  extends CreateOrderContextWithPaymentMethod {
  payment: CreatedWompiTransaction;
}

interface CreateOrderContextWithOrder extends CreateOrderContextWithPayment {
  order: Order;
}

@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepository: OrderRepositoryPort,
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly paymentGateway: PaymentGatewayPort,
    @Inject(ORDER_STATUS_POLLING_PORT)
    private readonly pollingService: OrderStatusPollingPort,
    private readonly paymentMethodResolver: CreateOrderPaymentMethodResolver,
  ) {}

  public async execute(
    input: CreateOrderInput,
  ): Promise<Result<OrderCreatedResponseDto, AppError>> {
    const initialContextResult = this.validateQuantity(input).map(
      (quantity) => ({
        input,
        quantity,
      }),
    );

    const withProductResult = await initialContextResult.asyncFlatMap((ctx) =>
      this.loadProduct(ctx),
    );

    const withMoneyResult = withProductResult.flatMap((ctx) =>
      this.ensureStockAndMoney(ctx),
    );

    const withPaymentMethodResult = withMoneyResult.flatMap((ctx) =>
      this.resolvePaymentMethod(ctx),
    );

    const withPaymentResult = await withPaymentMethodResult.asyncFlatMap(
      (ctx) => this.createPayment(ctx),
    );

    const withOrderResult = await withPaymentResult.asyncFlatMap((ctx) =>
      this.createPendingOrder(ctx),
    );

    const startedPollingResult = await withOrderResult.asyncFlatMap((ctx) =>
      this.startPolling(ctx),
    );

    return startedPollingResult.map((ctx) => ({
      orderId: ctx.order.id,
      checkoutUrl: ctx.payment.checkoutUrl,
      status: ctx.order.status,
    }));
  }

  private validateQuantity(input: CreateOrderInput): Result<number, AppError> {
    const quantity = input.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'Quantity must be a positive integer.',
      });
    }

    return Result.ok(quantity);
  }

  private async loadProduct(
    ctx: CreateOrderContextBase,
  ): Promise<Result<CreateOrderContextWithProduct, AppError>> {
    const productResult = await this.productRepository.findById(
      ctx.input.productId,
    );

    return productResult.flatMap((product) => {
      if (!product) {
        return err({
          code: 'PRODUCT_NOT_FOUND',
          message: `Product ${ctx.input.productId} was not found.`,
        });
      }

      return Result.ok({
        ...ctx,
        product,
      });
    });
  }

  private ensureStockAndMoney(
    ctx: CreateOrderContextWithProduct,
  ): Result<CreateOrderContextWithMoney, AppError> {
    if (ctx.product.stock < ctx.quantity) {
      return err({
        code: 'OUT_OF_STOCK',
        message: `Product ${ctx.product.id} does not have enough stock for quantity ${ctx.quantity}.`,
      });
    }

    return Money.create(
      ctx.product.priceInCents * ctx.quantity,
      ctx.product.currency,
    ).map((money) => ({
      ...ctx,
      money,
    }));
  }

  private resolvePaymentMethod(
    ctx: CreateOrderContextWithMoney,
  ): Result<CreateOrderContextWithPaymentMethod, AppError> {
    return this.paymentMethodResolver
      .resolve(ctx.input.paymentMethodType, ctx.input.paymentMethodData)
      .map((paymentMethod) => ({
        ...ctx,
        paymentMethod,
      }));
  }

  private async createPayment(
    ctx: CreateOrderContextWithPaymentMethod,
  ): Promise<Result<CreateOrderContextWithPayment, AppError>> {
    const paymentResult = await this.paymentGateway.createTransaction({
      orderReference: randomUUID(),
      amountInCents: ctx.money.amountInCents,
      currency: ctx.money.currency,
      customerEmail: ctx.input.customerEmail,
      paymentMethod: ctx.paymentMethod,
    });

    return paymentResult.map((payment) => ({
      ...ctx,
      payment,
    }));
  }

  private async createPendingOrder(
    ctx: CreateOrderContextWithPayment,
  ): Promise<Result<CreateOrderContextWithOrder, AppError>> {
    const orderResult = await this.orderRepository.createPending({
      productId: ctx.product.id,
      quantity: ctx.quantity,
      amountInCents: ctx.money.amountInCents,
      currency: ctx.money.currency,
      wompiTransactionId: ctx.payment.transactionId,
      shippingData: ctx.input.shippingData,
    });

    return orderResult.map((order) => ({
      ...ctx,
      order,
    }));
  }

  private async startPolling(
    ctx: CreateOrderContextWithOrder,
  ): Promise<Result<CreateOrderContextWithOrder, AppError>> {
    const pollingResult = await this.pollingService.start(
      ctx.order.id,
      ctx.payment.transactionId,
    );

    return pollingResult.map(() => ctx);
  }
}
