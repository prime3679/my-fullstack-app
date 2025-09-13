import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding staff demo data...');

  // Get the first restaurant for demo purposes
  const restaurant = await prisma.restaurant.findFirst({
    include: { locations: true }
  });

  if (!restaurant) {
    console.log('❌ No restaurant found. Please run the main seed script first.');
    return;
  }

  console.log(`📍 Using restaurant: ${restaurant.name}`);

  // Create a manager user
  const hashedPassword = await bcrypt.hash('manager123', 10);
  
  const manager = await prisma.user.upsert({
    where: { email: 'manager@lacarta.com' },
    update: {
      role: 'MANAGER',
      restaurantId: restaurant.id,
      hashedPassword,
      phone: '555-0100'
    },
    create: {
      email: 'manager@lacarta.com',
      name: 'Restaurant Manager',
      phone: '555-0100',
      role: 'MANAGER',
      restaurantId: restaurant.id,
      hashedPassword,
      marketingOptIn: false
    }
  });

  console.log(`👔 Created manager: ${manager.name} (${manager.email})`);

  // Create some staff users with temporary passwords
  const staffMembers = [
    {
      email: 'host@lacarta.com',
      name: 'Sarah Host',
      role: 'HOST',
      phone: '555-0101'
    },
    {
      email: 'server1@lacarta.com',
      name: 'Mike Server',
      role: 'SERVER',
      phone: '555-0102'
    },
    {
      email: 'server2@lacarta.com',
      name: 'Emma Server',
      role: 'SERVER',
      phone: '555-0103'
    },
    {
      email: 'kitchen@lacarta.com',
      name: 'Chef Rodriguez',
      role: 'KITCHEN',
      phone: '555-0104'
    },
    {
      email: 'expo@lacarta.com',
      name: 'Alex Expo',
      role: 'EXPO',
      phone: '555-0105'
    }
  ];

  for (const staffData of staffMembers) {
    // Create temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

    const staffMember = await prisma.user.upsert({
      where: { email: staffData.email },
      update: {
        role: staffData.role as any,
        restaurantId: restaurant.id,
        hashedPassword: hashedTempPassword,
        phone: staffData.phone
      },
      create: {
        email: staffData.email,
        name: staffData.name,
        phone: staffData.phone,
        role: staffData.role as any,
        restaurantId: restaurant.id,
        hashedPassword: hashedTempPassword,
        marketingOptIn: false
      }
    });

    console.log(`${getRoleIcon(staffData.role)} Created ${staffData.role.toLowerCase()}: ${staffMember.name} (${staffMember.email}) - temp password: ${tempPassword}`);
  }

  // Log staff invitation events
  await prisma.event.create({
    data: {
      kind: 'STAFF_SEEDED',
      actorId: manager.id,
      restaurantId: restaurant.id,
      payloadJson: {
        staffCount: staffMembers.length,
        roles: staffMembers.map(s => s.role)
      }
    }
  });

  console.log('\n✅ Staff seeding completed!');
  console.log('\n📋 Login Credentials:');
  console.log('Manager: manager@lacarta.com / manager123');
  console.log('Staff members have temporary passwords shown above');
  console.log('\n🔗 Access the staff portal at: http://localhost:3000/staff');
}

function getRoleIcon(role: string): string {
  switch (role) {
    case 'HOST':
      return '🏛️';
    case 'SERVER':
      return '🍽️';
    case 'EXPO':
      return '📋';
    case 'KITCHEN':
      return '👨‍🍳';
    case 'MANAGER':
      return '👔';
    default:
      return '👥';
  }
}

main()
  .catch((e) => {
    console.error('❌ Error seeding staff:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });