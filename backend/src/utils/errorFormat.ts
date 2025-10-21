/**
 * Error formatting utility for Logger
 */

export function formatError(error: unknown): {
  name: string;
  message: string;
  stack?: string;
  code?: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
    };
  }

  return {
    name: 'Unknown',
    message: String(error),
  };
}
