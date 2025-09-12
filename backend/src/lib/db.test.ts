import test from 'node:test';
import assert from 'node:assert/strict';

test('db exports a PrismaClient-like singleton', async () => {
  // Ensure no existing prisma instance
  // @ts-ignore
  delete globalThis.prisma;

  const { db } = await import('./db');

  assert.equal(typeof db.$queryRaw, 'function', 'db should expose $queryRaw method');
  // @ts-ignore
  assert.strictEqual(globalThis.prisma, db, 'db should be stored on globalThis.prisma');

  const { db: dbAgain } = await import('./db');
  assert.strictEqual(dbAgain, db, 'subsequent imports should return same instance');

  await db.$disconnect();
});

