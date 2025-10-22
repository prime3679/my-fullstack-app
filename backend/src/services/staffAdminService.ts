import { db } from '../lib/db';
import { Logger } from '../lib/logger';
import { UserRole } from '@prisma/client';

// ==================== INTERFACES ====================

export interface InviteStaffInput {
  restaurantId: string;
  email: string;
  name: string;
  role: UserRole;
  invitedBy?: string;
}

export interface UpdateStaffRoleInput {
  userId: string;
  restaurantId: string;
  role: UserRole;
  updatedBy?: string;
}

export interface RestaurantSettings {
  operatingHours?: {
    [key: string]: { open: string; close: string; closed?: boolean };
  };
  reservationRules?: {
    maxPartySize?: number;
    minPartySize?: number;
    bookingWindowDays?: number;
    timeSlotDuration?: number;
    requirePrePayment?: boolean;
  };
  posIntegration?: {
    provider?: 'toast' | 'square' | 'none';
    enabled?: boolean;
    autoSync?: boolean;
    credentials?: any;
  };
  notifications?: {
    email?: boolean;
    sms?: boolean;
    reservationConfirmation?: boolean;
    checkinAlert?: boolean;
  };
  branding?: {
    primaryColor?: string;
    logoUrl?: string;
    bannerUrl?: string;
  };
}

export interface UpdateSettingsInput {
  restaurantId: string;
  settings: Partial<RestaurantSettings>;
  updatedBy?: string;
}

// ==================== SERVICE ====================

export class StaffAdminService {

  // ==================== STAFF MANAGEMENT ====================

  /**
   * Get all staff members for a restaurant
   */
  async getRestaurantStaff(restaurantId: string) {
    try {
      const staff = await db.user.findMany({
        where: {
          restaurantId,
          role: {
            not: 'DINER'
          }
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              events: true,
              auditLogs: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return staff;
    } catch (error) {
      Logger.error('Error fetching restaurant staff', { restaurantId, error });
      throw error;
    }
  }

  /**
   * Invite a new staff member
   */
  async inviteStaff(input: InviteStaffInput) {
    try {
      const { restaurantId, email, name, role, invitedBy } = input;

      // Check if user already exists
      const existingUser = await db.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        // User exists, update their role and restaurant
        const updatedUser = await db.user.update({
          where: { email },
          data: {
            restaurantId,
            role,
            name
          }
        });

        Logger.info('Existing user added to restaurant staff', {
          userId: updatedUser.id,
          restaurantId,
          role
        });

        return updatedUser;
      }

      // Create new user
      const newUser = await db.user.create({
        data: {
          email,
          name,
          role,
          restaurantId
        }
      });

      // Log the invitation
      await db.event.create({
        data: {
          kind: 'staff_invited',
          actorId: invitedBy,
          restaurantId,
          payloadJson: {
            invitedUserId: newUser.id,
            email,
            role
          }
        }
      });

      Logger.info('New staff member invited', {
        userId: newUser.id,
        restaurantId,
        role,
        email
      });

      // TODO: Send invitation email
      // await emailService.sendStaffInvitation(newUser.email, restaurant.name);

      return newUser;
    } catch (error) {
      Logger.error('Error inviting staff', { input, error });
      throw error;
    }
  }

  /**
   * Update staff member role
   */
  async updateStaffRole(input: UpdateStaffRoleInput) {
    try {
      const { userId, restaurantId, role, updatedBy } = input;

      // Verify user belongs to restaurant
      const user = await db.user.findFirst({
        where: {
          id: userId,
          restaurantId
        }
      });

      if (!user) {
        throw new Error('Staff member not found in this restaurant');
      }

      const previousRole = user.role;

      // Update role
      const updatedUser = await db.user.update({
        where: { id: userId },
        data: { role }
      });

      // Log the change
      await db.event.create({
        data: {
          kind: 'staff_role_changed',
          actorId: updatedBy,
          restaurantId,
          payloadJson: {
            userId,
            previousRole,
            newRole: role
          }
        }
      });

      Logger.info('Staff role updated', { userId, restaurantId, previousRole, newRole: role });

      return updatedUser;
    } catch (error) {
      Logger.error('Error updating staff role', { input, error });
      throw error;
    }
  }

  /**
   * Deactivate/remove staff member from restaurant
   */
  async removeStaff(userId: string, restaurantId: string, removedBy?: string) {
    try {
      // Verify user belongs to restaurant
      const user = await db.user.findFirst({
        where: {
          id: userId,
          restaurantId
        }
      });

      if (!user) {
        throw new Error('Staff member not found in this restaurant');
      }

      // Remove restaurant association (set to null)
      await db.user.update({
        where: { id: userId },
        data: {
          restaurantId: null,
          role: 'DINER' // Revert to diner role
        }
      });

      // Log the removal
      await db.event.create({
        data: {
          kind: 'staff_removed',
          actorId: removedBy,
          restaurantId,
          payloadJson: {
            userId,
            previousRole: user.role
          }
        }
      });

      Logger.info('Staff member removed', { userId, restaurantId });

      return { success: true };
    } catch (error) {
      Logger.error('Error removing staff', { userId, restaurantId, error });
      throw error;
    }
  }

  // ==================== RESTAURANT SETTINGS ====================

  /**
   * Get restaurant settings
   */
  async getRestaurantSettings(restaurantId: string) {
    try {
      const restaurant = await db.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
          currency: true,
          taxRate: true,
          posType: true,
          openTableId: true,
          settingsJson: true,
          locations: {
            select: {
              id: true,
              address: true,
              phone: true,
              capacityRulesJson: true,
              _count: {
                select: { tables: true }
              }
            }
          }
        }
      });

      if (!restaurant) {
        throw new Error('Restaurant not found');
      }

      return restaurant;
    } catch (error) {
      Logger.error('Error fetching restaurant settings', { restaurantId, error });
      throw error;
    }
  }

  /**
   * Update restaurant settings
   */
  async updateRestaurantSettings(input: UpdateSettingsInput) {
    try {
      const { restaurantId, settings, updatedBy } = input;

      // Get current settings
      const restaurant = await db.restaurant.findUnique({
        where: { id: restaurantId },
        select: { settingsJson: true }
      });

      if (!restaurant) {
        throw new Error('Restaurant not found');
      }

      // Merge with existing settings
      const currentSettings = (restaurant.settingsJson as RestaurantSettings) || {};
      const updatedSettings = {
        ...currentSettings,
        ...settings
      };

      // Update restaurant
      const updated = await db.restaurant.update({
        where: { id: restaurantId },
        data: {
          settingsJson: updatedSettings
        }
      });

      // Log the change
      await db.event.create({
        data: {
          kind: 'restaurant_settings_updated',
          actorId: updatedBy,
          restaurantId,
          payloadJson: {
            updatedFields: Object.keys(settings)
          }
        }
      });

      Logger.info('Restaurant settings updated', {
        restaurantId,
        updatedFields: Object.keys(settings)
      });

      return updated;
    } catch (error) {
      Logger.error('Error updating restaurant settings', { input, error });
      throw error;
    }
  }

  /**
   * Update basic restaurant info
   */
  async updateRestaurantInfo(
    restaurantId: string,
    data: {
      name?: string;
      timezone?: string;
      currency?: string;
      taxRate?: number;
      posType?: string;
      openTableId?: string;
    },
    updatedBy?: string
  ) {
    try {
      const updated = await db.restaurant.update({
        where: { id: restaurantId },
        data
      });

      // Log the change
      await db.event.create({
        data: {
          kind: 'restaurant_info_updated',
          actorId: updatedBy,
          restaurantId,
          payloadJson: {
            updatedFields: Object.keys(data)
          }
        }
      });

      Logger.info('Restaurant info updated', {
        restaurantId,
        updatedFields: Object.keys(data)
      });

      return updated;
    } catch (error) {
      Logger.error('Error updating restaurant info', { restaurantId, data, error });
      throw error;
    }
  }

  // ==================== PERMISSIONS ====================

  /**
   * Get role permissions (could be expanded to use a permissions table)
   */
  getRolePermissions(role: UserRole) {
    const permissions = {
      DINER: {
        canViewMenu: true,
        canMakeReservation: true,
        canViewOwnReservations: true
      },
      HOST: {
        canViewReservations: true,
        canManageReservations: true,
        canAssignTables: true,
        canViewMenu: true
      },
      SERVER: {
        canViewReservations: true,
        canViewOrders: true,
        canUpdateOrderStatus: true,
        canViewMenu: true
      },
      EXPO: {
        canViewOrders: true,
        canUpdateOrderStatus: true,
        canViewKitchen: true
      },
      KITCHEN: {
        canViewKitchen: true,
        canUpdateTickets: true,
        canView86Items: true
      },
      MANAGER: {
        canViewReservations: true,
        canManageReservations: true,
        canViewOrders: true,
        canViewKitchen: true,
        canManageMenu: true,
        canView86Items: true,
        canViewAnalytics: true,
        canManageStaff: false, // Can't manage other staff
        canEditSettings: false
      },
      ORG_ADMIN: {
        canViewReservations: true,
        canManageReservations: true,
        canViewOrders: true,
        canViewKitchen: true,
        canManageMenu: true,
        canView86Items: true,
        canViewAnalytics: true,
        canManageStaff: true,
        canEditSettings: true,
        canManageLocations: true,
        canManageTables: true,
        canViewAuditLogs: true
      },
      SUPPORT: {
        canViewReservations: true,
        canViewOrders: true,
        canViewAnalytics: true,
        canViewAuditLogs: true
      }
    };

    return permissions[role] || permissions.DINER;
  }

  /**
   * Get all available roles (excluding DINER and SUPPORT for staff assignment)
   */
  getAvailableStaffRoles() {
    return [
      { value: 'HOST', label: 'Host', description: 'Manages reservations and seating' },
      { value: 'SERVER', label: 'Server', description: 'Takes orders and serves guests' },
      { value: 'EXPO', label: 'Expo', description: 'Coordinates food delivery' },
      { value: 'KITCHEN', label: 'Kitchen', description: 'Prepares food and manages tickets' },
      { value: 'MANAGER', label: 'Manager', description: 'Oversees operations' },
      { value: 'ORG_ADMIN', label: 'Admin', description: 'Full access to all features' }
    ];
  }
}

export const staffAdminService = new StaffAdminService();
