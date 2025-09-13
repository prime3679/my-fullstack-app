import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { Logger } from './logger';
import { prisma } from './db';

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
  private transporter: nodemailer.Transporter;
  private templatesCache: Map<string, EmailTemplate> = new Map();

  constructor() {
    this.setupTransporter();
    this.loadTemplates();
  }

  private setupTransporter() {
    // Configure based on environment
    if (process.env.NODE_ENV === 'production') {
      // Production: Use actual SMTP service (SendGrid, Mailgun, etc.)
      this.transporter = nodemailer.createTransporter({
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
      this.transporter = nodemailer.createTransporter({
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
      Logger.error('Failed to load email templates', { error });
    }
  }

  private extractSubjectFromTemplate(template: string): string {
    // Extract subject from template comment: {{!-- Subject: Welcome to La Carta! --}}
    const subjectMatch = template.match(/{{!--\s*Subject:\s*(.+?)\s*--}}/);
    return subjectMatch ? subjectMatch[1] : 'La Carta Notification';
  }

  async sendEmail(data: EmailData): Promise<boolean> {
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
        return true;
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

      return true;
    } catch (error) {
      Logger.error('Failed to send email', {
        error,
        to: data.to,
        subject: data.subject
      });

      await this.logEmailEvent('EMAIL_FAILED', {
        to: data.to,
        subject: data.subject,
        error: (error as Error).message
      });

      return false;
    }
  }

  async sendTemplateEmail(templateName: string, to: string, data: Record<string, any>): Promise<boolean> {
    const template = this.templatesCache.get(templateName);
    
    if (!template) {
      Logger.error('Email template not found', { templateName, availableTemplates: Array.from(this.templatesCache.keys()) });
      return false;
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
      Logger.error('Failed to render email template', { error, templateName });
      return false;
    }
  }

  async startWelcomeSequence(context: WelcomeSequenceContext): Promise<boolean> {
    try {
      Logger.info('Starting welcome email sequence', { 
        userId: context.userId, 
        method: context.registrationMethod 
      });

      // Email 1: Immediate welcome (sent immediately)
      await this.sendWelcomeEmail(context);

      // Email 2: Getting started tips (scheduled for 1 hour later)
      await this.scheduleEmail('getting-started', context, { delay: 60 * 60 * 1000 }); // 1 hour

      // Email 3: First reservation encouragement (scheduled for 1 day later)
      await this.scheduleEmail('first-reservation', context, { delay: 24 * 60 * 60 * 1000 }); // 24 hours

      // Email 4: VIP features showcase (scheduled for 3 days later)
      await this.scheduleEmail('vip-features', context, { delay: 3 * 24 * 60 * 60 * 1000 }); // 3 days

      // Email 5: Weekly digest (scheduled for 7 days later)
      await this.scheduleEmail('weekly-digest', context, { delay: 7 * 24 * 60 * 60 * 1000 }); // 7 days

      await this.logEmailEvent('WELCOME_SEQUENCE_STARTED', {
        userId: context.userId,
        registrationMethod: context.registrationMethod,
        restaurantId: context.restaurantId
      });

      return true;
    } catch (error) {
      Logger.error('Failed to start welcome sequence', { error, userId: context.userId });
      return false;
    }
  }

  private async sendWelcomeEmail(context: WelcomeSequenceContext): Promise<boolean> {
    const templateData = {
      userName: context.userName,
      registrationMethod: context.registrationMethod,
      restaurantName: context.restaurantName,
      appUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      year: new Date().getFullYear(),
      supportEmail: 'support@lacarta.com'
    };

    return await this.sendTemplateEmail('welcome', context.userEmail, templateData);
  }

  private async scheduleEmail(templateName: string, context: WelcomeSequenceContext, options: { delay: number }): Promise<void> {
    // In production, you'd use a proper job queue (Bull, Agenda, etc.)
    // For now, we'll use setTimeout for demonstration
    setTimeout(async () => {
      try {
        const templateData = {
          userName: context.userName,
          restaurantName: context.restaurantName,
          appUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
          year: new Date().getFullYear(),
          supportEmail: 'support@lacarta.com'
        };

        await this.sendTemplateEmail(templateName, context.userEmail, templateData);
        
        Logger.info('Scheduled email sent', { 
          templateName, 
          userId: context.userId, 
          delay: options.delay 
        });
      } catch (error) {
        Logger.error('Failed to send scheduled email', { 
          error, 
          templateName, 
          userId: context.userId 
        });
      }
    }, options.delay);

    Logger.info('Email scheduled', { 
      templateName, 
      userId: context.userId, 
      delay: options.delay 
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

    return await this.sendTemplateEmail('staff-invitation', staffEmail, templateData);
  }

  async sendReservationConfirmation(userEmail: string, userName: string, reservationDetails: any): Promise<boolean> {
    const templateData = {
      userName,
      ...reservationDetails,
      appUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      year: new Date().getFullYear(),
      supportEmail: 'support@lacarta.com'
    };

    return await this.sendTemplateEmail('reservation-confirmation', userEmail, templateData);
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
      Logger.error('Failed to log email event', { error, eventType, data });
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      Logger.info('Email service connection verified');
      return true;
    } catch (error) {
      Logger.error('Email service connection failed', { error });
      return false;
    }
  }
}

// Singleton instance
export const emailService = new EmailService();