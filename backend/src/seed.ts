import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a demo restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'Mizu Sushi',
      slug: 'mizu-sushi',
      timezone: 'America/New_York',
      currency: 'USD',
      posType: 'toast',
      settingsJson: {
        avgTurnTime: 55,
        maxPartySize: 8,
        requiresDeposit: true,
        depositAmount: 2000 // $20 in cents
      }
    }
  });

  // Create a location
  const location = await prisma.location.create({
    data: {
      restaurantId: restaurant.id,
      address: '123 Broadway, New York, NY 10012',
      phone: '+1-212-555-0123',
      capacityRulesJson: {
        maxCovers: 120,
        turnTimes: {
          'breakfast': 45,
          'lunch': 55,
          'dinner': 75
        }
      }
    }
  });

  // Create tables
  const tables = await Promise.all([
    prisma.table.create({
      data: {
        locationId: location.id,
        label: 'A1',
        seats: 2,
        featuresJson: { type: 'booth', window: true }
      }
    }),
    prisma.table.create({
      data: {
        locationId: location.id,
        label: 'A2', 
        seats: 4,
        featuresJson: { type: 'standard' }
      }
    }),
    prisma.table.create({
      data: {
        locationId: location.id,
        label: 'B1',
        seats: 6,
        featuresJson: { type: 'round', private: true }
      }
    })
  ]);

  // Create demo users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const diner = await prisma.user.create({
    data: {
      email: 'adrian@example.com',
      name: 'Adrian Luna',
      phone: '+1-555-0101',
      hashedPassword,
      role: UserRole.DINER,
      marketingOptIn: true,
      dinerProfile: {
        create: {
          allergensJson: ['shellfish'],
          dietaryTags: [],
          favoriteSkus: ['taco_alpastor', 'miso_soup']
        }
      }
    }
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@mizusushi.com',
      name: 'Sarah Chen',
      phone: '+1-555-0102',
      hashedPassword,
      role: UserRole.MANAGER,
      restaurantId: restaurant.id
    }
  });

  const host = await prisma.user.create({
    data: {
      email: 'host@mizusushi.com',
      name: 'James Wilson',
      hashedPassword,
      role: UserRole.HOST,
      restaurantId: restaurant.id
    }
  });

  // Create a demo reservation
  const reservation = await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      userId: diner.id,
      partySize: 2,
      startAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      status: 'BOOKED'
    }
  });

  // Create a loyalty account
  await prisma.loyaltyAccount.create({
    data: {
      userId: diner.id,
      restaurantId: restaurant.id,
      points: 240,
      tier: 'gold'
    }
  });

  console.log('✅ Database seeded successfully!');
  console.log(`🏪 Restaurant: ${restaurant.name} (${restaurant.slug})`);
  console.log(`📍 Location: ${location.address}`);
  console.log(`🪑 Tables created: ${tables.length}`);
  console.log(`👤 Demo diner: ${diner.email}`);
  console.log(`👨‍💼 Manager: ${manager.email}`);
  console.log(`🏨 Host: ${host.email}`);
  console.log(`📅 Demo reservation: ${reservation.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });