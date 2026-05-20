/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';

export interface FinanceResourceHandler {
  field: string;
  schema: z.ZodTypeAny;
  get: (userId: number) => Promise<any[]>;
  post: (userId: number, data: any[], tx: any) => Promise<void>;
}
