import request from 'supertest';
import { fastify } from 'fastify';
import { prisma, cleanDatabase } from './setup';
import { preOrderRoutes } from '../src/routes/preorders';
import { checkinRoutes } from '../src/routes/checkin';
import { kitchenRoutes } from '../src/routes/kitchen';
import { WebSocketManager } from '../src/lib/websocketManager';

describe('End-to-end reservation to kitchen flow', () => {
  const app = fastify({ logger: false });
  let wsManager: WebSocketManager;
  let restaurantId: string;
  let locationId: string;
  let tableId: string;
  let menuItemSku: string;
  let modifierGroupId: string;
  let modifierId: string;
  let reservationId: string;
  let userId: string;

  beforeAll(async () => {
    await cleanDatabase();

    wsManager = new WebSocketManager(app);
    (global as any).websocketManager = wsManager;
    await wsManager.initialize();

    await app.register(preOrderRoutes, { prefix: '/api/v1/preorders' });
    await app.register(checkinRoutes, { prefix: '/api/v1/checkin' });
    await app.register(kitchenRoutes, { prefix: '/api/v1/kitchen' });

    await app.ready();

    await setupTestData();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupTestData() {
    const restaurant = await prisma.restaurant.create({
      data: {
        name: 'Integration Bistro',
        slug: 'integration-bistro',
        currency: 'USD'
      }
    });
    restaurantId = restaurant.id;

    const location = await prisma.location.create({
      data: {
        restaurantId,
        address: '123 Integration Way'
      }
    });
    locationId = location.id;

    const table = await prisma.table.create({
      data: {
        locationId,
        label: 'T1',
        seats: 4
      }
    });
    tableId = table.id;

    const category = await prisma.menuCategory.create({
      data: {
        restaurantId,
        name: 'Mains'
      }
    });

    const menuItem = await prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId: category.id,
        sku: 'MAIN_INT_01',
        name: 'Roasted Salmon',
        price: 2500,
        allergensJson: ['fish']
      }
    });
    menuItemSku = menuItem.sku;

    const modifierGroup = await prisma.modifierGroup.create({
      data: {
        restaurantId,
        name: 'Sauce Choice',
        isRequired: false
      }
    });
    modifierGroupId = modifierGroup.id;

    const modifier = await prisma.modifier.create({
      data: {
        modifierGroupId,
        name: 'Truffle Butter',
        price: 300,
        allergensJson: ['dairy']
      }
    });
    modifierId = modifier.id;

    await prisma.menuItemModifierGroup.create({
      data: {
        menuItemId: menuItem.id,
        modifierGroupId,
        isRequired: false
      }
    });

    const user = await prisma.user.create({
      data: {
        email: 'integration@test.com',
        name: 'Integration Tester',
        phone: '+15555550123',
        role: 'DINER'
      }
    });
    userId = user.id;

    const reservation = await prisma.reservation.create({
      data: {
        restaurantId,
        userId,
        partySize: 2,
        startAt: new Date(Date.now() + 30 * 60 * 1000),
        status: 'BOOKED'
      }
    });
    reservationId = reservation.id;
  }

  it('creates pre-order, recalculates totals, and drives kitchen ticket on check-in', async () => {
    const preOrderResponse = await request(app.server)
      .post('/api/v1/preorders')
      .send({
        reservationId,
        items: [
          {
            sku: menuItemSku,
            quantity: 2,
            modifiers: [
              { modifierGroupId, modifierId }
            ],
            notes: 'Extra crispy'
          }
        ]
      })
      .expect(201);

    expect(preOrderResponse.body.success).toBe(true);
    const preOrder = preOrderResponse.body.data;
    expect(preOrder.items[0].allergensJson).toEqual(expect.arrayContaining(['fish', 'dairy']));
    expect(preOrder.items[0].modifiersJson.details[0].name).toBe('Truffle Butter');
    expect(preOrder.subtotal).toBe( (2500 + 300) * 2 );

    const itemId = preOrder.items[0].id;

    // Update quantity and verify totals recalculated
    const updateResponse = await request(app.server)
      .patch(`/api/v1/preorders/${preOrder.id}/items/${itemId}`)
      .send({ quantity: 3 })
      .expect(200);

    expect(updateResponse.body.success).toBe(true);

    const updatedPreOrder = await prisma.preOrder.findUnique({
      where: { id: preOrder.id },
      include: { items: true }
    });

    expect(updatedPreOrder?.items[0].quantity).toBe(3);
    expect(updatedPreOrder?.subtotal).toBe((2500 + 300) * 3);
    expect(updatedPreOrder?.tax).toBe(Math.round(((2500 + 300) * 3) * 0.0825));

    const checkInResponse = await request(app.server)
      .post('/api/v1/checkin/scan')
      .send({
        reservationId,
        method: 'QR_SCAN',
        locationId,
        tableId
      })
      .expect(200);

    expect(checkInResponse.body.success).toBe(true);
    expect(checkInResponse.body.data.kitchenTicket.itemsJson[0].modifiers[0].name).toBe('Truffle Butter');

    const ticketsResponse = await request(app.server)
      .get(`/api/v1/kitchen/tickets?restaurantId=${restaurantId}`)
      .expect(200);

    expect(ticketsResponse.body.success).toBe(true);
    expect(ticketsResponse.body.data.length).toBe(1);
    expect(ticketsResponse.body.data[0].itemsJson[0].allergens).toEqual(expect.arrayContaining(['fish', 'dairy']));
  });

  it('recalculates totals when items are removed from a pre-order', async () => {
    const reservation = await prisma.reservation.create({
      data: {
        restaurantId,
        userId,
        partySize: 2,
        startAt: new Date(Date.now() + 60 * 60 * 1000),
        status: 'BOOKED'
      }
    });

    const response = await request(app.server)
      .post('/api/v1/preorders')
      .send({
        reservationId: reservation.id,
        items: [
          {
            sku: menuItemSku,
            quantity: 1
          }
        ]
      })
      .expect(201);

    const preOrderId = response.body.data.id;
    const preOrderItemId = response.body.data.items[0].id;

    await request(app.server)
      .delete(`/api/v1/preorders/${preOrderId}/items/${preOrderItemId}`)
      .expect(200);

    const updatedPreOrder = await prisma.preOrder.findUnique({
      where: { id: preOrderId },
      include: { items: true }
    });

    expect(updatedPreOrder?.items.length).toBe(0);
    expect(updatedPreOrder?.subtotal).toBe(0);
    expect(updatedPreOrder?.tax).toBe(0);
    expect(updatedPreOrder?.total).toBe(0);
  });
});
