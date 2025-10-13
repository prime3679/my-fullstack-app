import Logger from '../logger';

function formatError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    name: 'UnknownError',
    message: String(error)
  };
}

export interface EmailSequenceJob {
  deliveryId: string;
  templateName: string;
  to: string;
  templateData: Record<string, unknown>;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Lightweight in-memory scheduler for email jobs.
 * Designed so we can swap in a distributed queue later without touching callers.
 */
export class EmailSequenceQueue {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private shuttingDown = false;

  constructor(private readonly processor: (job: EmailSequenceJob) => Promise<void>) {}

  async schedule(job: EmailSequenceJob, delayMs: number): Promise<void> {
    if (this.shuttingDown) {
      throw new Error('Email queue is shutting down');
    }

    if (this.timers.has(job.deliveryId)) {
      clearTimeout(this.timers.get(job.deliveryId)!);
    }

    const execute = async () => {
      this.timers.delete(job.deliveryId);
      try {
        await this.processor(job);
      } catch (error) {
        Logger.error('Email queue job failed', {
          deliveryId: job.deliveryId,
          templateName: job.templateName,
          error: formatError(error)
        });
      }
    };

    const timer = setTimeout(() => {
      void execute();
    }, Math.max(0, delayMs));

    this.timers.set(job.deliveryId, timer);

    Logger.debug('Email job scheduled', {
      deliveryId: job.deliveryId,
      templateName: job.templateName,
      delayMs
    });
  }

  async cancel(deliveryId: string): Promise<void> {
    const timer = this.timers.get(deliveryId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(deliveryId);
    }
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
