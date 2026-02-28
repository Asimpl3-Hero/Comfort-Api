import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  {
    name: 'Orthopedic Pillow',
    description: 'Memory-foam pillow with cervical support for side sleepers.',
    priceInCents: 12900,
    currency: 'COP',
  },
  {
    name: 'Weighted Blanket',
    description: 'Calming 7kg weighted blanket with breathable cotton cover.',
    priceInCents: 21900,
    currency: 'COP',
  },
  {
    name: 'Ergonomic Desk Chair',
    description: 'Lumbar-support chair with 3D armrests and mesh back.',
    priceInCents: 45900,
    currency: 'COP',
  },
  {
    name: 'Blue-Light Glasses',
    description: 'Anti-reflective lenses designed for long screen sessions.',
    priceInCents: 8900,
    currency: 'COP',
  },
  {
    name: 'Aromatherapy Diffuser',
    description: 'Ultrasonic diffuser with auto-shutoff and soft ambient light.',
    priceInCents: 14900,
    currency: 'COP',
  },
  {
    name: 'Portable Massage Gun',
    description: 'Compact percussion massager with 6 speed levels.',
    priceInCents: 28900,
    currency: 'COP',
  },
  {
    name: 'Yoga Mat Pro',
    description: 'Non-slip 6mm mat with high-density cushioning.',
    priceInCents: 16900,
    currency: 'COP',
  },
  {
    name: 'Smart Water Bottle',
    description: 'Hydration tracker bottle with LED reminder and app sync.',
    priceInCents: 19900,
    currency: 'COP',
  },
  {
    name: 'Noise-Cancelling Earbuds',
    description: 'Wireless earbuds with hybrid ANC and 24h battery life.',
    priceInCents: 39900,
    currency: 'COP',
  },
  {
    name: 'Air Purifier Mini',
    description: 'Desktop HEPA purifier for personal workspaces and bedrooms.',
    priceInCents: 25900,
    currency: 'COP',
  },
];

async function main(): Promise<void> {
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.product.createMany({
    data: products,
  });

  console.log(`Seed completed: ${products.length} products inserted.`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
