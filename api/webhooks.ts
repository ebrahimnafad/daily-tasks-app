/* eslint-env node */
/**
 * Vercel Serverless Function — Webhook Handler
 *
 * Routes:
 *   POST  /api/webhooks/send-progress → Forward to Google Sheets
 *
 * Requires: GOOGLE_SHEETS_WEBHOOK_URL environment variable
 */

import { applyRateLimit } from './middleware/rateLimit.js';

// ── CORS: تقييد الوصول ──────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
].filter(Boolean);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (!origin) {
    return;
  }

  if (!ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', 'null');
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

// ── Payload Validation ────────────────────────────────────────────────────
function validateSheetsPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;

  const requiredFields = [
    'date',
    'progress',
    'prayersDone',
    'prayerTotal',
    'tasksDone',
    'tasksTotal',
  ];
  for (const field of requiredFields) {
    if (typeof payload[field] === 'undefined') return false;
  }

  return true;
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const resource = req.query.resource || 'unknown';

  /* ── Rate Limiting ── */
  const rateLimit = applyRateLimit(req, resource, 'sheets');
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: rateLimit.message });
  }

  if (resource === 'send-progress') {
    try {
      const payload = req.body;

      if (!validateSheetsPayload(payload)) {
        return res.status(400).json({ error: 'Invalid payload' });
      }

      const sheetsUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
      if (!sheetsUrl) {
        console.error('GOOGLE_SHEETS_WEBHOOK_URL not configured');
        return res.status(503).json({ error: 'Service unavailable' });
      }

      const response = await fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Google Sheets error:', response.status, errorText);
        throw new Error(`Google Sheets API error: ${response.statusText}`);
      }

      console.log('Successfully forwarded to Google Sheets');
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Failed to send to Google Sheets:', error.message);
      return res.status(500).json({ error: 'Failed to process request' });
    }
  }

  return res.status(404).json({ error: 'Not found' });
}
