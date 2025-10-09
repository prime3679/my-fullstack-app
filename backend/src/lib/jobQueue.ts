import Queue from 'bull';
import Redis from 'ioredis';
import { Logger } from './logger';

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

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const emailQueue = new Queue('email-jobs', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

emailQueue.on('error', (error) => {
  Logger.error('Email queue error', { error: formatError(error) });
});

emailQueue.on('failed', (job, error) => {
  Logger.error('Email job failed', {
    jobId: job.id,
    jobData: job.data,
    error: formatError(error),
    attemptsMade: job.attemptsMade,
  });
});

emailQueue.on('completed', (job) => {
  Logger.info('Email job completed', {
    jobId: job.id,
    jobType: job.data.type,
    userId: job.data.userId,
  });
});

emailQueue.on('stalled', (job) => {
  Logger.warn('Email job stalled', {
    jobId: job.id,
    jobData: job.data,
  });
});

export async function getQueueHealth(): Promise<{
  isHealthy: boolean;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getActiveCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
      emailQueue.getDelayedCount(),
    ]);

    return {
      isHealthy: true,
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  } catch (error) {
    Logger.error('Failed to get queue health', { error: formatError(error) });
    return {
      isHealthy: false,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };
  }
}

export async function closeQueue(): Promise<void> {
  await emailQueue.close();
}

Logger.info('Job queue initialized', { redisHost: redisConfig.host, redisPort: redisConfig.port });
