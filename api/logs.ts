import { setCorsHeaders } from './_shared/cors.js';
import type { ApiRequest, ApiResponse } from './_shared/types.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // The client side logger (src/lib/logging/index.ts) POSTs error logs here.
  // We simply acknowledge receipt to prevent the client from endlessly retrying
  // and filling up localStorage.
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    // Optional: Log the errors to the Vercel console
    if (body.entries && Array.isArray(body.entries)) {
      for (const entry of body.entries) {
        if (entry.level === 'error') {
          console.error(`[Client Error] ${entry.message}`, entry.context || '');
        }
      }
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
