# Comfort API

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)
![Jest](https://img.shields.io/badge/Tests-Jest-C21325?logo=jest&logoColor=white)

Backend de **Comfort** construido con NestJS + TypeScript, arquitectura hexagonal (Ports & Adapters), ROP con `Result<T, E>`, PostgreSQL y Prisma.  
Integra una **pasarela de pago** en modo sandbox y polling de ordenes.

## ✨ Que incluye

- 📦 Catalogo de productos (`GET /products`) con seed inicial
- 🧾 Creacion de ordenes (`POST /orders`) y consulta por id (`GET /orders/:id`)
- ❤️ Healthcheck (`GET /health`)
- 🔁 Polling en segundo plano cada 5s hasta estado final o timeout
- 🔐 Hardening basico: headers de seguridad, rate limit, HTTPS opcional

## 🧱 Arquitectura

```text
src/
├── domain/            # Entidades, value objects, puertos, servicios de dominio
├── application/       # Use cases + DTOs + servicios de aplicacion
├── infrastructure/    # Adapters (HTTP, persistencia, pasarela), config
├── shared/            # Result (ROP), errores compartidos
└── main.ts
```

Reglas aplicadas:

- Controladores sin logica de negocio
- Inversion de dependencias con puertos
- Dominio desacoplado de infraestructura

## 🗃️ Modelo de datos

- `products`: `id`, `name`, `description`, `price_in_cents`, `currency`, `stock`, `image_url`, `created_at`
- `orders`: `id`, `product_id`, `amount_in_cents`, `currency`, `wompi_transaction_id`, `status`, `created_at`

Archivo: `prisma/schema.prisma`  
Seed: `prisma/seed.ts` (10 productos dummy).

## 🔌 Endpoints

- `GET /health`
- `GET /products`
- `POST /orders`
- `GET /orders/:id`

Swagger:

- URL: `http://localhost:3001/docs`
- Variables: `SWAGGER_ENABLED`, `SWAGGER_PATH`

## ⚙️ Variables de entorno

Usa `.env.example` como base:

```bash
cp .env.example .env
```

## 🚀 Levantar backend (local)

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run start:dev
```

## 🐳 Levantar backend con Docker

```bash
docker compose up --build -d
docker compose --profile seed run --rm seed
```

Healthcheck:

```bash
curl http://localhost:3001/health
doc  https://comfort-api.ondeploy.store/docs
```

## 🧪 Pruebas unitarias

Backend:

```bash
npm run test
npm run test:cov
```

Cobertura actual (Jest):

- Statements: **94.71%**
- Branches: **83.07%**
- Functions: **95.45%**
- Lines: **94.45%**
