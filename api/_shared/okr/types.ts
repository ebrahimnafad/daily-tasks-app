/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';

/** Standard resource handler for cycles, objectives, and key-results (upsert pattern). */
export interface OkrResourceHandler {
  field: string;
  schema: z.ZodTypeAny;
  get: (userId: number) => Promise<any[]>;
  post: (userId: number, data: any[], tx: any) => Promise<void>;
}
