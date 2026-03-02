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
import type { Order } from '../../domain/entities/order.entity';
import { Money } from '../../domain/value-objects/money.vo';
import { AppError } from '../../shared/errors/app-error';
import { Ok, Result, err } from '../../shared/railway/result';
import { OrderCreatedResponseDto } from '../dto/order-created-response.dto';
import {
  CreateOrderPaymentMethodData,
  CreateOrderPaymentMethodResolver,
} from '../services/create-order-payment-method.resolver';

export interface CreateOrderInput {
  productId: string;
  paymentMethodType?: PaymentMethodType;
  paymentMethodData?: CreateOrderPaymentMethodData;
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
    const productResult = await this.productRepository.findById(
      input.productId,
    );
    if (productResult.isErr()) {
      return productResult;
    }

    const productOrNotFound = productResult.flatMap((product) => {
      if (!product) {
        return err({
          code: 'PRODUCT_NOT_FOUND',
          message: `Product ${input.productId} was not found.`,
        });
      }
      return Result.ok(product);
    });

    if (productOrNotFound.isErr()) {
      return productOrNotFound;
    }
    const product = (productOrNotFound as Ok<Product>).value;

    if (product.stock <= 0) {
      return err({
        code: 'OUT_OF_STOCK',
        message: `Product ${product.id} is out of stock.`,
      });
    }

    const moneyResult = Money.create(product.priceInCents, product.currency);
    if (moneyResult.isErr()) {
      return moneyResult;
    }
    const money = (moneyResult as Ok<Money>).value;

    const paymentMethodResult = this.paymentMethodResolver.resolve(
      input.paymentMethodType,
      input.paymentMethodData,
    );
    if (paymentMethodResult.isErr()) {
      return paymentMethodResult;
    }
    const paymentMethod = (paymentMethodResult as Ok<PaymentMethodInput>).value;

    const paymentResult = await this.paymentGateway.createTransaction({
      orderReference: randomUUID(),
      amountInCents: money.amountInCents,
      currency: money.currency,
      paymentMethod,
    });
    if (paymentResult.isErr()) {
      return paymentResult;
    }
    const payment = (paymentResult as Ok<CreatedWompiTransaction>).value;

    const orderResult = await this.orderRepository.createPending({
      productId: product.id,
      amountInCents: money.amountInCents,
      currency: money.currency,
      wompiTransactionId: payment.transactionId,
    });
    if (orderResult.isErr()) {
      return orderResult;
    }
    const order = (orderResult as Ok<Order>).value;

    const pollingResult = await this.pollingService.start(
      order.id,
      payment.transactionId,
    );
    if (pollingResult.isErr()) {
      return pollingResult;
    }

    return Result.ok({
      orderId: order.id,
      checkoutUrl: payment.checkoutUrl,
      status: order.status,
    });
  }
}
