import { describe, it, expect, vi } from 'vitest';
import { handleFinanceSyncAll } from '../../../api/_shared/finance';
import type { FinanceResourceHandler } from '../../../api/_shared/finance/types';
import { z } from 'zod';

// Mock dependencies
vi.mock('../../../api/_shared/db.js', () => ({
  db: {
    transaction: vi.fn(async (cb) => {
      // Simulate Drizzle transaction block
      const tx = { _isTx: true };
      await cb(tx);
    }),
  },
}));

vi.mock('../../../api/_shared/cors.js', () => ({
  setCorsHeaders: vi.fn(),
}));

vi.mock('../../../api/_shared/auth.js', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 1 }),
}));

describe('handleFinanceSyncAll', () => {
  it('should process all handlers atomically and fail completely if one throws', async () => {
    const mockTx = { _isTx: true };

    // Create mock handlers
    const handler1: FinanceResourceHandler = {
      field: 'income',
      schema: z.any(),
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue(undefined),
    };

    const handler2: FinanceResourceHandler = {
      field: 'expenses',
      schema: z.any(),
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockRejectedValue(new Error('Simulated database error during expenses insert')),
    };

    const handler3: FinanceResourceHandler = {
      field: 'transactions',
      schema: z.any(),
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue(undefined),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = {
      method: 'POST',
      body: {
        income: [{ id: '1', amount: 100 }],
        expenses: [{ id: '2', amount: 50 }],
        transactions: [{ id: '3', amount: 20 }],
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      end: vi.fn(),
    };

    await handleFinanceSyncAll(req, res, [handler1, handler2, handler3]);

    // handler1.post should be called because it comes first in the array
    expect(handler1.post).toHaveBeenCalledWith(1, [{ id: '1', amount: 100 }], mockTx);

    // handler2.post should be called and throw
    expect(handler2.post).toHaveBeenCalledWith(1, [{ id: '2', amount: 50 }], mockTx);

    // handler3.post should NOT be called because handler2 threw
    expect(handler3.post).not.toHaveBeenCalled();

    // The error should be caught and a 500 error returned (because it's not a 409/410)
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'خطأ داخلي في الخادم',
      })
    );
  });

  it('should decorate 409/410 conflict errors with the correct resource field', async () => {
    const mockTx = { _isTx: true };

    const handler1: FinanceResourceHandler = {
      field: 'income',
      schema: z.any(),
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockRejectedValue({
        status: 409,
        message: 'Conflict',
        entityId: '1',
        serverData: { amount: 200 },
      }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = {
      method: 'POST',
      body: {
        income: [{ id: '1', amount: 100 }],
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      end: vi.fn(),
    };

    await handleFinanceSyncAll(req, res, [handler1]);

    expect(handler1.post).toHaveBeenCalledWith(1, [{ id: '1', amount: 100 }], mockTx);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Conflict',
        resource: 'income',
        entityId: '1',
        serverData: { amount: 200 },
      })
    );
  });
});
