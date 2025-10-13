import { db } from '../lib/db';
import { PreOrderStatus, Prisma } from '@prisma/client';

export interface CreatePreOrderItemInput {
  sku: string;
  quantity: number;
  modifiers?: Array<{
    modifierGroupId: string;
    modifierId: string;
  }>;
  notes?: string;
}

export interface CreatePreOrderInput {
  reservationId: string;
  items: CreatePreOrderItemInput[];
}

export interface PreOrderCalculation {
  subtotal: number;
  tax: number;
  total: number;
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    basePrice: number;
    modifierPrice: number;
    totalPrice: number;
    modifiers: Array<{
      id: string;
      name: string;
      price: number;
      modifierGroupId: string;
      modifierGroupName?: string;
      allergens: string[];
    }>;
    selections: Array<{
      modifierGroupId: string;
      modifierId: string;
    }>;
    allergens: string[];
  }>;
}

export class PreOrderService {

  async calculatePreOrder(restaurantId: string, items: CreatePreOrderItemInput[]): Promise<PreOrderCalculation> {
    let subtotal = 0;
    const calculatedItems = [];

    for (const orderItem of items) {
      // Get menu item details
      const menuItem = await db.menuItem.findUnique({
        where: {
          restaurantId_sku: {
            restaurantId,
            sku: orderItem.sku
          }
        },
        include: {
          modifierGroups: {
            include: {
              modifierGroup: {
                include: {
                  modifiers: true
                }
              }
            }
          }
        }
      });

      if (!menuItem) {
        throw new Error(`Menu item with SKU ${orderItem.sku} not found`);
      }

      if (!menuItem.isAvailable || menuItem.is86) {
        throw new Error(`Menu item ${menuItem.name} is not available`);
      }

      let modifierPrice = 0;
      const modifierDetails: PreOrderCalculation['items'][number]['modifiers'] = [];
      const modifierSelections: PreOrderCalculation['items'][number]['selections'] = [];
      const allergens = new Set<string>(
        Array.isArray(menuItem.allergensJson) ? (menuItem.allergensJson as string[]) : []
      );

      // Calculate modifier prices and validate selections
      if (orderItem.modifiers) {
        for (const modSelection of orderItem.modifiers) {
          const modifierGroup = menuItem.modifierGroups.find(mg => 
            mg.modifierGroup.id === modSelection.modifierGroupId
          );

          if (!modifierGroup) {
            throw new Error(`Modifier group not found for menu item ${menuItem.name}`);
          }

          const modifier = modifierGroup.modifierGroup.modifiers.find(m => 
            m.id === modSelection.modifierId
          );

          if (!modifier) {
            throw new Error(`Modifier not found in group ${modifierGroup.modifierGroup.name}`);
          }

          if (!modifier.isAvailable) {
            throw new Error(`Modifier ${modifier.name} is not available`);
          }

          modifierPrice += modifier.price;
          modifierSelections.push({
            modifierGroupId: modifierGroup.modifierGroup.id,
            modifierId: modifier.id
          });

          const modifierAllergens = Array.isArray(modifier.allergensJson)
            ? (modifier.allergensJson as string[])
            : [];

          modifierAllergens.forEach(allergen => allergens.add(allergen));

          modifierDetails.push({
            id: modifier.id,
            name: modifier.name,
            price: modifier.price,
            modifierGroupId: modifierGroup.modifierGroup.id,
            modifierGroupName: modifierGroup.modifierGroup.name,
            allergens: modifierAllergens
          });
        }

        // Validate required modifier groups
        const requiredGroups = menuItem.modifierGroups.filter(mg => mg.isRequired);
        for (const requiredGroup of requiredGroups) {
          const hasSelection = orderItem.modifiers.some(mod => 
            mod.modifierGroupId === requiredGroup.modifierGroup.id
          );
          
          if (!hasSelection) {
            throw new Error(`Required modifier group "${requiredGroup.modifierGroup.name}" not selected for ${menuItem.name}`);
          }
        }
      }

      const itemBasePrice = menuItem.price;
      const itemTotalPrice = (itemBasePrice + modifierPrice) * orderItem.quantity;
      
      subtotal += itemTotalPrice;

      calculatedItems.push({
        sku: orderItem.sku,
        name: menuItem.name,
        quantity: orderItem.quantity,
        basePrice: itemBasePrice,
        modifierPrice,
        totalPrice: itemTotalPrice,
        modifiers: modifierDetails,
        selections: modifierSelections,
        allergens: Array.from(allergens)
      });
    }

    // Simple tax calculation (8.25% NYC rate)
    const taxRate = 0.0825;
    const tax = Math.round(subtotal * taxRate);
    const total = subtotal + tax;

    return {
      subtotal,
      tax,
      total,
      items: calculatedItems
    };
  }

  async createPreOrder(input: CreatePreOrderInput): Promise<any> {
    // Verify reservation exists and doesn't already have a pre-order
    const reservation = await db.reservation.findUnique({
      where: { id: input.reservationId },
      include: {
        preOrder: true,
        restaurant: true
      }
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.preOrder) {
      throw new Error('Reservation already has a pre-order');
    }

    if (reservation.status === 'CANCELED' || reservation.status === 'NO_SHOW') {
      throw new Error('Cannot create pre-order for canceled or no-show reservation');
    }

    // Calculate pricing
    const calculation = await this.calculatePreOrder(reservation.restaurantId, input.items);

    // Create pre-order
    const preOrder = await db.$transaction(async (tx) => {
      const createdPreOrder = await tx.preOrder.create({
        data: {
          reservationId: input.reservationId,
          status: PreOrderStatus.DRAFT,
          subtotal: calculation.subtotal,
          tax: calculation.tax,
          tip: 0, // Will be set during payment
          total: calculation.total,
          currency: reservation.restaurant.currency
        }
      });

      // Create pre-order items
      for (let i = 0; i < input.items.length; i++) {
        const orderItem = input.items[i];
        const calculatedItem = calculation.items[i];

        await tx.preOrderItem.create({
          data: {
            preorderId: createdPreOrder.id,
            sku: orderItem.sku,
            name: calculatedItem.name,
            quantity: orderItem.quantity,
            price: calculatedItem.totalPrice,
            unitPrice: calculatedItem.basePrice + calculatedItem.modifierPrice,
            modifierTotal: calculatedItem.modifierPrice * orderItem.quantity,
            modifiersJson: {
              selections: calculatedItem.selections,
              details: calculatedItem.modifiers
            },
            notes: orderItem.notes,
            allergensJson: calculatedItem.allergens
          }
        });
      }

      // Log event
      await tx.event.create({
        data: {
          kind: 'preorder_created',
          restaurantId: reservation.restaurantId,
          reservationId: input.reservationId,
          payloadJson: {
            itemCount: input.items.length,
            subtotal: calculation.subtotal,
            total: calculation.total
          }
        }
      });

      return createdPreOrder;
    });

    // Return full pre-order with items
    return await this.getPreOrder(preOrder.id);
  }

  async getPreOrder(preOrderId: string) {
    const preOrder = await db.preOrder.findUnique({
      where: { id: preOrderId },
      include: {
        items: {
          orderBy: {
            createdAt: 'asc'
          }
        },
        payments: true,
        reservation: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            restaurant: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }
      }
    });

    if (!preOrder) {
      throw new Error('Pre-order not found');
    }

    return preOrder;
  }

  async updatePreOrderItem(preOrderId: string, itemId: string, updates: {
    quantity?: number;
    notes?: string;
  }) {
    // Verify pre-order is still in draft status
    const preOrder = await db.preOrder.findUnique({
      where: { id: preOrderId },
      include: { items: true }
    });

    if (!preOrder) {
      throw new Error('Pre-order not found');
    }

    if (preOrder.status !== PreOrderStatus.DRAFT) {
      throw new Error('Cannot modify pre-order that is not in draft status');
    }

    await db.preOrderItem.update({
      where: {
        id: itemId,
        preorderId: preOrderId
      },
      data: updates
    });

    if (typeof updates.quantity === 'number') {
      await this.recalculatePreOrderTotals(preOrderId);
    }

    return db.preOrderItem.findUnique({
      where: { id: itemId },
      include: { preorder: true }
    });
  }

  async removePreOrderItem(preOrderId: string, itemId: string) {
    // Verify pre-order is still in draft status
    const preOrder = await db.preOrder.findUnique({
      where: { id: preOrderId }
    });

    if (!preOrder) {
      throw new Error('Pre-order not found');
    }

    if (preOrder.status !== PreOrderStatus.DRAFT) {
      throw new Error('Cannot modify pre-order that is not in draft status');
    }

    await db.preOrderItem.delete({
      where: {
        id: itemId,
        preorderId: preOrderId
      }
    });

    await this.recalculatePreOrderTotals(preOrderId);
  }

  async updatePreOrderStatus(preOrderId: string, status: PreOrderStatus, actorId?: string) {
    const preOrder = await db.preOrder.update({
      where: { id: preOrderId },
      data: { status }
    });

    // Log status change
    await db.event.create({
      data: {
        kind: 'preorder_status_changed',
        actorId,
        payloadJson: {
          preOrderId,
          newStatus: status
        }
      }
    });

    return preOrder;
  }

  async getPreOrdersByRestaurant(restaurantId: string, date?: string) {
    const whereClause: any = {
      reservation: {
        restaurantId
      }
    };

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      whereClause.reservation = {
        ...whereClause.reservation,
        startAt: {
          gte: startDate,
          lt: endDate
        }
      };
    }

    const preOrders = await db.preOrder.findMany({
      where: whereClause,
      include: {
        items: true,
        reservation: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return preOrders;
  }

  private async recalculatePreOrderTotals(
    preOrderId: string,
    prismaClient: Prisma.TransactionClient | typeof db = db
  ) {
    const preOrder = await prismaClient.preOrder.findUnique({
      where: { id: preOrderId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' }
        },
        reservation: {
          include: {
            restaurant: {
              select: { id: true, currency: true }
            }
          }
        }
      }
    });

    if (!preOrder) {
      throw new Error('Pre-order not found');
    }

    if (!preOrder.reservation) {
      throw new Error('Pre-order is missing reservation context');
    }

    const itemsInput: CreatePreOrderItemInput[] = preOrder.items.map(item => {
      const modifiersPayload = item.modifiersJson as any;
      const selections = Array.isArray(modifiersPayload?.selections)
        ? modifiersPayload.selections
        : [];

      return {
        sku: item.sku,
        quantity: item.quantity,
        modifiers: selections
      };
    });

    const calculation = await this.calculatePreOrder(
      preOrder.reservation.restaurantId,
      itemsInput
    );

    await prismaClient.preOrder.update({
      where: { id: preOrderId },
      data: {
        subtotal: calculation.subtotal,
        tax: calculation.tax,
        total: calculation.total
      }
    });

    await Promise.all(
      preOrder.items.map((item, index) => {
        const calculatedItem = calculation.items[index];

        if (!calculatedItem) {
          return prismaClient.preOrderItem.delete({ where: { id: item.id } });
        }

        return prismaClient.preOrderItem.update({
          where: { id: item.id },
          data: {
            price: calculatedItem.totalPrice,
            unitPrice: calculatedItem.basePrice + calculatedItem.modifierPrice,
            modifierTotal: calculatedItem.modifierPrice * calculatedItem.quantity,
            modifiersJson: {
              selections: calculatedItem.selections,
              details: calculatedItem.modifiers
            },
            allergensJson: calculatedItem.allergens
          }
        });
      })
    );

    return calculation;
  }
}
