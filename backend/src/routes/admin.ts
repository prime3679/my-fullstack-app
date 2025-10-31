import { FastifyInstance } from 'fastify';
import { staffAdminService } from '../services/staffAdminService';
import { Logger } from '../lib/logger';
import { UserRole } from '@prisma/client';

export async function adminRoutes(fastify: FastifyInstance) {

  // ==================== STAFF MANAGEMENT ====================

  // Get all staff for a restaurant
  fastify.get<{
    Params: { restaurantId: string };
  }>('/staff/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;

      const staff = await staffAdminService.getRestaurantStaff(restaurantId);

      return {
        success: true,
        data: staff
      };
    } catch (error) {
      Logger.error('Failed to fetch staff', { error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch staff',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Invite new staff member
  fastify.post<{
    Body: {
      restaurantId: string;
      email: string;
      name: string;
      role: UserRole;
      invitedBy?: string;
    };
  }>('/staff/invite', async (request, reply) => {
    try {
      const user = await staffAdminService.inviteStaff(request.body);

      return {
        success: true,
        data: user,
        message: 'Staff member invited successfully'
      };
    } catch (error) {
      Logger.error('Failed to invite staff', { error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      return reply.code(400).send({
        success: false,
        error: 'Failed to invite staff',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update staff role
  fastify.patch<{
    Params: { userId: string };
    Body: {
      restaurantId: string;
      role: UserRole;
      updatedBy?: string;
    };
  }>('/staff/:userId/role', async (request, reply) => {
    try {
      const { userId } = request.params;
      const { restaurantId, role, updatedBy } = request.body;

      const user = await staffAdminService.updateStaffRole({
        userId,
        restaurantId,
        role,
        updatedBy
      });

      return {
        success: true,
        data: user,
        message: 'Staff role updated successfully'
      };
    } catch (error) {
      Logger.error('Failed to update staff role', { error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      return reply.code(400).send({
        success: false,
        error: 'Failed to update staff role',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Remove staff member
  fastify.delete<{
    Params: { userId: string };
    Body: {
      restaurantId: string;
      removedBy?: string;
    };
  }>('/staff/:userId', async (request, reply) => {
    try {
      const { userId } = request.params;
      const { restaurantId, removedBy } = request.body;

      await staffAdminService.removeStaff(userId, restaurantId, removedBy);

      return {
        success: true,
        message: 'Staff member removed successfully'
      };
    } catch (error) {
      Logger.error('Failed to remove staff', { error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      return reply.code(400).send({
        success: false,
        error: 'Failed to remove staff',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ==================== RESTAURANT SETTINGS ====================

  // Get restaurant settings
  fastify.get<{
    Params: { restaurantId: string };
  }>('/settings/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;

      const settings = await staffAdminService.getRestaurantSettings(restaurantId);

      return {
        success: true,
        data: settings
      };
    } catch (error) {
      Logger.error('Failed to fetch settings', { error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update restaurant settings
  fastify.patch<{
    Params: { restaurantId: string };
    Body: {
      settings: any;
      updatedBy?: string;
    };
  }>('/settings/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const { settings, updatedBy } = request.body;

      const updated = await staffAdminService.updateRestaurantSettings({
        restaurantId,
        settings,
        updatedBy
      });

      return {
        success: true,
        data: updated,
        message: 'Settings updated successfully'
      };
    } catch (error) {
      Logger.error('Failed to update settings', { error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      return reply.code(400).send({
        success: false,
        error: 'Failed to update settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update basic restaurant info
  fastify.patch<{
    Params: { restaurantId: string };
    Body: {
      name?: string;
      timezone?: string;
      currency?: string;
      taxRate?: number;
      posType?: string;
      openTableId?: string;
      updatedBy?: string;
    };
  }>('/restaurant/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const { updatedBy, ...data } = request.body;

      const updated = await staffAdminService.updateRestaurantInfo(
        restaurantId,
        data,
        updatedBy
      );

      return {
        success: true,
        data: updated,
        message: 'Restaurant info updated successfully'
      };
    } catch (error) {
      Logger.error('Failed to update restaurant info', { error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      return reply.code(400).send({
        success: false,
        error: 'Failed to update restaurant info',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ==================== PERMISSIONS ====================

  // Get role permissions
  fastify.get<{
    Params: { role: UserRole };
  }>('/permissions/:role', async (request, reply) => {
    try {
      const { role } = request.params;

      const permissions = staffAdminService.getRolePermissions(role);

      return {
        success: true,
        data: permissions
      };
    } catch (error) {
      Logger.error('Failed to fetch permissions', { error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch permissions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get available staff roles
  fastify.get('/roles', async (request, reply) => {
    try {
      const roles = staffAdminService.getAvailableStaffRoles();

      return {
        success: true,
        data: roles
      };
    } catch (error) {
      Logger.error('Failed to fetch roles', { error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch roles',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
