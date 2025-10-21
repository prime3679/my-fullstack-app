/**
 * Export Service
 * Handles CSV and PDF export generation for analytics data
 */

import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { Writable } from 'stream';
import { Logger } from '../lib/logger';
import { analyticsService } from './analyticsService';

export class ExportService {
  /**
   * Generate CSV export for revenue data
   */
  async generateRevenueCSV(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<string> {
    try {
      const revenueData = await analyticsService.getRevenueByDate(
        restaurantId,
        startDate,
        endDate,
        groupBy
      );

      const fields = [
        { label: 'Date', value: 'date' },
        { label: 'Revenue ($)', value: 'revenue' },
        { label: 'Order Count', value: 'orderCount' },
        { label: 'Average Order Value ($)', value: 'averageOrderValue' },
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(revenueData);

      Logger.info('Generated revenue CSV export', {
        restaurantId,
        rows: revenueData.length,
      });

      return csv;
    } catch (error) {
      Logger.error('Failed to generate revenue CSV', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate CSV export for popular items
   */
  async generatePopularItemsCSV(
    restaurantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 50
  ): Promise<string> {
    try {
      const items = await analyticsService.getPopularItems(
        restaurantId,
        startDate,
        endDate,
        limit
      );

      const fields = [
        { label: 'SKU', value: 'sku' },
        { label: 'Item Name', value: 'name' },
        { label: 'Category', value: 'category' },
        { label: 'Order Count', value: 'orderCount' },
        { label: 'Revenue ($)', value: 'revenue' },
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(items);

      Logger.info('Generated popular items CSV export', {
        restaurantId,
        rows: items.length,
      });

      return csv;
    } catch (error) {
      Logger.error('Failed to generate popular items CSV', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate CSV export for customer data
   */
  async generateCustomerCSV(
    restaurantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    try {
      // Get customer list with their order history
      const customers = await this.getCustomerList(restaurantId, startDate, endDate);

      const fields = [
        { label: 'Customer Name', value: 'name' },
        { label: 'Email', value: 'email' },
        { label: 'Phone', value: 'phone' },
        { label: 'Total Orders', value: 'orderCount' },
        { label: 'Total Spent ($)', value: 'totalSpent' },
        { label: 'Average Order Value ($)', value: 'averageOrderValue' },
        { label: 'First Visit', value: 'firstVisit' },
        { label: 'Last Visit', value: 'lastVisit' },
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(customers);

      Logger.info('Generated customer CSV export', {
        restaurantId,
        rows: customers.length,
      });

      return csv;
    } catch (error) {
      Logger.error('Failed to generate customer CSV', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate PDF report for analytics dashboard
   */
  async generateDashboardPDF(restaurantId: string): Promise<Buffer> {
    try {
      const summary = await analyticsService.getDashboardSummary(restaurantId);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const [revenueData, popularItems, customerMetrics] = await Promise.all([
        analyticsService.getRevenueByDate(restaurantId, startDate, endDate, 'day'),
        analyticsService.getPopularItems(restaurantId, startDate, endDate, 10),
        analyticsService.getCustomerMetrics(restaurantId, startDate, endDate),
      ]);

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(24).text('Restaurant Analytics Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, {
          align: 'center',
        });
        doc.moveDown(2);

        // Summary Section
        doc.fontSize(18).text('Dashboard Summary', { underline: true });
        doc.moveDown();
        doc.fontSize(12);
        doc.text(`Today's Revenue: $${summary.revenue.today.toFixed(2)}`);
        doc.text(`Week Revenue: $${summary.revenue.thisWeek.toFixed(2)}`);
        doc.text(`Month Revenue: $${summary.revenue.thisMonth.toFixed(2)}`);
        doc.text(`Change from Yesterday: ${summary.revenue.percentChange.toFixed(1)}%`);
        doc.moveDown();
        doc.text(`Active Reservations: ${summary.activeReservations}`);
        doc.text(`Today's Orders: ${summary.orders.today}`);
        doc.text(`Pending Orders: ${summary.orders.pending}`);
        doc.text(`Completed Orders: ${summary.orders.completed}`);
        doc.moveDown(2);

        // Customer Metrics
        doc.fontSize(18).text('Customer Metrics (Last 30 Days)', { underline: true });
        doc.moveDown();
        doc.fontSize(12);
        doc.text(`Total Customers: ${customerMetrics.totalCustomers}`);
        doc.text(`New Customers: ${customerMetrics.newCustomers}`);
        doc.text(`Returning Customers: ${customerMetrics.returningCustomers}`);
        doc.text(`Average Party Size: ${customerMetrics.averagePartySize}`);
        doc.moveDown(2);

        // Popular Items
        doc.addPage();
        doc.fontSize(18).text('Top 10 Popular Items', { underline: true });
        doc.moveDown();
        doc.fontSize(10);

        popularItems.forEach((item, index) => {
          doc.text(
            `${index + 1}. ${item.name} (${item.category}) - ${item.orderCount} orders, $${item.revenue.toFixed(2)}`
          );
        });

        doc.moveDown(2);

        // Revenue Trend Table
        doc.fontSize(18).text('Revenue Trend (Last 30 Days)', { underline: true });
        doc.moveDown();
        doc.fontSize(10);

        // Show first 10 days as sample
        revenueData.slice(0, 10).forEach((day) => {
          doc.text(
            `${day.date}: $${day.revenue.toFixed(2)} (${day.orderCount} orders)`
          );
        });

        if (revenueData.length > 10) {
          doc.text(`... and ${revenueData.length - 10} more days`);
        }

        // Footer
        doc.fontSize(8).text('La Carta Analytics - Confidential', {
          align: 'center',
        });

        doc.end();
      });
    } catch (error) {
      Logger.error('Failed to generate PDF report', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Helper: Get customer list with order history
   */
  private async getCustomerList(
    restaurantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const { db } = await import('../lib/db');

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
            phone: true,
          },
        },
        preOrder: {
          select: {
            total: true,
            status: true,
          },
        },
      },
    });

    // Group by customer
    const customerMap = new Map<string, any>();

    for (const reservation of reservations) {
      if (!reservation.user) continue;

      const userId = reservation.user.id;

      if (!customerMap.has(userId)) {
        customerMap.set(userId, {
          name: reservation.user.name,
          email: reservation.user.email,
          phone: reservation.user.phone || '',
          orderCount: 0,
          totalSpent: 0,
          firstVisit: reservation.startAt,
          lastVisit: reservation.startAt,
        });
      }

      const customer = customerMap.get(userId)!;
      customer.orderCount += 1;

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

    // Convert to array and calculate averages
    return Array.from(customerMap.values()).map((customer) => ({
      ...customer,
      totalSpent: customer.totalSpent / 100, // Convert cents to dollars
      averageOrderValue:
        customer.orderCount > 0
          ? customer.totalSpent / customer.orderCount / 100
          : 0,
      firstVisit: customer.firstVisit.toISOString().split('T')[0],
      lastVisit: customer.lastVisit.toISOString().split('T')[0],
    }));
  }
}

// Export singleton instance
export const exportService = new ExportService();
