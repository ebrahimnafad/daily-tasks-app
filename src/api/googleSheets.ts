import type { SheetsPayload } from '@/types';

/**
 * Sends daily progress data to a Google Sheets Web App endpoint.
 */
export async function sendProgressToSheets(url: string, data: SheetsPayload): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Failed to send data to Google Sheets', error);
    throw error;
  }
}
