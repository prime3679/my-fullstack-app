export interface FormattedError {
  name: string;
  message: string;
  stack?: string;
  code?: string;
}

export function formatError(error: unknown): FormattedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    };
  }
  
  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error
    };
  }
  
  if (error && typeof error === 'object') {
    return {
      name: (error as any).name || 'Error',
      message: (error as any).message || JSON.stringify(error),
      stack: (error as any).stack,
      code: (error as any).code
    };
  }
  
  return {
    name: 'Error',
    message: String(error)
  };
}