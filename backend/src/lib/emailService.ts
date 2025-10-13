import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { EmailDeliveryStatus, Prisma } from '@prisma/client';
import { Logger } from './logger';
import { prisma } from './db';
import { EmailSequenceQueue, EmailSequenceJob } from './queues/emailSequenceQueue';

// Helper function to convert unknown errors to proper error objects
function formatError(error: unknown): { name: string; message: string; stack?: string; code?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    };
  }
  return { name: 'Unknown', message: String(error) };
}

export interface EmailTemplate {
  subject: string;
  htmlTemplate: string;
  textTemplate?: string;
}

export interface EmailData {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
  templateData?: Record<string, any>;
}

interface EmailSendResult {
  success: boolean;
  messageId?: string;
}

export interface WelcomeSequenceContext {
  userId: string;
  userName: string;
  userEmail: string;
  registrationMethod: 'phone' | 'google' | 'apple' | 'email';
  restaurantName?: string;
  restaurantId?: string;
  referralSource?: string;
}

export class EmailService {
  private transporter!: nodemailer.Transporter;
  private templatesCache: Map<string, EmailTemplate> = new Map();
  private sequenceQueue: EmailSequenceQueue;

  constructor() {
    this.setupTransporter();
    this.loadTemplates();
    this.sequenceQueue = new EmailSequenceQueue(this.processSequenceJob.bind(this));
  }

  private setupTransporter() {
    // Configure based on environment
    if (process.env.NODE_ENV === 'production') {
      // Production: Use actual SMTP service (SendGrid, Mailgun, etc.)
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Development: Use Ethereal Email for testing
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: process.env.ETHEREAL_USER || 'demo@ethereal.email',
          pass: process.env.ETHEREAL_PASS || 'demo_password',
        },
      });
    }
  }

  private async loadTemplates() {
    const templatesDir = path.join(__dirname, '../templates/email');
    
    try {
      // Ensure templates directory exists
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
      }

      const templateFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.hbs'));
      
      for (const file of templateFiles) {
        const templateName = path.basename(file, '.hbs');
        const templatePath = path.join(templatesDir, file);
        const htmlTemplate = fs.readFileSync(templatePath, 'utf8');
        
        // Look for corresponding text template
        const textTemplatePath = path.join(templatesDir, `${templateName}.txt`);
        const textTemplate = fs.existsSync(textTemplatePath) 
          ? fs.readFileSync(textTemplatePath, 'utf8')
          : undefined;

        this.templatesCache.set(templateName, {
          subject: this.extractSubjectFromTemplate(htmlTemplate),
          htmlTemplate,
          textTemplate
        });
      }

      Logger.info('Email templates loaded', { 
        templateCount: this.templatesCache.size,
        templates: Array.from(this.templatesCache.keys())
      });
    } catch (error) {
      Logger.error('Failed to load email templates', { error: formatError(error) });
    }
  }

  private extractSubjectFromTemplate(template: string): string {
    // Extract subject from template comment: {{!-- Subject: Welcome to La Carta! --}}
    const subjectMatch = template.match(/{{!--\s*Subject:\s*(.+?)\s*--}}/);
    return subjectMatch ? subjectMatch[1] : 'La Carta Notification';
  }

  async sendEmail(data: EmailData): Promise<EmailSendResult> {
    try {
      const mailOptions = {
        from: data.from || process.env.FROM_EMAIL || 'La Carta <hello@lacarta.com>',
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
      };

      if (process.env.NODE_ENV === 'development') {
        // In development, log email instead of sending
        Logger.info('Email would be sent (development mode)', {
          to: data.to,
          subject: data.subject,
          preview: data.html.substring(0, 200) + '...'
        });
        return { success: true };
      }

      const info = await this.transporter.sendMail(mailOptions);

      Logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: data.to,
        subject: data.subject,
        accepted: info.accepted,
        rejected: info.rejected
      });

      // Log email event for analytics
      await this.logEmailEvent('EMAIL_SENT', {
        to: data.to,
        subject: data.subject,
        messageId: info.messageId,
        templateData: data.templateData
      });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      Logger.error('Failed to send email', {
        error: formatError(error),
        to: data.to,
        subject: data.subject
      });

      await this.logEmailEvent('EMAIL_FAILED', {
        to: data.to,
        subject: data.subject,
        error: (error as Error).message
      });

      return { success: false };
    }
  }

  async sendTemplateEmail(templateName: string, to: string, data: Record<string, any>): Promise<EmailSendResult> {
    const template = this.templatesCache.get(templateName);

    if (!template) {
      Logger.error('Email template not found', { templateName, availableTemplates: Array.from(this.templatesCache.keys()) });
      return { success: false };
    }

    try {
      // Compile templates with Handlebars
      const htmlCompiled = handlebars.compile(template.htmlTemplate);
      const html = htmlCompiled(data);

      let text: string | undefined;
      if (template.textTemplate) {
        const textCompiled = handlebars.compile(template.textTemplate);
        text = textCompiled(data);
      }

      // Compile subject
      const subjectCompiled = handlebars.compile(template.subject);
      const subject = subjectCompiled(data);

      return await this.sendEmail({
        to,
        subject,
        html,
        text,
        templateData: data
      });
    } catch (error) {
      Logger.error('Failed to render email template', { error: formatError(error), templateName });
      return { success: false };
    }
  }

  async startWelcomeSequence(context: WelcomeSequenceContext): Promise<boolean> {
    try {
      Logger.info('Starting welcome email sequence', {
        userId: context.userId,
        method: context.registrationMethod
      });

      const schedulePlan = [
        { template: 'welcome', delay: 0 },
        { template: 'getting-started', delay: 60 * 60 * 1000 },
        { template: 'first-reservation', delay: 24 * 60 * 60 * 1000 },
        { template: 'vip-features', delay: 3 * 24 * 60 * 60 * 1000 },
        { template: 'weekly-digest', delay: 7 * 24 * 60 * 60 * 1000 }
      ];

      for (const step of schedulePlan) {
        const deliveryId = await this.enqueueSequenceEmail(step.template, context, step.delay);
        Logger.info('Welcome sequence email scheduled', {
          deliveryId,
          templateName: step.template,
          delayMs: step.delay,
          userId: context.userId
        });
      }

      await this.logEmailEvent('WELCOME_SEQUENCE_STARTED', {
        userId: context.userId,
        registrationMethod: context.registrationMethod,
        restaurantId: context.restaurantId
      });

      return true;
    } catch (error) {
      Logger.error('Failed to start welcome sequence', { error: formatError(error), userId: context.userId });
      return false;
    }
  }

  private async sendWelcomeEmail(context: WelcomeSequenceContext): Promise<boolean> {
    const templateData = this.getSequenceTemplateData('welcome', context);
    const result = await this.sendTemplateEmail('welcome', context.userEmail, templateData);
    return result.success;
  }

  private getSequenceTemplateData(templateName: string, context: WelcomeSequenceContext): Record<string, unknown> {
    const baseData = {
      userName: context.userName,
      restaurantName: context.restaurantName,
      appUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      year: new Date().getFullYear(),
      supportEmail: 'support@lacarta.com',
      referralSource: context.referralSource
    };

    if (templateName === 'welcome') {
      return {
        ...baseData,
        registrationMethod: context.registrationMethod
      };
    }

    return baseData;
  }

  private async enqueueSequenceEmail(
    templateName: string,
    context: WelcomeSequenceContext,
    delayMs: number
  ): Promise<string> {
    const templateData = this.getSequenceTemplateData(templateName, context);
    const scheduledAt = new Date(Date.now() + delayMs);
    const metadata = JSON.parse(
      JSON.stringify({
        context,
        templateData
      })
    ) as Prisma.JsonObject;

    const delivery = await prisma.emailDelivery.create({
      data: {
        templateName,
        to: context.userEmail,
        userId: context.userId,
        status: EmailDeliveryStatus.SCHEDULED,
        scheduledAt,
        metadata
      }
    });

    await this.sequenceQueue.schedule(
      {
        deliveryId: delivery.id,
        templateName,
        to: context.userEmail,
        templateData,
        userId: context.userId,
        metadata
      },
      delayMs
    );

    return delivery.id;
  }

  private async processSequenceJob(job: EmailSequenceJob): Promise<void> {
    Logger.debug('Processing email sequence job', {
      deliveryId: job.deliveryId,
      templateName: job.templateName,
      userId: job.userId
    });

    await this.updateDeliveryStatus(job.deliveryId, EmailDeliveryStatus.PENDING, {});

    try {
      const result = await this.sendTemplateEmail(job.templateName, job.to, job.templateData);

      if (!result.success) {
        throw new Error('Email send returned unsuccessful response');
      }

      await this.updateDeliveryStatus(job.deliveryId, EmailDeliveryStatus.SENT, {
        providerMessageId: result.messageId,
        sentAt: new Date(),
        metadata: {
          ...job.metadata,
          lastResult: 'sent'
        }
      });

      await this.logEmailEvent('EMAIL_DELIVERY_SENT', {
        deliveryId: job.deliveryId,
        templateName: job.templateName,
        to: job.to,
        messageId: result.messageId,
        userId: job.userId
      });
    } catch (error) {
      await this.updateDeliveryStatus(job.deliveryId, EmailDeliveryStatus.FAILED, {
        errorMessage: (error as Error).message,
        metadata: {
          ...job.metadata,
          lastResult: 'failed'
        }
      });

      await this.logEmailEvent('EMAIL_DELIVERY_FAILED', {
        deliveryId: job.deliveryId,
        templateName: job.templateName,
        to: job.to,
        error: (error as Error).message,
        userId: job.userId
      });

      Logger.error('Email sequence job failed', {
        deliveryId: job.deliveryId,
        templateName: job.templateName,
        error: formatError(error)
      });

      throw error;
    }
  }

  private async updateDeliveryStatus(
    deliveryId: string,
    status: EmailDeliveryStatus,
    extra: {
      providerMessageId?: string;
      errorMessage?: string;
      sentAt?: Date;
      metadata?: Record<string, unknown>;
    }
  ) {
    const data: any = {
      status,
      providerMessageId: extra.providerMessageId,
      errorMessage: extra.errorMessage,
      sentAt: extra.sentAt
    };

    if (extra.metadata) {
      data.metadata = extra.metadata;
    }

    await prisma.emailDelivery.update({
      where: { id: deliveryId },
      data
    });
  }

  async sendStaffInvitationEmail(staffEmail: string, staffName: string, role: string, tempPassword: string, restaurantName: string): Promise<boolean> {
    const templateData = {
      staffName,
      role: role.toLowerCase(),
      tempPassword,
      restaurantName,
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/staff`,
      year: new Date().getFullYear(),
      supportEmail: 'support@lacarta.com'
    };

    const result = await this.sendTemplateEmail('staff-invitation', staffEmail, templateData);
    return result.success;
  }

  async sendReservationConfirmation(userEmail: string, userName: string, reservationDetails: any): Promise<boolean> {
    const templateData = {
      userName,
      ...reservationDetails,
      appUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      year: new Date().getFullYear(),
      supportEmail: 'support@lacarta.com'
    };

    const result = await this.sendTemplateEmail('reservation-confirmation', userEmail, templateData);
    return result.success;
  }

  private async logEmailEvent(eventType: string, data: Record<string, any>): Promise<void> {
    try {
      await prisma.event.create({
        data: {
          kind: eventType,
          payloadJson: data,
          createdAt: new Date()
        }
      });
    } catch (error) {
      Logger.error('Failed to log email event', { error: formatError(error), eventType, data });
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      Logger.info('Email service connection verified');
      return true;
    } catch (error) {
      Logger.error('Email service connection failed', { error: formatError(error) });
      return false;
    }
  }
}

// Singleton instance
export const emailService = new EmailService();
