import type { SheetsPayload } from '@/types';
import { logger } from '@/lib/logging';

/**
 * Sends daily progress data to Google Sheets via server-side proxy.
 * The server manages the Google Sheets URL securely.
 */
export async function sendProgressToSheets(data: SheetsPayload): Promise<void> {
  try {
    const response = await fetch('/api/webhooks?resource=send-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    logger.info('Successfully sent data to Google Sheets via server');
  } catch (error) {
    logger.error('Failed to send data to Google Sheets', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
