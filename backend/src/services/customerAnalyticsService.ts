/**
 * Customer Analytics Service
 * Handles customer segmentation, LTV, and cohort analysis
 */

import { Logger } from '../lib/logger';
import { db } from '../lib/db';

interface CustomerSegment {
  segment: string;
  customerCount: number;
  averageLTV: number;
  totalRevenue: number;
  averageVisits: number;
}

interface CustomerLTV {
  customerId: string;
  customerName: string;
  email: string;
  totalSpent: number;
  visitCount: number;
  averageOrderValue: number;
  firstVisit: Date;
  lastVisit: Date;
  daysSinceFirstVisit: number;
  segment: string;
}

interface CohortData {
  cohort: string; // YYYY-MM format
  customersAcquired: number;
  retentionRate: number;
  averageLTV: number;
  totalRevenue: number;
}

interface VisitFrequencyData {
  frequency: string;
  customerCount: number;
  percentage: number;
}

export class CustomerAnalyticsService {
  /**
   * Get customer lifetime value analysis
   */
  async getCustomerLTV(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<CustomerLTV[]> {
    try {
      const reservations = await db.reservation.findMany({
        where: {
          restaurantId,
          startAt: {
            gte: startDate,
            lte: endDate,
          },
          userId: { not: null },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          preOrder: {
            select: {
              total: true,
              status: true,
            },
          },
        },
        orderBy: {
          startAt: 'asc',
        },
      });

      // Group by customer
      const customerMap = new Map<string, any>();

      for (const reservation of reservations) {
        if (!reservation.user) continue;

        const userId = reservation.user.id;

        if (!customerMap.has(userId)) {
          customerMap.set(userId, {
            customerId: userId,
            customerName: reservation.user.name,
            email: reservation.user.email,
            totalSpent: 0,
            visitCount: 0,
            firstVisit: reservation.startAt,
            lastVisit: reservation.startAt,
          });
        }

        const customer = customerMap.get(userId)!;
        customer.visitCount += 1;

        if (
          reservation.preOrder &&
          ['AUTHORIZED', 'INJECTED_TO_POS', 'CLOSED'].includes(
            reservation.preOrder.status
          )
        ) {
          customer.totalSpent += reservation.preOrder.total;
        }

        if (reservation.startAt < customer.firstVisit) {
          customer.firstVisit = reservation.startAt;
        }
        if (reservation.startAt > customer.lastVisit) {
          customer.lastVisit = reservation.startAt;
        }
      }

      // Calculate metrics and segment customers
      const customers: CustomerLTV[] = Array.from(customerMap.values())
        .map((customer) => {
          const totalSpentDollars = customer.totalSpent / 100;
          const daysSinceFirstVisit = Math.floor(
            (new Date().getTime() - customer.firstVisit.getTime()) /
              (1000 * 60 * 60 * 24)
          );

          return {
            customerId: customer.customerId,
            customerName: customer.customerName,
            email: customer.email,
            totalSpent: totalSpentDollars,
            visitCount: customer.visitCount,
            averageOrderValue:
              customer.visitCount > 0 ? totalSpentDollars / customer.visitCount : 0,
            firstVisit: customer.firstVisit,
            lastVisit: customer.lastVisit,
            daysSinceFirstVisit,
            segment: this.determineSegment(totalSpentDollars, customer.visitCount),
          };
        })
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, limit);

      Logger.info('Calculated customer LTV', {
        restaurantId,
        customerCount: customers.length,
      });

      return customers;
    } catch (error) {
      Logger.error('Failed to calculate customer LTV', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get customer segmentation analysis
   */
  async getCustomerSegmentation(
    restaurantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CustomerSegment[]> {
    try {
      const customers = await this.getCustomerLTV(restaurantId, startDate, endDate, 10000);

      // Group by segment
      const segmentMap = new Map<string, any>();

      for (const customer of customers) {
        if (!segmentMap.has(customer.segment)) {
          segmentMap.set(customer.segment, {
            segment: customer.segment,
            customerCount: 0,
            totalLTV: 0,
            totalRevenue: 0,
            totalVisits: 0,
          });
        }

        const segment = segmentMap.get(customer.segment)!;
        segment.customerCount += 1;
        segment.totalLTV += customer.totalSpent;
        segment.totalRevenue += customer.totalSpent;
        segment.totalVisits += customer.visitCount;
      }

      // Calculate averages
      const segments: CustomerSegment[] = Array.from(segmentMap.values()).map(
        (segment) => ({
          segment: segment.segment,
          customerCount: segment.customerCount,
          averageLTV: segment.customerCount > 0 ? segment.totalLTV / segment.customerCount : 0,
          totalRevenue: segment.totalRevenue,
          averageVisits:
            segment.customerCount > 0 ? segment.totalVisits / segment.customerCount : 0,
        })
      );

      // Sort by revenue
      segments.sort((a, b) => b.totalRevenue - a.totalRevenue);

      Logger.info('Calculated customer segmentation', {
        restaurantId,
        segmentCount: segments.length,
      });

      return segments;
    } catch (error) {
      Logger.error('Failed to calculate customer segmentation', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get visit frequency distribution
   */
  async getVisitFrequency(
    restaurantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<VisitFrequencyData[]> {
    try {
      const customers = await this.getCustomerLTV(restaurantId, startDate, endDate, 10000);

      const frequencies = {
        'New (1 visit)': 0,
        'Occasional (2-3 visits)': 0,
        'Regular (4-9 visits)': 0,
        'VIP (10+ visits)': 0,
      };

      for (const customer of customers) {
        if (customer.visitCount === 1) {
          frequencies['New (1 visit)']++;
        } else if (customer.visitCount <= 3) {
          frequencies['Occasional (2-3 visits)']++;
        } else if (customer.visitCount <= 9) {
          frequencies['Regular (4-9 visits)']++;
        } else {
          frequencies['VIP (10+ visits)']++;
        }
      }

      const totalCustomers = customers.length;
      const frequencyData: VisitFrequencyData[] = Object.entries(frequencies).map(
        ([frequency, count]) => ({
          frequency,
          customerCount: count,
          percentage: totalCustomers > 0 ? (count / totalCustomers) * 100 : 0,
        })
      );

      Logger.info('Calculated visit frequency distribution', {
        restaurantId,
        totalCustomers,
      });

      return frequencyData;
    } catch (error) {
      Logger.error('Failed to calculate visit frequency', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get cohort analysis (customers grouped by acquisition month)
   */
  async getCohortAnalysis(
    restaurantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CohortData[]> {
    try {
      const customers = await this.getCustomerLTV(restaurantId, startDate, endDate, 10000);

      // Group by cohort (first visit month)
      const cohortMap = new Map<string, any>();

      for (const customer of customers) {
        const cohort = `${customer.firstVisit.getFullYear()}-${String(
          customer.firstVisit.getMonth() + 1
        ).padStart(2, '0')}`;

        if (!cohortMap.has(cohort)) {
          cohortMap.set(cohort, {
            cohort,
            customers: [],
            totalRevenue: 0,
          });
        }

        const cohortData = cohortMap.get(cohort)!;
        cohortData.customers.push(customer);
        cohortData.totalRevenue += customer.totalSpent;
      }

      // Calculate retention rates
      const cohorts: CohortData[] = Array.from(cohortMap.values()).map((cohortData) => {
        const customersAcquired = cohortData.customers.length;
        const activeCustomers = cohortData.customers.filter(
          (c: CustomerLTV) => c.visitCount > 1
        ).length;
        const retentionRate =
          customersAcquired > 0 ? (activeCustomers / customersAcquired) * 100 : 0;
        const averageLTV =
          customersAcquired > 0 ? cohortData.totalRevenue / customersAcquired : 0;

        return {
          cohort: cohortData.cohort,
          customersAcquired,
          retentionRate,
          averageLTV,
          totalRevenue: cohortData.totalRevenue,
        };
      });

      // Sort by cohort date (newest first)
      cohorts.sort((a, b) => b.cohort.localeCompare(a.cohort));

      Logger.info('Calculated cohort analysis', {
        restaurantId,
        cohortCount: cohorts.length,
      });

      return cohorts;
    } catch (error) {
      Logger.error('Failed to calculate cohort analysis', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Determine customer segment based on spend and visits
   */
  private determineSegment(totalSpent: number, visitCount: number): string {
    if (totalSpent >= 1000 || visitCount >= 20) {
      return 'Platinum';
    } else if (totalSpent >= 500 || visitCount >= 10) {
      return 'Gold';
    } else if (totalSpent >= 200 || visitCount >= 5) {
      return 'Silver';
    } else {
      return 'Bronze';
    }
  }
}

// Export singleton instance
export const customerAnalyticsService = new CustomerAnalyticsService();
