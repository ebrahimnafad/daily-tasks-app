import { logger } from '@/lib/logging';

export interface WithErrorHandlerOptions<T> {
  fallback?: T;
  retry?: number;
  onError?: (error: Error) => void;
}

export const withErrorHandler = <T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options?: WithErrorHandlerOptions<unknown>
): T => {
  return (async (...args: unknown[]) => {
    let lastError: Error | null = null;
    const maxRetries = options?.retry ?? 1;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          logger.warn(`Async function failed, attempt ${attempt + 1}/${maxRetries}`, {
            error: lastError.message,
          });
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    options?.onError?.(lastError!);
    logger.error(`Async function failed after ${maxRetries} attempts`, {
      error: lastError?.message,
    });

    if (options?.fallback !== undefined) {
      return options.fallback;
    }

    throw lastError;
  }) as T;
};
