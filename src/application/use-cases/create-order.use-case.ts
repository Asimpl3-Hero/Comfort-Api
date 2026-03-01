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

export interface CreateOrderInput {
  productId: string;
  paymentMethodType?: PaymentMethodType;
  paymentMethodData?: {
    phoneNumber?: string;
    userType?: number;
    userLegalIdType?: 'CC' | 'NIT';
    userLegalId?: string;
    financialInstitutionCode?: string;
    paymentDescription?: string;
    sandboxStatus?: 'APPROVED' | 'DECLINED';
  };
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

    const paymentMethodResult = this.resolvePaymentMethod(input);
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

  private resolvePaymentMethod(
    input: CreateOrderInput,
  ): Result<PaymentMethodInput, AppError> {
    const methodType = input.paymentMethodType ?? 'CARD';
    const data = input.paymentMethodData;

    if (methodType === 'CARD') {
      return Result.ok({
        type: 'CARD',
      });
    }

    if (methodType === 'NEQUI') {
      const phoneNumber = data?.phoneNumber?.trim();
      if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'Nequi phone number must have exactly 10 digits.',
        });
      }

      return Result.ok({
        type: 'NEQUI',
        phoneNumber,
      });
    }

    if (methodType === 'PSE') {
      const userType = data?.userType;
      const userLegalIdType = data?.userLegalIdType;
      const userLegalId = data?.userLegalId?.trim();
      const financialInstitutionCode = data?.financialInstitutionCode?.trim();
      const paymentDescription = data?.paymentDescription?.trim();

      if (userType !== 0 && userType !== 1) {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'PSE userType must be 0 (natural) or 1 (legal).',
        });
      }
      if (userLegalIdType !== 'CC' && userLegalIdType !== 'NIT') {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'PSE userLegalIdType must be CC or NIT.',
        });
      }
      if (!userLegalId) {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'PSE userLegalId is required.',
        });
      }
      if (!financialInstitutionCode) {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'PSE financialInstitutionCode is required.',
        });
      }
      if (!paymentDescription || paymentDescription.length > 30) {
        return err({
          code: 'VALIDATION_ERROR',
          message:
            'PSE paymentDescription is required and must be at most 30 characters.',
        });
      }

      return Result.ok({
        type: 'PSE',
        userType,
        userLegalIdType,
        userLegalId,
        financialInstitutionCode,
        paymentDescription,
      });
    }

    if (methodType === 'BANCOLOMBIA_TRANSFER') {
      const paymentDescription = data?.paymentDescription?.trim();
      if (!paymentDescription || paymentDescription.length > 64) {
        return err({
          code: 'VALIDATION_ERROR',
          message:
            'Bancolombia paymentDescription is required and must be at most 64 characters.',
        });
      }

      return Result.ok({
        type: 'BANCOLOMBIA_TRANSFER',
        paymentDescription,
        sandboxStatus: data?.sandboxStatus,
      });
    }

    return err({
      code: 'VALIDATION_ERROR',
      message: `Unsupported payment method: ${methodType}`,
    });
  }
}
