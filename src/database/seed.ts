import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/data-source';
import { Product } from '../entities/product.entity';
import { User } from '../entities/user.entity';

/**
 * The assignment's minimum API list has no signup endpoint — only
 * POST /auth/login — so this seeds a demo account (and a starter catalog)
 * rather than the app requiring a registration flow that was never asked
 * for. Run with `npm run seed` after DATABASE_URL points at a real database.
 */
const DEMO_EMAIL = 'demo@fitring.app';
const DEMO_PASSWORD = 'password123';

async function seed() {
  await AppDataSource.initialize();

  const users = AppDataSource.getRepository(User);
  const products = AppDataSource.getRepository(Product);

  let user = await users.findOne({ where: { email: DEMO_EMAIL } });
  if (!user) {
    user = await users.save(
      users.create({
        email: DEMO_EMAIL,
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      }),
    );
    console.log(`Created demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } else {
    console.log(`Demo user already exists: ${DEMO_EMAIL}`);
  }

  const catalog = [
    {
      name: 'FitRing Charging Dock',
      description: 'Magnetic USB-C charging dock for the FitRing.',
      price: '29.99',
      imageUrl: null,
    },
    {
      name: 'FitRing Silicone Case',
      description: 'Protective case, three sizes included.',
      price: '14.99',
      imageUrl: null,
    },
    {
      name: 'FitRing Extra Band',
      description: 'Replacement comfort band, adjustable fit.',
      price: '9.99',
      imageUrl: null,
    },
    {
      name: 'FitRing Travel Case',
      description: 'Compact hard case with built-in charger.',
      price: '24.99',
      imageUrl: null,
    },
  ];

  for (const item of catalog) {
    const existing = await products.findOne({ where: { name: item.name } });
    if (!existing) {
      await products.save(products.create(item));
      console.log(`Seeded product: ${item.name}`);
    }
  }

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
