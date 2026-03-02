import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  {
    name: 'Almohada ortopÃ©dica',
    description:
      'Almohada de espuma viscoelÃ¡stica con soporte cervical para quienes duermen de lado',
    priceInCents: 1290000,
    imageUrl: 'https://picsum.photos/seed/comfort-orthopedic-pillow/900/1200',
    stock: 14,
    currency: 'COP',
  },
  {
    name: 'Manta ponderada',
    description:
      'Manta calmante con peso de 7 kg con funda de algodÃ³n transpirable.',
    priceInCents: 2190000,
    imageUrl: 'https://picsum.photos/seed/comfort-weighted-blanket/900/1200',
    stock: 8,
    currency: 'COP',
  },
  {
    name: 'Silla Comfort',
    description: 'Silla comoda con diseÃ±o relajante y artesanal.',
    priceInCents: 4590000,
    imageUrl: 'https://picsum.photos/seed/comfort-desk-chair/900/1200',
    stock: 5,
    currency: 'COP',
  },
  {
    name: 'Set de Sabanas',
    description: 'Set variado de mantas para hacer yoga',
    priceInCents: 890000,
    imageUrl:
      'https://cdn.pixabay.com/photo/2012/12/24/08/39/sheets-72155_1280.jpg',
    stock: 27,
    currency: 'COP',
  },
  {
    name: 'Difusor de aromaterapia',
    description:
      'Difusor ultrasÃ³nico con apagado automÃ¡tico y luz ambiental suave.',
    priceInCents: 1490000,
    imageUrl:
      'https://cdn.pixabay.com/photo/2019/03/24/21/30/diffuser-4078729_1280.jpg',
    stock: 11,
    currency: 'COP',
  },
  {
    name: 'Juguete de Masaje',
    description: 'Compact percussion massager with 6 speed levels.',
    priceInCents: 2890000,
    imageUrl:
      'https://cdn.pixabay.com/photo/2023/04/12/19/58/hedgehog-ball-7921103_1280.jpg',
    stock: 9,
    currency: 'COP',
  },
  {
    name: 'Yoga Mat Pro',
    description:
      'Alfombrilla antideslizante de 6mm con amortiguaciÃ³n de alta densidad.',
    priceInCents: 1690000,
    imageUrl:
      'https://cdn.pixabay.com/photo/2016/01/18/09/48/yoga-1146281_1280.jpg',
    stock: 18,
    currency: 'COP',
  },
  {
    name: 'Botella de agua inteligente',
    description:
      'Botella rastreadora de hidrataciÃ³n con recordatorio LED y sincronizaciÃ³n de aplicaciones.',
    priceInCents: 1990000,
    imageUrl:
      'https://cdn.pixabay.com/photo/2015/08/21/00/18/water-bottle-898332_1280.jpg',
    stock: 16,
    currency: 'COP',
  },
  {
    name: 'Audifonos Sound-Cancel',
    description:
      'Auriculares inalÃ¡mbricos con ANC hÃ­brido y 24 horas de duraciÃ³n de baterÃ­a.',
    priceInCents: 3990000,
    imageUrl:
      'https://cdn.pixabay.com/photo/2025/02/12/09/50/headphones-9401018_1280.jpg',
    stock: 7,
    currency: 'COP',
  },
  {
    name: 'Conjunto Yoga',
    description: 'Conjunto sport para hacer yoga.',
    priceInCents: 2590000,
    imageUrl:
      'https://cdn.pixabay.com/photo/2018/08/12/12/15/portrait-3600667_1280.jpg',
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
