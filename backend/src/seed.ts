import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting La Carta demo data seeding...');

  // Create La Carta demo restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'la-carta-demo' },
    update: {},
    create: {
      name: 'La Carta Demo Restaurant',
      slug: 'la-carta-demo',
      timezone: 'America/New_York',
      currency: 'USD',
      posType: 'toast',
      settingsJson: {
        reservationBufferMinutes: 15,
        maxPartySize: 8,
        avgPrepTimeMinutes: 25,
        requiresDeposit: false
      }
    }
  });

  console.log('✅ Restaurant created:', restaurant.name);

  // Create location
  const location = await prisma.location.upsert({
    where: { id: `${restaurant.id}-main` },
    update: {},
    create: {
      id: `${restaurant.id}-main`,
      restaurantId: restaurant.id,
      address: '123 Demo Street, San Francisco, CA 94105',
      phone: '+1-555-LACARTA',
      capacityRulesJson: {
        maxConcurrentReservations: 50,
        turnTimeMinutes: 90
      }
    }
  });

  // Create tables
  const tables = await Promise.all([
    prisma.table.upsert({
      where: { id: `${location.id}-t1` },
      update: {},
      create: {
        id: `${location.id}-t1`,
        locationId: location.id,
        label: 'Table 1',
        seats: 2,
        featuresJson: { location: 'window', type: 'booth' }
      }
    }),
    prisma.table.upsert({
      where: { id: `${location.id}-t2` },
      update: {},
      create: {
        id: `${location.id}-t2`,
        locationId: location.id,
        label: 'Table 2',
        seats: 4,
        featuresJson: { location: 'center', type: 'standard' }
      }
    }),
    prisma.table.upsert({
      where: { id: `${location.id}-t3` },
      update: {},
      create: {
        id: `${location.id}-t3`,
        locationId: location.id,
        label: 'Table 3',
        seats: 6,
        featuresJson: { location: 'patio', type: 'outdoor' }
      }
    })
  ]);

  console.log('✅ Tables created:', tables.map(t => t.label).join(', '));

  // Create demo users for La Carta system
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'alice@example.com' },
      update: {},
      create: {
        email: 'alice@example.com',
        name: 'Alice Johnson',
        phone: '+1-555-0101',
        locale: 'en',
        marketingOptIn: true,
        role: UserRole.DINER,
        dinerProfile: {
          create: {
            allergensJson: ['dairy'],
            dietaryTags: ['vegetarian'],
            favoriteSkus: ['truffle_arancini', 'wild_salmon']
          }
        }
      }
    }),
    prisma.user.upsert({
      where: { email: 'bob@example.com' },
      update: {},
      create: {
        email: 'bob@example.com',
        name: 'Bob Martinez',
        phone: '+1-555-0102',
        locale: 'en',
        marketingOptIn: false,
        role: UserRole.DINER,
        dinerProfile: {
          create: {
            allergensJson: [],
            dietaryTags: [],
            favoriteSkus: ['ribeye', 'burrata']
          }
        }
      }
    }),
    prisma.user.upsert({
      where: { email: 'chef@lacarta.com' },
      update: {},
      create: {
        email: 'chef@lacarta.com',
        name: 'Maria Santos',
        phone: '+1-555-0200',
        locale: 'en',
        role: UserRole.KITCHEN,
        restaurantId: restaurant.id
      }
    })
  ]);

  console.log('✅ Users created:', users.map(u => u.name).join(', '));

  // Create loyalty accounts
  await Promise.all([
    prisma.loyaltyAccount.upsert({
      where: { userId_restaurantId: { userId: users[0].id, restaurantId: restaurant.id } },
      update: {},
      create: {
        userId: users[0].id,
        restaurantId: restaurant.id,
        points: 320,
        tier: 'gold'
      }
    }),
    prisma.loyaltyAccount.upsert({
      where: { userId_restaurantId: { userId: users[1].id, restaurantId: restaurant.id } },
      update: {},
      create: {
        userId: users[1].id,
        restaurantId: restaurant.id,
        points: 150,
        tier: 'bronze'
      }
    })
  ]);

  // Create menu categories
  const categories = await Promise.all([
    prisma.menuCategory.upsert({
      where: { id: `${restaurant.id}-appetizers` },
      update: {},
      create: {
        id: `${restaurant.id}-appetizers`,
        restaurantId: restaurant.id,
        name: 'Appetizers',
        description: 'Perfect starters to begin your meal',
        sortOrder: 1
      }
    }),
    prisma.menuCategory.upsert({
      where: { id: `${restaurant.id}-mains` },
      update: {},
      create: {
        id: `${restaurant.id}-mains`,
        restaurantId: restaurant.id,
        name: 'Main Courses',
        description: 'Our signature entrees',
        sortOrder: 2
      }
    }),
    prisma.menuCategory.upsert({
      where: { id: `${restaurant.id}-desserts` },
      update: {},
      create: {
        id: `${restaurant.id}-desserts`,
        restaurantId: restaurant.id,
        name: 'Desserts',
        description: 'Sweet endings to your meal',
        sortOrder: 3
      }
    })
  ]);

  // Create menu items
  const menuItems = await Promise.all([
    // Appetizers
    prisma.menuItem.upsert({
      where: { restaurantId_sku: { restaurantId: restaurant.id, sku: 'APP001' } },
      update: {},
      create: {
        restaurantId: restaurant.id,
        categoryId: categories[0].id,
        sku: 'APP001',
        name: 'Truffle Arancini',
        description: 'Crispy risotto balls with wild mushrooms and truffle oil',
        price: 1600, // $16.00
        prepTimeMinutes: 8,
        allergensJson: ['dairy', 'gluten'],
        dietaryTags: ['vegetarian'],
        sortOrder: 1
      }
    }),
    prisma.menuItem.upsert({
      where: { restaurantId_sku: { restaurantId: restaurant.id, sku: 'APP002' } },
      update: {},
      create: {
        restaurantId: restaurant.id,
        categoryId: categories[0].id,
        sku: 'APP002',
        name: 'Burrata & Prosciutto',
        description: 'Creamy burrata with 24-month aged prosciutto and fig jam',
        price: 2200, // $22.00
        prepTimeMinutes: 5,
        allergensJson: ['dairy'],
        dietaryTags: [],
        sortOrder: 2
      }
    }),
    // Main Courses
    prisma.menuItem.upsert({
      where: { restaurantId_sku: { restaurantId: restaurant.id, sku: 'MAIN001' } },
      update: {},
      create: {
        restaurantId: restaurant.id,
        categoryId: categories[1].id,
        sku: 'MAIN001',
        name: 'Dry-Aged Ribeye',
        description: '16oz dry-aged ribeye with roasted bone marrow and seasonal vegetables',
        price: 6800, // $68.00
        prepTimeMinutes: 18,
        allergensJson: [],
        dietaryTags: [],
        sortOrder: 1
      }
    }),
    prisma.menuItem.upsert({
      where: { restaurantId_sku: { restaurantId: restaurant.id, sku: 'MAIN002' } },
      update: {},
      create: {
        restaurantId: restaurant.id,
        categoryId: categories[1].id,
        sku: 'MAIN002',
        name: 'Wild Salmon',
        description: 'Pacific salmon with lemon herb crust and quinoa pilaf',
        price: 3600, // $36.00
        prepTimeMinutes: 15,
        allergensJson: ['fish'],
        dietaryTags: ['gluten-free'],
        sortOrder: 2
      }
    }),
    // Desserts
    prisma.menuItem.upsert({
      where: { restaurantId_sku: { restaurantId: restaurant.id, sku: 'DES001' } },
      update: {},
      create: {
        restaurantId: restaurant.id,
        categoryId: categories[2].id,
        sku: 'DES001',
        name: 'Chocolate Soufflé',
        description: 'Dark chocolate soufflé with vanilla bean ice cream',
        price: 1400, // $14.00
        prepTimeMinutes: 12,
        allergensJson: ['dairy', 'eggs'],
        dietaryTags: ['vegetarian'],
        sortOrder: 1
      }
    })
  ]);

  console.log('✅ Menu items created:', menuItems.length);

  // Create reservations with different statuses
  const now = new Date();
  const reservations = await Promise.all([
    // BOOKED reservation ready for check-in
    prisma.reservation.upsert({
      where: { id: 'demo-res-001' },
      update: {},
      create: {
        id: 'demo-res-001',
        restaurantId: restaurant.id,
        userId: users[0].id,
        partySize: 2,
        startAt: new Date(now.getTime() + 30 * 60 * 1000), // 30 minutes from now
        status: 'BOOKED',
        source: 'lacarta'
      }
    }),
    // Another BOOKED reservation
    prisma.reservation.upsert({
      where: { id: 'demo-res-002' },
      update: {},
      create: {
        id: 'demo-res-002',
        restaurantId: restaurant.id,
        userId: users[1].id,
        partySize: 4,
        startAt: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
        status: 'BOOKED',
        source: 'lacarta'
      }
    }),
    // CHECKED_IN reservation
    prisma.reservation.upsert({
      where: { id: 'demo-res-003' },
      update: {},
      create: {
        id: 'demo-res-003',
        restaurantId: restaurant.id,
        userId: users[0].id,
        partySize: 3,
        startAt: new Date(now.getTime() - 15 * 60 * 1000), // 15 minutes ago
        status: 'CHECKED_IN',
        source: 'lacarta'
      }
    })
  ]);

  console.log('✅ Reservations created:', reservations.length);

  // Create pre-orders for the reservations
  const preOrders = await Promise.all([
    // Pre-order for first reservation
    prisma.preOrder.upsert({
      where: { reservationId: 'demo-res-001' },
      update: {},
      create: {
        reservationId: 'demo-res-001',
        status: 'AUTHORIZED',
        subtotal: 5200, // $52.00
        tax: 468,       // $4.68 (9% tax)
        tip: 1040,      // $10.40 (20% tip)
        total: 6708     // $67.08
      }
    }),
    // Pre-order for second reservation  
    prisma.preOrder.upsert({
      where: { reservationId: 'demo-res-002' },
      update: {},
      create: {
        reservationId: 'demo-res-002',
        status: 'AUTHORIZED',
        subtotal: 8400, // $84.00
        tax: 756,       // $7.56
        tip: 1680,      // $16.80
        total: 10836    // $108.36
      }
    }),
    // Pre-order for checked-in reservation
    prisma.preOrder.upsert({
      where: { reservationId: 'demo-res-003' },
      update: {},
      create: {
        reservationId: 'demo-res-003',
        status: 'INJECTED_TO_POS',
        subtotal: 3600, // $36.00
        tax: 324,       // $3.24
        tip: 720,       // $7.20
        total: 4644     // $46.44
      }
    })
  ]);

  // Create pre-order items
  await Promise.all([
    // Items for first pre-order
    prisma.preOrderItem.upsert({
      where: { id: 'demo-item-001' },
      update: {},
      create: {
        id: 'demo-item-001',
        preorderId: preOrders[0].id,
        sku: 'APP001',
        name: 'Truffle Arancini',
        quantity: 1,
        price: 1600,
        notes: 'Extra truffle oil please'
      }
    }),
    prisma.preOrderItem.upsert({
      where: { id: 'demo-item-002' },
      update: {},
      create: {
        id: 'demo-item-002',
        preorderId: preOrders[0].id,
        sku: 'MAIN002',
        name: 'Wild Salmon',
        quantity: 2,
        price: 3600
      }
    }),
    // Items for second pre-order
    prisma.preOrderItem.upsert({
      where: { id: 'demo-item-003' },
      update: {},
      create: {
        id: 'demo-item-003',
        preorderId: preOrders[1].id,
        sku: 'APP002',
        name: 'Burrata & Prosciutto',
        quantity: 1,
        price: 2200
      }
    }),
    prisma.preOrderItem.upsert({
      where: { id: 'demo-item-004' },
      update: {},
      create: {
        id: 'demo-item-004',
        preorderId: preOrders[1].id,
        sku: 'MAIN001',
        name: 'Dry-Aged Ribeye',
        quantity: 1,
        price: 6800,
        notes: 'Medium rare'
      }
    }),
    // Items for third pre-order
    prisma.preOrderItem.upsert({
      where: { id: 'demo-item-005' },
      update: {},
      create: {
        id: 'demo-item-005',
        preorderId: preOrders[2].id,
        sku: 'MAIN002',
        name: 'Wild Salmon',
        quantity: 1,
        price: 3600,
        allergensJson: ['fish']
      }
    })
  ]);

  console.log('✅ Pre-order items created');

  // Create check-in for the third reservation
  const checkin = await prisma.checkIn.upsert({
    where: { reservationId: 'demo-res-003' },
    update: {},
    create: {
      reservationId: 'demo-res-003',
      method: 'QR_SCAN',
      locationId: location.id,
      tableId: tables[0].id,
      scannedAt: new Date(now.getTime() - 10 * 60 * 1000) // 10 minutes ago
    }
  });

  // Create kitchen tickets with different statuses
  const kitchenTickets = await Promise.all([
    // PENDING ticket (ready for kitchen to start)
    prisma.kitchenTicket.upsert({
      where: { reservationId: 'demo-res-001' },
      update: {},
      create: {
        reservationId: 'demo-res-001',
        status: 'PENDING',
        estimatedPrepMinutes: 20,
        fireAt: new Date(now.getTime() + 25 * 60 * 1000), // Fire in 25 minutes
        itemsJson: [
          { name: 'Truffle Arancini', quantity: 1, notes: 'Extra truffle oil please' },
          { name: 'Wild Salmon', quantity: 2 }
        ]
      }
    }),
    // FIRED ticket (currently cooking)
    prisma.kitchenTicket.upsert({
      where: { reservationId: 'demo-res-003' },
      update: {},
      create: {
        reservationId: 'demo-res-003',
        status: 'FIRED',
        estimatedPrepMinutes: 15,
        fireAt: new Date(now.getTime() - 10 * 60 * 1000), // Fired 10 minutes ago
        firedAt: new Date(now.getTime() - 8 * 60 * 1000),  // Started cooking 8 minutes ago
        itemsJson: [
          { name: 'Wild Salmon', quantity: 1, allergens: ['fish'] }
        ]
      }
    }),
    // HOLD ticket (waiting for guest arrival)
    prisma.kitchenTicket.upsert({
      where: { reservationId: 'demo-res-002' },
      update: {},
      create: {
        reservationId: 'demo-res-002',
        status: 'HOLD',
        estimatedPrepMinutes: 25,
        fireAt: new Date(now.getTime() + 55 * 60 * 1000), // Fire in 55 minutes
        itemsJson: [
          { name: 'Burrata & Prosciutto', quantity: 1 },
          { name: 'Dry-Aged Ribeye', quantity: 1, notes: 'Medium rare' }
        ]
      }
    })
  ]);

  console.log('✅ Kitchen tickets created:', kitchenTickets.length);

  // Create some recent events for audit trail
  await Promise.all([
    prisma.event.create({
      data: {
        kind: 'reservation.created',
        actorId: users[0].id,
        restaurantId: restaurant.id,
        reservationId: 'demo-res-001',
        payloadJson: {
          partySize: 2,
          requestedTime: reservations[0].startAt.toISOString()
        }
      }
    }),
    prisma.event.create({
      data: {
        kind: 'reservation.checked_in',
        actorId: users[0].id,
        restaurantId: restaurant.id,
        reservationId: 'demo-res-003',
        payloadJson: {
          method: 'QR_SCAN',
          locationId: location.id,
          tableId: tables[0].id,
          scannedAt: checkin.scannedAt.toISOString()
        }
      }
    }),
    prisma.event.create({
      data: {
        kind: 'kitchen_ticket.fired',
        actorId: users[2].id, // Chef
        restaurantId: restaurant.id,
        reservationId: 'demo-res-003',
        payloadJson: {
          ticketId: kitchenTickets[1].id,
          estimatedPrepMinutes: 15
        }
      }
    })
  ]);

  console.log('✅ Events created for audit trail');

  console.log('\n🎉 Demo data seeding complete!');
  console.log('\n📋 Summary:');
  console.log(`• Restaurant: ${restaurant.name} (ID: ${restaurant.id})`);
  console.log(`• Location: ${location.address}`);
  console.log(`• Tables: ${tables.length} tables created`);
  console.log(`• Users: ${users.length} users (${users.filter(u => u.role === 'DINER').length} diners, ${users.filter(u => u.role === 'KITCHEN').length} staff)`);
  console.log(`• Menu: ${categories.length} categories, ${menuItems.length} items`);
  console.log(`• Reservations: ${reservations.length} reservations with pre-orders`);
  console.log(`• Kitchen Tickets: ${kitchenTickets.length} tickets (${kitchenTickets.filter(t => t.status === 'PENDING').length} pending, ${kitchenTickets.filter(t => t.status === 'FIRED').length} fired, ${kitchenTickets.filter(t => t.status === 'HOLD').length} on hold)`);

  console.log('\n🔗 Demo URLs:');
  console.log(`• Kitchen Dashboard: http://localhost:3000/kitchen`);
  console.log(`• Check-in (Alice): http://localhost:3000/checkin/demo-res-001`);
  console.log(`• Check-in (Bob): http://localhost:3000/checkin/demo-res-002`);
  console.log(`• API Health: http://localhost:3001/api/health`);
  console.log(`• Kitchen API: http://localhost:3001/api/v1/kitchen/tickets?restaurantId=${restaurant.id}`);

  console.log('\n💡 Demo Tips:');
  console.log('• Alice\'s reservation (demo-res-001) is ready for check-in');
  console.log('• Bob\'s reservation (demo-res-002) has a kitchen ticket on HOLD');
  console.log('• The third reservation is already checked in with a FIRED kitchen ticket');
  console.log('• Use the kitchen dashboard to update ticket statuses and see real-time updates');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });