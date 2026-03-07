import { HttpException, HttpStatus } from '@nestjs/common';
import { AppError } from '../../../shared/errors/app-error';

const STATUS_BY_CODE: Record<AppError['code'], HttpStatus> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  PRODUCT_NOT_FOUND: HttpStatus.NOT_FOUND,
  OUT_OF_STOCK: HttpStatus.CONFLICT,
  ORDER_NOT_FOUND: HttpStatus.NOT_FOUND,
  CUSTOMER_NOT_FOUND: HttpStatus.NOT_FOUND,
  DELIVERY_NOT_FOUND: HttpStatus.NOT_FOUND,
  PAYMENT_PROVIDER_ERROR: HttpStatus.BAD_GATEWAY,
  PERSISTENCE_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
  POLLING_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

export const toHttpException = (error: AppError): HttpException => {
  const response: {
    errorCode: string;
    message: string;
    details?: unknown;
  } = {
    errorCode: error.code,
    message: error.message,
  };

  if (error.code === 'VALIDATION_ERROR' && error.details !== undefined) {
    response.details = error.details;
  }

  return new HttpException(
    response,
    STATUS_BY_CODE[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR,
  );
};
