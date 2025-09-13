import { FastifyInstance } from 'fastify';
import { PreOrderService, CreatePreOrderInput } from '../services/preOrderService';

const preOrderService = new PreOrderService();

interface PreOrderParams {
  id: string;
  itemId?: string;
}

interface PreOrderBody {
  reservationId: string;
  items: Array<{
    sku: string;
    quantity: number;
    modifiers?: Array<{
      modifierGroupId: string;
      modifierId: string;
    }>;
    notes?: string;
  }>;
}

interface UpdatePreOrderItemBody {
  quantity?: number;
  notes?: string;
}

export async function preOrderRoutes(fastify: FastifyInstance) {

  // Create a new pre-order
  fastify.post<{
    Body: PreOrderBody;
  }>('/', async (request, reply) => {
    try {
      const { reservationId, items } = request.body;

      // Validation
      if (!reservationId || !items || items.length === 0) {
        return reply.code(400).send({
          error: 'reservationId and items are required'
        });
      }

      // Validate each item
      for (const item of items) {
        if (!item.sku || !item.quantity || item.quantity <= 0) {
          return reply.code(400).send({
            error: 'Each item must have a valid sku and quantity > 0'
          });
        }

        if (item.quantity > 10) {
          return reply.code(400).send({
            error: 'Maximum quantity per item is 10'
          });
        }
      }

      const input: CreatePreOrderInput = {
        reservationId,
        items
      };

      const preOrder = await preOrderService.createPreOrder(input);

      return reply.code(201).send({
        success: true,
        data: preOrder
      });
    } catch (error) {
      console.error('Pre-order creation failed:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || 
            error.message.includes('not available') ||
            error.message.includes('already has') ||
            error.message.includes('canceled') ||
            error.message.includes('Required modifier')) {
          return reply.code(400).send({
            error: error.message
          });
        }
      }

      return reply.code(500).send({
        error: 'Failed to create pre-order'
      });
    }
  });

  // Get pre-order by ID
  fastify.get<{
    Params: PreOrderParams;
  }>('/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      const preOrder = await preOrderService.getPreOrder(id);

      return {
        success: true,
        data: preOrder
      };
    } catch (error) {
      console.error('Failed to get pre-order:', error);
      if (error instanceof Error && error.message === 'Pre-order not found') {
        return reply.code(404).send({
          error: 'Pre-order not found'
        });
      }
      return reply.code(500).send({
        error: 'Failed to retrieve pre-order'
      });
    }
  });

  // Update pre-order item
  fastify.patch<{
    Params: PreOrderParams;
    Body: UpdatePreOrderItemBody;
  }>('/:id/items/:itemId', async (request, reply) => {
    try {
      const { id, itemId } = request.params;
      const updates = request.body;

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({
          error: 'At least one field to update must be provided'
        });
      }

      if (updates.quantity && (updates.quantity <= 0 || updates.quantity > 10)) {
        return reply.code(400).send({
          error: 'Quantity must be between 1 and 10'
        });
      }

      const item = await preOrderService.updatePreOrderItem(id, itemId!, updates);

      return {
        success: true,
        data: item
      };
    } catch (error) {
      console.error('Failed to update pre-order item:', error);
      if (error instanceof Error) {
        if (error.message.includes('not found') || 
            error.message.includes('not in draft')) {
          return reply.code(400).send({
            error: error.message
          });
        }
      }
      return reply.code(500).send({
        error: 'Failed to update pre-order item'
      });
    }
  });

  // Remove item from pre-order
  fastify.delete<{
    Params: PreOrderParams;
  }>('/:id/items/:itemId', async (request, reply) => {
    try {
      const { id, itemId } = request.params;

      await preOrderService.removePreOrderItem(id, itemId!);

      return {
        success: true,
        message: 'Item removed from pre-order'
      };
    } catch (error) {
      console.error('Failed to remove pre-order item:', error);
      if (error instanceof Error) {
        if (error.message.includes('not found') || 
            error.message.includes('not in draft')) {
          return reply.code(400).send({
            error: error.message
          });
        }
      }
      return reply.code(500).send({
        error: 'Failed to remove item from pre-order'
      });
    }
  });

  // Update pre-order status (for restaurant staff)
  fastify.patch<{
    Params: PreOrderParams;
    Body: {
      status: string;
    };
  }>('/:id/status', async (request, reply) => {
    try {
      const { id } = request.params;
      const { status } = request.body;

      const validStatuses = ['DRAFT', 'AUTHORIZED', 'INJECTED_TO_POS', 'CLOSED', 'REFUNDED', 'ADJUSTED'];
      if (!validStatuses.includes(status)) {
        return reply.code(400).send({
          error: 'Invalid status',
          validStatuses
        });
      }

      const preOrder = await preOrderService.updatePreOrderStatus(id, status as any);

      return {
        success: true,
        data: preOrder
      };
    } catch (error) {
      console.error('Failed to update pre-order status:', error);
      return reply.code(500).send({
        error: 'Failed to update pre-order status'
      });
    }
  });

  // Get pre-orders for a restaurant (for staff dashboard)
  fastify.get<{
    Querystring: {
      restaurantId: string;
      date?: string;
    };
  }>('/restaurant/list', async (request, reply) => {
    try {
      const { restaurantId, date } = request.query;

      if (!restaurantId) {
        return reply.code(400).send({
          error: 'restaurantId is required'
        });
      }

      const preOrders = await preOrderService.getPreOrdersByRestaurant(restaurantId, date);

      return {
        success: true,
        data: {
          restaurantId,
          date: date || 'all',
          count: preOrders.length,
          preOrders
        }
      };
    } catch (error) {
      console.error('Failed to get restaurant pre-orders:', error);
      return reply.code(500).send({
        error: 'Failed to retrieve pre-orders'
      });
    }
  });

  // Calculate pre-order pricing (for frontend preview)
  fastify.post<{
    Body: {
      restaurantId: string;
      items: Array<{
        sku: string;
        quantity: number;
        modifiers?: Array<{
          modifierGroupId: string;
          modifierId: string;
        }>;
      }>;
    };
  }>('/calculate', async (request, reply) => {
    try {
      const { restaurantId, items } = request.body;

      if (!restaurantId || !items || items.length === 0) {
        return reply.code(400).send({
          error: 'restaurantId and items are required'
        });
      }

      const calculation = await preOrderService.calculatePreOrder(restaurantId, items);

      return {
        success: true,
        data: calculation
      };
    } catch (error) {
      console.error('Pre-order calculation failed:', error);
      if (error instanceof Error) {
        if (error.message.includes('not found') || 
            error.message.includes('not available') ||
            error.message.includes('Required modifier')) {
          return reply.code(400).send({
            error: error.message
          });
        }
      }
      return reply.code(500).send({
        error: 'Failed to calculate pre-order'
      });
    }
  });
}