import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  {
    name: 'Almohada ortopédica',
    description:
      'Almohada de espuma viscoelástica con soporte cervical para quienes duermen de lado',
    priceInCents: 1290000,
    imageUrl:
      'https://pixabay.com/es/images/download/mxh6789-bedding-4321545_1920.jpg',
    stock: 14,
    currency: 'COP',
  },
  {
    name: 'Manta ponderada',
    description:
      'Manta calmante con peso de 7 kg con funda de algodón transpirable.',
    priceInCents: 2190000,
    imageUrl:
      'https://pixabay.com/es/images/download/stocksnap-blanket-2593141_1920.jpg',
    stock: 8,
    currency: 'COP',
  },
  {
    name: 'Silla Comfort',
    description: 'Silla comoda con diseño relajante y artesanal.',
    priceInCents: 4590000,
    imageUrl:
      'https://pixabay.com/es/images/download/stocksnap-architecture-2576906_1920.jpg',
    stock: 5,
    currency: 'COP',
  },
  {
    name: 'Set de Sabanas',
    description: 'Set variado de mantas para hacer yoga',
    priceInCents: 890000,
    imageUrl:
      'https://pixabay.com/es/images/download/christineterkouche-fabrics-250330_1920.jpg',
    stock: 27,
    currency: 'COP',
  },
  {
    name: 'Difusor de aromaterapia',
    description:
      'Difusor ultrasónico con apagado automático y luz ambiental suave.',
    priceInCents: 1490000,
    imageUrl:
      'https://pixabay.com/es/images/download/asundermeier-diffuser-4078729_1920.jpg',
    stock: 11,
    currency: 'COP',
  },
  {
    name: 'Juguete de Masaje',
    description: 'Compact percussion massager with 6 speed levels.',
    priceInCents: 2890000,
    imageUrl:
      'https://pixabay.com/es/images/download/coernl-hedgehog-ball-7921103_1920.jpg',
    stock: 9,
    currency: 'COP',
  },
  {
    name: 'Yoga Mat Pro',
    description:
      'Alfombrilla antideslizante de 6mm con amortiguación de alta densidad.',
    priceInCents: 1690000,
    imageUrl:
      'https://pixabay.com/es/images/download/jeviniya-yoga-1146281_1920.jpg',
    stock: 18,
    currency: 'COP',
  },
  {
    name: 'Botella de agua inteligente',
    description:
      'Botella rastreadora de hidratación con recordatorio LED y sincronización de aplicaciones.',
    priceInCents: 1990000,
    imageUrl:
      'https://pixabay.com/es/images/download/ds_30-accessories-4887141_1920.jpg',
    stock: 16,
    currency: 'COP',
  },
  {
    name: 'Audifonos Sound-Cancel',
    description:
      'Auriculares inalámbricos con ANC híbrido y 24 horas de duración de batería.',
    priceInCents: 3990000,
    imageUrl: 'https://placehold.co/640x860/png?text=Noise-Cancelling+Earbuds',
    stock: 7,
    currency: 'COP',
  },
  {
    name: 'Conjunto Yoga',
    description: 'Conjunto sport para hacer yoga.',
    priceInCents: 2590000,
    imageUrl:
      'https://pixabay.com/es/images/download/1162835-portrait-3600667_1920.jpg',
    stock: 12,
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
