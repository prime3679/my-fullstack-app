import { Job } from 'bull';
import { emailQueue } from '../jobQueue';
import { emailService, WelcomeSequenceContext } from '../emailService';
import { Logger } from '../logger';

function formatError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { name: 'Unknown', message: String(error) };
}

export interface EmailJobData {
  type: 'welcome-sequence' | 'scheduled-email' | 'reservation-confirmation' | 'staff-invitation';
  userId?: string;
  templateName?: string;
  to: string;
  data: Record<string, unknown>;
  context?: WelcomeSequenceContext;
}

emailQueue.process(async (job: Job<EmailJobData>) => {
  const { type, templateName, to, data, context } = job.data;

  Logger.info('Processing email job', {
    jobId: job.id,
    type,
    templateName,
    to,
  });

  try {
    switch (type) {
      case 'scheduled-email':
        if (!templateName) {
          throw new Error('Template name is required for scheduled emails');
        }
        await emailService.sendTemplateEmail(templateName, to, data);
        break;

      case 'welcome-sequence':
        if (!context) {
          throw new Error('Context is required for welcome sequence');
        }
        await emailService.startWelcomeSequence(context);
        break;

      case 'reservation-confirmation':
        if (!data.userName || !data.reservationDetails) {
          throw new Error('User name and reservation details are required');
        }
        await emailService.sendReservationConfirmation(
          to,
          data.userName as string,
          data.reservationDetails as Record<string, unknown>
        );
        break;

      case 'staff-invitation':
        if (!data.staffName || !data.role || !data.tempPassword || !data.restaurantName) {
          throw new Error('Staff invitation requires staffName, role, tempPassword, and restaurantName');
        }
        await emailService.sendStaffInvitationEmail(
          to,
          data.staffName as string,
          data.role as string,
          data.tempPassword as string,
          data.restaurantName as string
        );
        break;

      default:
        throw new Error(`Unknown email job type: ${type}`);
    }

    Logger.info('Email job completed successfully', {
      jobId: job.id,
      type,
      to,
    });
  } catch (error) {
    Logger.error('Email job failed', {
      jobId: job.id,
      type,
      to,
      error: formatError(error),
    });
    throw error;
  }
});

export async function scheduleEmail(
  templateName: string,
  to: string,
  data: Record<string, unknown>,
  delay: number,
  userId?: string
): Promise<void> {
  await emailQueue.add(
    {
      type: 'scheduled-email',
      templateName,
      to,
      data,
      userId,
    },
    {
      delay,
      jobId: `scheduled-${templateName}-${to}-${Date.now()}`,
    }
  );

  Logger.info('Email scheduled in queue', {
    templateName,
    to,
    delay,
    userId,
  });
}

export async function queueWelcomeSequence(context: WelcomeSequenceContext): Promise<void> {
  await emailQueue.add(
    {
      type: 'welcome-sequence',
      to: context.userEmail,
      data: {},
      context,
      userId: context.userId,
    },
    {
      jobId: `welcome-${context.userId}-${Date.now()}`,
    }
  );

  Logger.info('Welcome sequence queued', {
    userId: context.userId,
    userEmail: context.userEmail,
  });
}

export async function queueReservationConfirmation(
  userEmail: string,
  userName: string,
  reservationDetails: Record<string, unknown>
): Promise<void> {
  await emailQueue.add(
    {
      type: 'reservation-confirmation',
      to: userEmail,
      data: {
        userName,
        reservationDetails,
      },
    },
    {
      jobId: `reservation-${userEmail}-${Date.now()}`,
    }
  );

  Logger.info('Reservation confirmation queued', {
    userEmail,
    userName,
  });
}

export async function queueStaffInvitation(
  staffEmail: string,
  staffName: string,
  role: string,
  tempPassword: string,
  restaurantName: string
): Promise<void> {
  await emailQueue.add(
    {
      type: 'staff-invitation',
      to: staffEmail,
      data: {
        staffName,
        role,
        tempPassword,
        restaurantName,
      },
    },
    {
      jobId: `staff-invitation-${staffEmail}-${Date.now()}`,
    }
  );

  Logger.info('Staff invitation queued', {
    staffEmail,
    staffName,
    role,
  });
}
