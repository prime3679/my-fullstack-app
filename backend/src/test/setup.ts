import { db } from '../lib/db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

beforeAll(async () => {
  await db.$connect();
});

afterAll(async () => {
  await db.$disconnect();
});

beforeEach(async () => {
  const tablenames = await db.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`);

  try {
    await db.$executeRawUnsafe(`TRUNCATE ${tables.join(', ')} CASCADE;`);
  } catch (error) {
    console.log('Error truncating tables:', error);
  }
});

export const createTestUser = async (data?: Partial<any>) => {
  return await db.user.create({
    data: {
      email: data?.email || 'test@example.com',
      phone: data?.phone || '+1234567890',
      name: data?.name || 'Test User',
      hashedPassword: data?.hashedPassword || 'hashedpassword123',
    },
  });
};

export const createTestRestaurant = async (data?: Partial<any>) => {
  return await db.restaurant.create({
    data: {
      name: data?.name || 'Test Restaurant',
      slug: data?.slug || 'test-restaurant',
    },
  });
};

export const createTestReservation = async (userId: string, restaurantId: string, data?: Partial<any>) => {
  return await db.reservation.create({
    data: {
      userId,
      restaurantId,
      startAt: data?.startAt || new Date(),
      partySize: data?.partySize || 2,
      status: data?.status || 'CONFIRMED',
    },
  });
};

export const mockRequest = (overrides = {}) => ({
  headers: {},
  body: {},
  query: {},
  params: {},
  context: {
    requestId: 'test-request-id',
    ip: '127.0.0.1',
    userAgent: 'Jest Test',
  },
  ...overrides,
});

export const mockReply = () => {
  const reply: any = {
    code: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    headers: jest.fn().mockReturnThis(),
    removeHeader: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  };
  return reply;
};