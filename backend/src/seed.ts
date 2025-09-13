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

  // Create menu categories
  const appetizers = await prisma.menuCategory.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Appetizers',
      description: 'Start your meal with these delicious small plates',
      sortOrder: 1
    }
  });

  const sushi = await prisma.menuCategory.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Sushi & Sashimi',
      description: 'Fresh fish prepared by our master sushi chefs',
      sortOrder: 2
    }
  });

  const mains = await prisma.menuCategory.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Main Courses',
      description: 'Hearty dishes to satisfy your appetite',
      sortOrder: 3
    }
  });

  const desserts = await prisma.menuCategory.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Desserts',
      description: 'Sweet endings to your perfect meal',
      sortOrder: 4
    }
  });

  // Create modifier groups
  const spiceLevelGroup = await prisma.modifierGroup.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Spice Level',
      description: 'How spicy would you like it?',
      minSelections: 1,
      maxSelections: 1,
      isRequired: true
    }
  });

  const spiceLevels = await Promise.all([
    prisma.modifier.create({
      data: {
        modifierGroupId: spiceLevelGroup.id,
        name: 'Mild',
        price: 0,
        sortOrder: 1
      }
    }),
    prisma.modifier.create({
      data: {
        modifierGroupId: spiceLevelGroup.id,
        name: 'Medium',
        price: 0,
        sortOrder: 2
      }
    }),
    prisma.modifier.create({
      data: {
        modifierGroupId: spiceLevelGroup.id,
        name: 'Hot',
        price: 0,
        sortOrder: 3
      }
    })
  ]);

  const extrasGroup = await prisma.modifierGroup.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Extras',
      description: 'Add something special',
      minSelections: 0,
      maxSelections: 3,
      isRequired: false
    }
  });

  const extras = await Promise.all([
    prisma.modifier.create({
      data: {
        modifierGroupId: extrasGroup.id,
        name: 'Extra Ginger',
        price: 50, // $0.50
        sortOrder: 1
      }
    }),
    prisma.modifier.create({
      data: {
        modifierGroupId: extrasGroup.id,
        name: 'Extra Wasabi',
        price: 50,
        sortOrder: 2
      }
    }),
    prisma.modifier.create({
      data: {
        modifierGroupId: extrasGroup.id,
        name: 'No Onions',
        price: 0,
        sortOrder: 3
      }
    })
  ]);

  // Create menu items
  const misoSoup = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: appetizers.id,
      sku: 'miso_soup',
      name: 'Miso Soup',
      description: 'Traditional soybean soup with tofu, seaweed, and scallions',
      price: 650, // $6.50
      prepTimeMinutes: 5,
      allergensJson: ['soy'],
      dietaryTags: ['vegetarian', 'gluten-free'],
      sortOrder: 1
    }
  });

  const edamame = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: appetizers.id,
      sku: 'edamame',
      name: 'Edamame',
      description: 'Steamed and salted young soybeans',
      price: 550, // $5.50
      prepTimeMinutes: 3,
      allergensJson: ['soy'],
      dietaryTags: ['vegetarian', 'vegan', 'gluten-free'],
      sortOrder: 2
    }
  });

  const salmonNigiri = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: sushi.id,
      sku: 'salmon_nigiri',
      name: 'Salmon Nigiri',
      description: 'Two pieces of fresh salmon over seasoned rice',
      price: 850, // $8.50
      prepTimeMinutes: 8,
      allergensJson: ['fish'],
      dietaryTags: [],
      sortOrder: 1
    }
  });

  const spicyTuna = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: sushi.id,
      sku: 'spicy_tuna_roll',
      name: 'Spicy Tuna Roll',
      description: 'Tuna, spicy mayo, cucumber, and avocado',
      price: 1250, // $12.50
      prepTimeMinutes: 10,
      allergensJson: ['fish', 'eggs'],
      dietaryTags: [],
      sortOrder: 2
    }
  });

  const teriyakiChicken = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: mains.id,
      sku: 'teriyaki_chicken',
      name: 'Teriyaki Chicken',
      description: 'Grilled chicken glazed with house teriyaki sauce, served with rice and vegetables',
      price: 1850, // $18.50
      prepTimeMinutes: 15,
      allergensJson: ['soy', 'gluten'],
      dietaryTags: [],
      sortOrder: 1
    }
  });

  const matchaIceCream = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: desserts.id,
      sku: 'matcha_ice_cream',
      name: 'Matcha Ice Cream',
      description: 'Premium green tea ice cream with red bean topping',
      price: 750, // $7.50
      prepTimeMinutes: 2,
      allergensJson: ['dairy'],
      dietaryTags: ['vegetarian'],
      sortOrder: 1
    }
  });

  // Connect modifiers to menu items
  await prisma.menuItemModifierGroup.create({
    data: {
      menuItemId: spicyTuna.id,
      modifierGroupId: spiceLevelGroup.id,
      isRequired: true,
      sortOrder: 1
    }
  });

  await prisma.menuItemModifierGroup.create({
    data: {
      menuItemId: spicyTuna.id,
      modifierGroupId: extrasGroup.id,
      isRequired: false,
      sortOrder: 2
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
  console.log(`🍽️ Menu categories: ${[appetizers, sushi, mains, desserts].length}`);
  console.log(`🍜 Menu items: 6 items with modifiers`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });