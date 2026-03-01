import { HttpStatus } from '@nestjs/common';
import { toHttpException } from '../../../../../src/infrastructure/adapters/http/http-error.mapper';

describe('http-error.mapper', () => {
  it('maps PRODUCT_NOT_FOUND to 404', () => {
    const exception = toHttpException({
      code: 'PRODUCT_NOT_FOUND',
      message: 'not found',
    });

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('maps VALIDATION_ERROR to 400 with payload', () => {
    const exception = toHttpException({
      code: 'VALIDATION_ERROR',
      message: 'bad input',
      details: { field: 'productId' },
    });

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toEqual({
      errorCode: 'VALIDATION_ERROR',
      message: 'bad input',
      details: { field: 'productId' },
    });
  });

  it('falls back to 500 when code is unknown', () => {
    const exception = toHttpException({
      code: 'SOME_UNKNOWN_CODE' as never,
      message: 'unknown',
    });

    expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
