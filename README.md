# Comfort API

Production-ready backend API built with NestJS + TypeScript, using Hexagonal Architecture (Ports & Adapters), Railway Oriented Programming (ROP), Prisma, PostgreSQL, and Wompi sandbox integration.

## 1. Step-by-step implementation guide

1. Build domain and application layers first.
   - Define entities, value objects, domain services.
   - Define ports as interfaces/tokens.
   - Implement use cases returning `Result<T, E>`.
2. Implement infrastructure adapters.
   - Prisma adapters for repository ports.
   - Wompi adapter for payment port.
   - Background polling service for transaction lifecycle.
3. Implement thin HTTP controllers.
   - Controllers only orchestrate use cases.
   - Controllers map `Result` to HTTP responses.
4. Configure environment and persistence.
   - `ConfigModule` for all env vars.
   - Prisma schema, push, generate, seed.
5. Add quality gates.
   - Unit tests for use case behavior with mocked ports.
   - Validation pipe and DTO validation.

## 2. Full folder structure

```text
src/
├── domain/
│   ├── entities/
│   │   ├── order.entity.ts
│   │   └── product.entity.ts
│   ├── value-objects/
│   │   └── money.vo.ts
│   ├── ports/
│   │   ├── order-repository.port.ts
│   │   ├── order-status-polling.port.ts
│   │   ├── payment-gateway.port.ts
│   │   └── product-repository.port.ts
│   └── services/
│       └── order-status.service.ts
├── application/
│   ├── use-cases/
│   │   ├── create-order.use-case.ts
│   │   ├── get-order-by-id.use-case.ts
│   │   └── get-products.use-case.ts
│   └── dto/
│       ├── create-order-request.dto.ts
│       └── order-created-response.dto.ts
├── infrastructure/
│   ├── adapters/
│   │   ├── persistence/
│   │   │   ├── prisma-order.repository.adapter.ts
│   │   │   ├── prisma-product.repository.adapter.ts
│   │   │   └── prisma.service.ts
│   │   ├── wompi/
│   │   │   ├── wompi.adapter.ts
│   │   │   └── wompi-order-status-polling.service.ts
│   │   └── http/
│   │       ├── http-error.mapper.ts
│   │       ├── orders.controller.ts
│   │       └── products.controller.ts
│   └── config/
│       └── app-config.service.ts
├── shared/
│   ├── errors/
│   │   └── app-error.ts
│   └── railway/
│       ├── index.ts
│       └── result.ts
├── app.module.ts
└── main.ts

prisma/
├── schema.prisma
└── seed.ts
```

## 3. Core files implementation

- `shared/railway/result.ts`
  - Provides `Ok`, `Err`, `map`, `flatMap`, `match`, `isOk`, `isErr`.
  - All use cases and adapters communicate failures without throwing business exceptions.
- `application/use-cases/create-order.use-case.ts`
  - Fetches product, validates money, creates Wompi transaction, persists order as `PENDING`, starts background polling.
- `infrastructure/adapters/wompi/wompi-order-status-polling.service.ts`
  - Polls every 5 seconds and updates order state until `APPROVED`, `DECLINED`, or 60-second timeout.
- `infrastructure/adapters/http/*.controller.ts`
  - Controllers only orchestrate use cases and map `Result` to HTTP responses.

## 4. Prisma schema (data model)

Models:

- `products`
  - `id` uuid
  - `name`
  - `description`
  - `price_in_cents`
  - `currency`
  - `created_at`
- `orders`
  - `id` uuid
  - `product_id` FK -> `products.id`
  - `amount_in_cents`
  - `currency`
  - `wompi_transaction_id`
  - `status` (`PENDING | APPROVED | DECLINED`)
  - `created_at`

Schema file: `prisma/schema.prisma`.

## 5. Seed script

Seed file: `prisma/seed.ts`

- Deletes existing orders/products.
- Inserts 10 dummy products.
- No API endpoint exists to create products.

Run:

```bash
npm run prisma:seed
```

## 6. Wompi integration (sandbox only)

Configured to use sandbox:

- Base URL: `https://api-sandbox.co.uat.wompi.dev/v1`
- Public key: `pub_stagtest_g2u0HQd3ZMh05hsSgTS2lUV8t3s4mOt7`
- Private key: `prv_stagtest_5i0ZGIGiFcDQifYsXxvsny7Y37tKqFWg`
- Acceptance token: from Wompi sandbox merchant terms (`WOMPI_ACCEPTANCE_TOKEN`)
- Sandbox card token: generated with Wompi test cards (`WOMPI_SANDBOX_CARD_TOKEN`)

`WompiAdapter` responsibilities:

- Create transaction (`POST /transactions`).
- Poll transaction status (`GET /transactions/:id`).
- Convert provider status into domain order status through `OrderStatusService`.

## 7. Polling strategy

After `POST /orders`:

1. Save order as `PENDING`.
2. Start background polling every 5 seconds.
3. Stop polling when:
   - status becomes `APPROVED`, or
   - status becomes `DECLINED`, or
   - 60 seconds elapsed.
4. Persist final status in DB.

No webhooks are used.

## 8. API endpoints

### `GET /products`

Returns seeded products.

### `POST /orders`

Body:

```json
{
  "productId": "uuid"
}
```

Response:

```json
{
  "orderId": "uuid",
  "checkoutUrl": "https://checkout.wompi.co/p/?...",
  "status": "PENDING"
}
```

### `GET /orders/:id`

Returns current order status and order data.

## 9. Environment variables

Use `.env.example` as template:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/comfort_api?schema=public"
NODE_ENV="development"
FORCE_HTTPS="false"
RATE_LIMIT_WINDOW_MS="60000"
RATE_LIMIT_MAX_REQUESTS="120"
WOMPI_BASE_URL="https://api-sandbox.co.uat.wompi.dev/v1"
WOMPI_PUBLIC_KEY="pub_stagtest_g2u0HQd3ZMh05hsSgTS2lUV8t3s4mOt7"
WOMPI_PRIVATE_KEY="prv_stagtest_5i0ZGIGiFcDQifYsXxvsny7Y37tKqFWg"
WOMPI_ACCEPTANCE_TOKEN="acceptance_token_from_wompi_sandbox"
WOMPI_SANDBOX_CARD_TOKEN="tok_test_from_wompi_sandbox"
WOMPI_CUSTOMER_EMAIL="sandbox.user@comfort-api.local"
```

## 10. Security baseline (OWASP aligned)

- Security headers via `helmet` (e.g. `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).
- Express hardening: `x-powered-by` disabled.
- Request throttling via `express-rate-limit`.
- Optional HTTPS enforcement (`FORCE_HTTPS=true`) with 301 redirect for non-HTTPS requests behind proxy.

## 11. Commands to run

1. Install dependencies:

```bash
npm install
```

2. Create local env:

```bash
cp .env.example .env
```

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Push schema to PostgreSQL:

```bash
npm run prisma:push
```

5. Seed products:

```bash
npm run prisma:seed
```

6. Start API:

```bash
npm run start:dev
```

7. Run tests:

```bash
npm run test
```
