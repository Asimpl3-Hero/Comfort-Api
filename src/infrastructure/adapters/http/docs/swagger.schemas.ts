export const APP_ERROR_SCHEMA = {
  type: 'object',
  properties: {
    errorCode: {
      type: 'string',
      example: 'VALIDATION_ERROR',
    },
    message: {
      type: 'string',
      example: 'Validation failed for request payload.',
    },
    details: {
      nullable: true,
      oneOf: [{ type: 'object' }, { type: 'array' }, { type: 'string' }],
    },
  },
  required: ['errorCode', 'message'],
};

export const PRODUCT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: 'string' },
    price_in_cents: { type: 'integer', example: 12900 },
    image_url: {
      type: 'string',
      example: 'https://picsum.photos/seed/product/640/640',
    },
    imageUrl: {
      type: 'string',
      example: 'https://picsum.photos/seed/product/640/640',
    },
    stock: { type: 'integer', example: 10 },
    currency: { type: 'string', example: 'COP' },
    created_at: { type: 'string', format: 'date-time' },
  },
  required: [
    'id',
    'name',
    'description',
    'price_in_cents',
    'image_url',
    'imageUrl',
    'stock',
    'currency',
    'created_at',
  ],
};

export const PRODUCTS_RESPONSE_SCHEMA = {
  type: 'array',
  items: PRODUCT_SCHEMA,
};

export const PAYMENT_METHOD_DATA_SCHEMA = {
  type: 'object',
  properties: {
    cardToken: {
      type: 'string',
      example: 'tok_test_123',
      description:
        'Required when paymentMethodType is CARD. Must be generated on frontend via Wompi /tokens/cards.',
    },
    phoneNumber: { type: 'string', example: '3991111111' },
    userType: { type: 'integer', enum: [0, 1], example: 0 },
    userLegalIdType: { type: 'string', enum: ['CC', 'NIT'], example: 'CC' },
    userLegalId: { type: 'string', example: '1999888777' },
    financialInstitutionCode: { type: 'string', example: '1' },
    paymentDescription: { type: 'string', example: 'Pago Comfort' },
    sandboxStatus: { type: 'string', enum: ['APPROVED', 'DECLINED'] },
  },
  additionalProperties: false,
};

export const CREATE_ORDER_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    productId: { type: 'string', format: 'uuid' },
    paymentMethodType: {
      type: 'string',
      enum: ['CARD', 'NEQUI', 'PSE', 'BANCOLOMBIA_TRANSFER'],
      default: 'CARD',
      description:
        'For CARD payments, paymentMethodData.cardToken is mandatory and raw card data is rejected.',
    },
    paymentMethodData: PAYMENT_METHOD_DATA_SCHEMA,
  },
  required: ['productId'],
  additionalProperties: false,
};

export const ORDER_CREATED_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    orderId: { type: 'string', format: 'uuid' },
    checkoutUrl: {
      type: 'string',
      nullable: true,
      example: 'https://checkout.wompi.co/p/?public-key=pub_stagtest_xxx&...',
    },
    status: { type: 'string', enum: ['PENDING', 'APPROVED', 'DECLINED'] },
  },
  required: ['orderId', 'status'],
};

export const ORDER_BY_ID_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    product_id: { type: 'string', format: 'uuid' },
    amount_in_cents: { type: 'integer', example: 12900 },
    currency: { type: 'string', example: 'COP' },
    wompi_transaction_id: { type: 'string', example: '12345-1718123303-80111' },
    status: { type: 'string', enum: ['PENDING', 'APPROVED', 'DECLINED'] },
    created_at: { type: 'string', format: 'date-time' },
  },
  required: [
    'id',
    'product_id',
    'amount_in_cents',
    'currency',
    'wompi_transaction_id',
    'status',
    'created_at',
  ],
};

export const HEALTH_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', example: 'ok' },
    timestamp: { type: 'string', format: 'date-time' },
    uptime_in_seconds: { type: 'integer', example: 42 },
  },
  required: ['status', 'timestamp', 'uptime_in_seconds'],
};
