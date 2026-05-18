import { ZodError } from 'zod';
import type { ApiRequest, ApiResponse } from './types.js';

type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void>;

export function withValidation(handler: Handler): Handler {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid payload',
          details: err.flatten().fieldErrors,
        });
      }
      // Size assertion errors
      if (err instanceof Error && err.message.includes('exceeds maximum')) {
        return res.status(400).json({ error: err.message });
      }
      throw err; // re-throw — let Vercel handle unexpected errors as 500
    }
  };
}
