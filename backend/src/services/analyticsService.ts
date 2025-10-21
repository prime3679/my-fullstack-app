/**
 * Analytics Service
 * Provides business intelligence and metrics for restaurant dashboards
 */

import { db } from '../lib/db';
import { Logger } from '../lib/logger';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface RevenueData {
  date: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface PopularItem {
  sku: string;
  name: string;
  category: string;
  orderCount: number;
  revenue: number;
}

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averagePartySize: number;
}

export interface OrderMetrics {
  totalOrders: number;
  completedOrders: number;
  canceledOrders: number;
  averageOrderValue: number;
  totalRevenue: number;
}

export interface PeakTimeData {
  hour: number;
  orderCount: number;
  dayOfWeek?: number;
}

export interface DashboardSummary {
  revenue: {
    today: number;
    yesterday: number;
    thisWeek: number;
    thisMonth: number;
    percentChange: number;
  };
  orders: {
    today: number;
    pending: number;
    completed: number;
  };
  activeReservations: number;
  kitchenTickets: {
    pending: number;
    fired: number;
    ready: number;
  };
}

export class AnalyticsService {
  /**
   * Get revenue data over a date range
   */
  async getRevenueByDate(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<RevenueData[]> {
    try {
      Logger.info('Fetching revenue data', {
        restaurantId,
        startDate,
        endDate,
        groupBy,
      });

      // Get all completed pre-orders in date range
      const preOrders = await db.preOrder.findMany({
        where: {
          reservation: {
            restaurantId,
            startAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          status: {
            in: ['AUTHORIZED', 'INJECTED_TO_POS', 'CLOSED'],
          },
        },
        include: {
          reservation: {
            select: {
              startAt: true,
            },
          },
        },
      });

      // Group by date
      const revenueMap = new Map<string, { revenue: number; count: number }>();

      for (const order of preOrders) {
        const date = this.formatDateByGroup(
          order.reservation.startAt,
          groupBy
        );

        if (!revenueMap.has(date)) {
          revenueMap.set(date, { revenue: 0, count: 0 });
        }

        const data = revenueMap.get(date)!;
        data.revenue += order.total;
        data.count += 1;
      }

      // Convert to array and calculate averages
      const revenueData: RevenueData[] = Array.from(revenueMap.entries())
        .map(([date, data]) => ({
          date,
          revenue: data.revenue / 100, // Convert cents to dollars
          orderCount: data.count,
          averageOrderValue: data.count > 0 ? data.revenue / data.count / 100 : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return revenueData;
    } catch (error) {
      Logger.error('Failed to fetch revenue data', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get popular menu items
   */
  async getPopularItems(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<PopularItem[]> {
    try {
      // Get all pre-order items in date range
      const items = await db.preOrderItem.findMany({
        where: {
          preorder: {
            reservation: {
              restaurantId,
              startAt: {
                gte: startDate,
                lte: endDate,
              },
            },
            status: {
              in: ['AUTHORIZED', 'INJECTED_TO_POS', 'CLOSED'],
            },
          },
        },
        select: {
          sku: true,
          name: true,
          quantity: true,
          price: true,
        },
      });

      // Aggregate by SKU
      const itemMap = new Map<
        string,
        { name: string; quantity: number; revenue: number }
      >();

      for (const item of items) {
        if (!itemMap.has(item.sku)) {
          itemMap.set(item.sku, {
            name: item.name,
            quantity: 0,
            revenue: 0,
          });
        }

        const data = itemMap.get(item.sku)!;
        data.quantity += item.quantity;
        data.revenue += item.price * item.quantity;
      }

      // Get menu items for categories
      const skus = Array.from(itemMap.keys());
      const menuItems = await db.menuItem.findMany({
        where: {
          sku: { in: skus },
          restaurantId,
        },
        select: {
          sku: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      });

      const categoryMap = new Map(
        menuItems.map((m) => [m.sku, m.category.name])
      );

      // Convert to array and sort by order count
      const popularItems: PopularItem[] = Array.from(itemMap.entries())
        .map(([sku, data]) => ({
          sku,
          name: data.name,
          category: categoryMap.get(sku) || 'Unknown',
          orderCount: data.quantity,
          revenue: data.revenue / 100, // Convert cents to dollars
        }))
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, limit);

      return popularItems;
    } catch (error) {
      Logger.error('Failed to fetch popular items', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get customer metrics
   */
  async getCustomerMetrics(
    restaurantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CustomerMetrics> {
    try {
      // Get all reservations in date range
      const reservations = await db.reservation.findMany({
        where: {
          restaurantId,
          startAt: {
            gte: startDate,
            lte: endDate,
          },
          status: {
            in: ['BOOKED', 'CHECKED_IN', 'COMPLETED'],
          },
        },
        select: {
          userId: true,
          partySize: true,
          createdAt: true,
        },
      });

      // Count unique customers
      const uniqueUserIds = new Set(
        reservations.filter((r) => r.userId).map((r) => r.userId)
      );
      const totalCustomers = uniqueUserIds.size;

      // Count new vs returning customers
      const newCustomerIds = new Set<string>();
      for (const reservation of reservations) {
        if (!reservation.userId) continue;

        // Check if customer had reservations before this date range
        const previousReservations = await db.reservation.count({
          where: {
            userId: reservation.userId,
            restaurantId,
            createdAt: {
              lt: startDate,
            },
          },
        });

        if (previousReservations === 0) {
          newCustomerIds.add(reservation.userId);
        }
      }

      const newCustomers = newCustomerIds.size;
      const returningCustomers = totalCustomers - newCustomers;

      // Calculate average party size
      const totalPartySize = reservations.reduce(
        (sum, r) => sum + r.partySize,
        0
      );
      const averagePartySize =
        reservations.length > 0 ? totalPartySize / reservations.length : 0;

      return {
        totalCustomers,
        newCustomers,
        returningCustomers,
        averagePartySize: Math.round(averagePartySize * 10) / 10, // Round to 1 decimal
      };
    } catch (error) {
      Logger.error('Failed to fetch customer metrics', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get order metrics
   */
  async getOrderMetrics(
    restaurantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<OrderMetrics> {
    try {
      const preOrders = await db.preOrder.findMany({
        where: {
          reservation: {
            restaurantId,
            startAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        select: {
          status: true,
          total: true,
        },
      });

      const totalOrders = preOrders.length;
      const completedOrders = preOrders.filter((o) =>
        ['AUTHORIZED', 'INJECTED_TO_POS', 'CLOSED'].includes(o.status)
      ).length;
      const canceledOrders = preOrders.filter(
        (o) => o.status === 'REFUNDED'
      ).length;

      const totalRevenue = preOrders
        .filter((o) =>
          ['AUTHORIZED', 'INJECTED_TO_POS', 'CLOSED'].includes(o.status)
        )
        .reduce((sum, o) => sum + o.total, 0);

      const averageOrderValue =
        completedOrders > 0 ? totalRevenue / completedOrders / 100 : 0;

      return {
        totalOrders,
        completedOrders,
        canceledOrders,
        averageOrderValue,
        totalRevenue: totalRevenue / 100, // Convert cents to dollars
      };
    } catch (error) {
      Logger.error('Failed to fetch order metrics', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get peak times for reservations
   */
  async getPeakTimes(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'dayOfWeek' = 'hour'
  ): Promise<PeakTimeData[]> {
    try {
      const reservations = await db.reservation.findMany({
        where: {
          restaurantId,
          startAt: {
            gte: startDate,
            lte: endDate,
          },
          status: {
            in: ['BOOKED', 'CHECKED_IN', 'COMPLETED'],
          },
        },
        select: {
          startAt: true,
        },
      });

      if (groupBy === 'hour') {
        // Group by hour of day (0-23)
        const hourMap = new Map<number, number>();

        for (const reservation of reservations) {
          const hour = reservation.startAt.getHours();
          hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
        }

        return Array.from(hourMap.entries())
          .map(([hour, count]) => ({
            hour,
            orderCount: count,
          }))
          .sort((a, b) => a.hour - b.hour);
      } else {
        // Group by day of week (0=Sunday, 6=Saturday)
        const dayMap = new Map<number, number>();

        for (const reservation of reservations) {
          const day = reservation.startAt.getDay();
          dayMap.set(day, (dayMap.get(day) || 0) + 1);
        }

        return Array.from(dayMap.entries())
          .map(([day, count]) => ({
            hour: 0, // Not used for day grouping
            dayOfWeek: day,
            orderCount: count,
          }))
          .sort((a, b) => (a.dayOfWeek || 0) - (b.dayOfWeek || 0));
      }
    } catch (error) {
      Logger.error('Failed to fetch peak times', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get dashboard summary with key metrics
   */
  async getDashboardSummary(restaurantId: string): Promise<DashboardSummary> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get revenue for different periods
      const [todayRevenue, yesterdayRevenue, weekRevenue, monthRevenue] =
        await Promise.all([
          this.getTotalRevenue(restaurantId, today, now),
          this.getTotalRevenue(restaurantId, yesterday, today),
          this.getTotalRevenue(restaurantId, weekStart, now),
          this.getTotalRevenue(restaurantId, monthStart, now),
        ]);

      // Calculate percent change from yesterday
      const percentChange =
        yesterdayRevenue > 0
          ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
          : 0;

      // Get order counts
      const [todayOrders, pendingOrders, completedOrders] = await Promise.all([
        db.preOrder.count({
          where: {
            reservation: {
              restaurantId,
              startAt: { gte: today },
            },
          },
        }),
        db.preOrder.count({
          where: {
            reservation: { restaurantId },
            status: { in: ['DRAFT', 'AUTHORIZED'] },
          },
        }),
        db.preOrder.count({
          where: {
            reservation: { restaurantId },
            status: { in: ['INJECTED_TO_POS', 'CLOSED'] },
          },
        }),
      ]);

      // Get active reservations (today and future)
      const activeReservations = await db.reservation.count({
        where: {
          restaurantId,
          startAt: { gte: today },
          status: { in: ['BOOKED', 'CHECKED_IN'] },
        },
      });

      // Get kitchen ticket counts
      const [pendingTickets, firedTickets, readyTickets] = await Promise.all([
        db.kitchenTicket.count({
          where: {
            reservation: { restaurantId },
            status: 'PENDING',
          },
        }),
        db.kitchenTicket.count({
          where: {
            reservation: { restaurantId },
            status: 'FIRED',
          },
        }),
        db.kitchenTicket.count({
          where: {
            reservation: { restaurantId },
            status: 'READY',
          },
        }),
      ]);

      return {
        revenue: {
          today: todayRevenue,
          yesterday: yesterdayRevenue,
          thisWeek: weekRevenue,
          thisMonth: monthRevenue,
          percentChange: Math.round(percentChange * 10) / 10,
        },
        orders: {
          today: todayOrders,
          pending: pendingOrders,
          completed: completedOrders,
        },
        activeReservations,
        kitchenTickets: {
          pending: pendingTickets,
          fired: firedTickets,
          ready: readyTickets,
        },
      };
    } catch (error) {
      Logger.error('Failed to fetch dashboard summary', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Helper: Get total revenue for a date range
   */
  private async getTotalRevenue(
    restaurantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const result = await db.preOrder.aggregate({
      where: {
        reservation: {
          restaurantId,
          startAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        status: {
          in: ['AUTHORIZED', 'INJECTED_TO_POS', 'CLOSED'],
        },
      },
      _sum: {
        total: true,
      },
    });

    return (result._sum.total || 0) / 100; // Convert cents to dollars
  }

  /**
   * Helper: Format date by grouping
   */
  private formatDateByGroup(date: Date, groupBy: 'day' | 'week' | 'month'): string {
    if (groupBy === 'day') {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    } else if (groupBy === 'week') {
      // Get Monday of the week
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      return d.toISOString().split('T')[0];
    } else {
      // Month: YYYY-MM
      return date.toISOString().substring(0, 7);
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
