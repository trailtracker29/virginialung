/**
 * SMS Service for integrating with Android SMS Gateway
 */

/**
 * Masks a phone number for safe logging.
 * Leaves the last 4 digits visible if possible.
 */
function maskPhoneNumber(phone) {
  if (!phone) return 'unknown';
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length > 4) {
    return '****' + cleanPhone.slice(-4);
  }
  return '****';
}

/**
 * Sends an SMS asynchronously via the configured gateway.
 * Fails gracefully without throwing errors to prevent blocking the main thread.
 * 
 * @param {string} phone - The recipient's phone number
 * @param {string} message - The message content to send
 */
async function sendSMS(phone, message) {
  const url = process.env.SMS_GATEWAY_URL;
  const token = process.env.SMS_GATEWAY_TOKEN;

  if (!url || !token) {
    console.warn('[SMS Service] Skipped sending SMS: SMS_GATEWAY_URL or SMS_GATEWAY_TOKEN is not configured.');
    return { success: false, reason: 'not_configured' };
  }

  const maskedPhone = maskPhoneNumber(phone);
  console.log(`[SMS Service] Attempting to send SMS to ${maskedPhone}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneNumber: phone,
        message: message
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[SMS Service] Failed to send SMS to ${maskedPhone}. Status: ${response.status} ${response.statusText}`);
      return { success: false, reason: 'http_error', status: response.status };
    }

    console.log(`[SMS Service] Successfully sent SMS to ${maskedPhone}`);
    return { success: true };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`[SMS Service] Request timed out when sending SMS to ${maskedPhone}`);
    } else {
      console.error(`[SMS Service] Network error when sending SMS to ${maskedPhone}: ${error.message}`);
    }
    return { success: false, reason: 'network_or_timeout' };
  }
}

module.exports = {
  sendSMS,
  maskPhoneNumber
};
