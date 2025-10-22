import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { Logger, toLogError } from '../lib/logger';
import { emailService } from '../lib/emailService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { formatError } from '../utils/formatError';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';

// Staff invitation schema
const staffInviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(['HOST', 'SERVER', 'EXPO', 'KITCHEN', 'MANAGER']),
  phone: z.string().optional()
});

// Staff onboarding completion schema
const staffOnboardingSchema = z.object({
  password: z.string().min(6),
  phone: z.string().min(10),
  preferences: z.object({
    shiftNotifications: z.boolean().default(true),
    orderNotifications: z.boolean().default(true),
    marketingOptIn: z.boolean().default(false)
  }).optional()
});

// Staff profile update schema
const staffProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(10).optional(),
  preferences: z.object({
    shiftNotifications: z.boolean(),
    orderNotifications: z.boolean(), 
    marketingOptIn: z.boolean()
  }).optional()
});

export async function staffRoutes(fastify: FastifyInstance) {
  
  // Invite staff member (Manager/Admin only)
  fastify.post('/invite', async (request: FastifyRequest, reply: FastifyReply) => {
    const start = Date.now();
    
    try {
      const { email, name, role, phone } = staffInviteSchema.parse(request.body);
      const authHeader = request.headers.authorization;
      
      if (!authHeader) {
        Logger.warn('Staff invite attempted without authorization header');
        return reply.code(401).send({ success: false, error: 'Authorization required' });
      }
      
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const managerId = decoded.userId;
      
      // Verify manager has permission to invite staff
      const manager = await prisma.user.findUnique({
        where: { id: managerId },
        include: { restaurant: true }
      });
      
      if (!manager || !['MANAGER', 'ORG_ADMIN'].includes(manager.role)) {
        Logger.warn('Staff invite attempted by unauthorized user', { userId: managerId, role: manager?.role });
        return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
      }
      
      if (!manager.restaurantId) {
        Logger.warn('Manager attempted to invite staff but has no restaurant association', { managerId });
        return reply.code(400).send({ success: false, error: 'Manager must be associated with a restaurant' });
      }
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });
      
      if (existingUser) {
        // If user exists but isn't staff at this restaurant, update their role
        if (existingUser.restaurantId !== manager.restaurantId) {
          const updatedUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              role,
              restaurantId: manager.restaurantId,
              phone: phone || existingUser.phone
            }
          });
          
          Logger.info('Existing user assigned staff role', { 
            userId: updatedUser.id,
            role,
            restaurantId: manager.restaurantId,
            invitedBy: managerId
          });
          
          return reply.send({
            success: true,
            message: 'Existing user assigned staff role',
            user: {
              id: updatedUser.id,
              email: updatedUser.email,
              name: updatedUser.name,
              role: updatedUser.role
            }
          });
        } else {
          return reply.code(400).send({ 
            success: false, 
            error: 'User already exists as staff member' 
          });
        }
      }
      
      // Create new staff user with temporary password
      const temporaryPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
      
      const staffUser = await prisma.user.create({
        data: {
          email,
          name,
          role,
          phone: phone || undefined,
          hashedPassword,
          restaurantId: manager.restaurantId,
          marketingOptIn: false
        },
        include: {
          restaurant: true
        }
      });
      
      // Log the invitation
      await prisma.event.create({
        data: {
          kind: 'STAFF_INVITED',
          actorId: managerId,
          restaurantId: manager.restaurantId,
          payloadJson: {
            invitedUserId: staffUser.id,
            role,
            email,
            temporaryPassword // In production, this would be sent via email
          }
        }
      });
      
      // Send staff invitation email
      try {
        await emailService.sendStaffInvitationEmail(
          email,
          name,
          role,
          temporaryPassword,
          manager.restaurant?.name || 'Restaurant'
        );
        Logger.info('Staff invitation email sent', { staffUserId: staffUser.id, email });
      } catch (error) {
        Logger.error('Failed to send staff invitation email', { error: formatError(error), staffUserId: staffUser.id, email });
        // Don't fail the invitation if email fails
      }

      Logger.info('Staff member invited successfully', {
        staffUserId: staffUser.id,
        role,
        restaurantId: manager.restaurantId,
        invitedBy: managerId
      });
      
      Logger.performance('/staff/invite', 'POST', Date.now() - start);
      
      return reply.send({
        success: true,
        message: 'Staff member invited successfully. Invitation email sent.',
        user: {
          id: staffUser.id,
          email: staffUser.email,
          name: staffUser.name,
          role: staffUser.role
        },
        restaurant: {
          id: staffUser.restaurant?.id,
          name: staffUser.restaurant?.name
        }
      });
      
    } catch (error) {
      Logger.error('Error inviting staff member', { error: formatError(error) });
      Logger.performance('/staff/invite', 'POST', Date.now() - start);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          success: false, 
          error: 'Invalid request data',
          details: (error as any).errors
        });
      }
      
      return reply.code(500).send({ success: false, error: 'Internal server error' });
    }
  });
  
  // Complete staff onboarding (set permanent password, preferences)
  fastify.post('/onboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const start = Date.now();
    
    try {
      const parsedData = staffOnboardingSchema.parse(request.body);
      const { password, phone } = parsedData;
      const preferences = parsedData.preferences || {};
      const authHeader = request.headers.authorization;
      
      if (!authHeader) {
        return reply.code(401).send({ success: false, error: 'Authorization required' });
      }
      
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const userId = decoded.userId;
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { restaurant: true }
      });
      
      if (!user || user.role === 'DINER') {
        return reply.code(403).send({ success: false, error: 'Only staff members can complete staff onboarding' });
      }
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Update user with permanent password and preferences
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          hashedPassword,
          phone: phone || undefined,
          marketingOptIn: (preferences as any)?.marketingOptIn || false
        },
        include: {
          restaurant: true
        }
      });
      
      // Log onboarding completion
      await prisma.event.create({
        data: {
          kind: 'STAFF_ONBOARDED',
          actorId: userId,
          restaurantId: user.restaurantId || '',
          payloadJson: {
            role: user.role,
            preferences
          }
        }
      });
      
      Logger.info('Staff onboarding completed', {
        userId,
        role: user.role,
        restaurantId: user.restaurantId || ''
      });
      
      Logger.performance('/staff/onboard', 'POST', Date.now() - start);
      
      return reply.send({
        success: true,
        message: 'Staff onboarding completed successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          phone: updatedUser.phone
        },
        restaurant: {
          id: updatedUser.restaurant?.id,
          name: updatedUser.restaurant?.name
        }
      });
      
    } catch (error) {
      Logger.error('Error completing staff onboarding', { error: formatError(error) });
      Logger.performance('/staff/onboard', 'POST', Date.now() - start);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          success: false, 
          error: 'Invalid request data',
          details: (error as any).errors
        });
      }
      
      return reply.code(500).send({ success: false, error: 'Internal server error' });
    }
  });
  
  // Get staff list for restaurant (Manager/Admin only)
  fastify.get('/list', async (request: FastifyRequest, reply: FastifyReply) => {
    const start = Date.now();
    
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader) {
        return reply.code(401).send({ success: false, error: 'Authorization required' });
      }
      
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const managerId = decoded.userId;
      
      const manager = await prisma.user.findUnique({
        where: { id: managerId },
        include: { restaurant: true }
      });
      
      if (!manager || !['MANAGER', 'ORG_ADMIN'].includes(manager.role)) {
        return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
      }
      
      if (!manager.restaurantId) {
        return reply.code(400).send({ success: false, error: 'Manager must be associated with a restaurant' });
      }
      
      const staff = await prisma.user.findMany({
        where: {
          restaurantId: manager.restaurantId,
          role: { not: 'DINER' }
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      Logger.performance('/staff/list', 'GET', Date.now() - start);
      
      return reply.send({
        success: true,
        staff
      });
      
    } catch (error) {
      Logger.error('Error fetching staff list', { error: formatError(error) });
      Logger.performance('/staff/list', 'GET', Date.now() - start);
      return reply.code(500).send({ success: false, error: 'Internal server error' });
    }
  });
  
  // Update staff profile
  fastify.patch('/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const start = Date.now();
    
    try {
      const updateData = staffProfileSchema.parse(request.body);
      const authHeader = request.headers.authorization;
      
      if (!authHeader) {
        return reply.code(401).send({ success: false, error: 'Authorization required' });
      }
      
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const userId = decoded.userId;
      
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user || user.role === 'DINER') {
        return reply.code(403).send({ success: false, error: 'Only staff members can update staff profiles' });
      }
      
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name: updateData.name,
          phone: updateData.phone || undefined,
          marketingOptIn: updateData.preferences?.marketingOptIn
        },
        include: {
          restaurant: true
        }
      });
      
      Logger.info('Staff profile updated', { userId, role: user.role });
      Logger.performance('/staff/profile', 'PATCH', Date.now() - start);
      
      return reply.send({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          phone: updatedUser.phone,
          role: updatedUser.role
        }
      });
      
    } catch (error) {
      Logger.error('Error updating staff profile', { error: formatError(error) });
      Logger.performance('/staff/profile', 'PATCH', Date.now() - start);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          success: false, 
          error: 'Invalid request data',
          details: (error as any).errors
        });
      }
      
      return reply.code(500).send({ success: false, error: 'Internal server error' });
    }
  });
  
  // Staff login (separate from diner login for role verification)
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const start = Date.now();
    
    try {
      const { email, password } = z.object({
        email: z.string().email(),
        password: z.string().min(1)
      }).parse(request.body);
      
      const user = await prisma.user.findUnique({
        where: { email },
        include: { restaurant: true }
      });
      
      if (!user || user.role === 'DINER' || !user.hashedPassword || !user.restaurantId) {
        return reply.code(401).send({ 
          success: false, 
          error: 'Invalid credentials or not a staff member' 
        });
      }
      
      const validPassword = await bcrypt.compare(password, user.hashedPassword);
      if (!validPassword) {
        return reply.code(401).send({ 
          success: false, 
          error: 'Invalid credentials' 
        });
      }
      
      const token = jwt.sign(
        { 
          userId: user.id, 
          role: user.role, 
          restaurantId: user.restaurantId || '' 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // Log successful login
      await prisma.event.create({
        data: {
          kind: 'STAFF_LOGIN',
          actorId: user.id,
          restaurantId: user.restaurantId || '',
          payloadJson: {
            role: user.role,
            method: 'EMAIL_PASSWORD'
          }
        }
      });
      
      Logger.info('Staff login successful', {
        userId: user.id,
        role: user.role,
        restaurantId: user.restaurantId || ''
      });
      
      Logger.performance('/staff/login', 'POST', Date.now() - start);
      
      return reply.send({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          restaurant: {
            id: user.restaurant?.id,
            name: user.restaurant?.name,
            slug: user.restaurant?.slug
          }
        }
      });
      
    } catch (error) {
      Logger.error('Error during staff login', { error: formatError(error) });
      Logger.performance('/staff/login', 'POST', Date.now() - start);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          success: false, 
          error: 'Invalid request data',
          details: (error as any).errors
        });
      }
      
      return reply.code(500).send({ success: false, error: 'Internal server error' });
    }
  });
}