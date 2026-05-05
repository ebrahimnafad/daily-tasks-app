/**
 * Sends daily progress data to a Google Sheets Web App endpoint.
 * @param {string} url - The Google Apps Script Web App URL
 * @param {Object} data - The progress data to send
 * @returns {Promise<void>}
 */
export async function sendProgressToSheets(url, data) {
  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error("Failed to send data to Google Sheets", error);
    throw error;
  }
}
