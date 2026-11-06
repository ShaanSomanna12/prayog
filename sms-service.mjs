/**
 * sms-service.mjs — Automated Twilio Messaging (SMS & WhatsApp) for Watch Guard.
 *
 * Dispatches urgent notifications to designated engineer/operator numbers
 * when a confirmed machine failure or anomaly is detected.
 *
 * Supports both standard SMS and free Twilio WhatsApp Sandbox.
 */

import 'dotenv/config';
import twilio from 'twilio';

// Initialize credentials from environment
const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
const authToken  = (process.env.TWILIO_AUTH_TOKEN  || '').trim();
const smsFrom    = (process.env.TWILIO_PHONE_NUMBER || '').trim();

// Twilio Sandbox default WhatsApp number is +1 415 523 8886
const waFrom = (process.env.TWILIO_WHATSAPP_FROM || '+14155238886').trim();

// Target recipients: supports comma-separated list
const defaultRecipients = (process.env.ALERT_PHONE_NUMBERS || '+916363813684')
  .split(',')
  .map((num) => num.trim())
  .filter(Boolean);

let client = null;
if (accountSid && authToken) {
  try {
    client = twilio(accountSid, authToken);
    console.log('[Twilio] Service active for Account SID:', accountSid.slice(0, 6) + '...');
  } catch (err) {
    console.error('[Twilio] Initialization error:', err.message);
  }
} else {
  console.log('[Twilio] Service standing by (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN not set yet).');
}

/**
 * Validates E.164 phone number format (e.g. +916363813684)
 */
export function isValidE164(phone) {
  return /^\+[1-9]\d{6,14}$/.test(String(phone || '').trim().replace(/^whatsapp:/, ''));
}

/**
 * Returns whether Twilio is ready.
 */
export function isTwilioConfigured() {
  return Boolean(client);
}

/**
 * Send an alert via Twilio WhatsApp Sandbox.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient phone number (e.g. +916363813684)
 * @param {string} options.body - Message body
 */
export async function sendWhatsApp({ to, body }) {
  if (!client) {
    return { success: false, error: 'Twilio client not initialized. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.' };
  }

  const rawPhone = String(to || '').trim().replace(/^whatsapp:/, '');
  if (!isValidE164(rawPhone)) {
    return { success: false, error: `Invalid phone format: "${to}". Must be E.164 (e.g. +916363813684)` };
  }

  const toWa = `whatsapp:${rawPhone}`;
  const fromWa = `whatsapp:${waFrom.replace(/^whatsapp:/, '')}`;

  try {
    const message = await client.messages.create({
      from: fromWa,
      to: toWa,
      body: String(body || '').trim(),
    });

    return {
      success: true,
      sid: message.sid,
      status: message.status,
    };
  } catch (error) {
    let friendly = error.message;
    if (error.code === 63016) {
      friendly = 'User has not joined the WhatsApp Sandbox yet. Send the sandbox join keyword to +1 415 523 8886 on WhatsApp.';
    }
    console.error(`[Twilio WhatsApp Error ${error.code || 'UNKNOWN'}]:`, friendly);
    return {
      success: false,
      code: error.code,
      error: friendly,
    };
  }
}

/**
 * Send an SMS to a single recipient.
 */
export async function sendSms({ to, body }) {
  if (!client || !smsFrom) {
    return { success: false, error: 'Twilio SMS not configured. Set TWILIO_PHONE_NUMBER.' };
  }

  const sanitizedTo = String(to || '').trim();
  if (!isValidE164(sanitizedTo)) {
    return { success: false, error: `Invalid E.164 phone format: "${to}".` };
  }

  try {
    const message = await client.messages.create({
      from: smsFrom,
      to: sanitizedTo,
      body: String(body || '').trim(),
    });

    return { success: true, sid: message.sid, status: message.status };
  } catch (error) {
    return { success: false, code: error.code, error: error.message };
  }
}

/**
 * Dispatches an urgent machine failure alert via WhatsApp (with SMS fallback).
 */
export async function dispatchFailureAlert({
  cameraLabel = 'Fabrication Machine',
  failureType = 'Anomaly',
  severity = 8,
  reason = 'Sustained failure detected across 3 consecutive frames.',
  nextStep = 'Inspect the machine immediately.',
}, recipients = defaultRecipients) {
  if (!isTwilioConfigured()) {
    console.log('[Twilio] Skipping alert (credentials not configured yet).');
    return [];
  }

  const cleanLabel = String(cameraLabel || 'Machine').trim();
  const cleanType = String(failureType || 'Anomaly').replace(/_/g, ' ').toUpperCase();
  const text = `🚨 *[Watch Guard Alert]*\n*Machine:* ${cleanLabel}\n*Issue:* ${cleanType} (Severity: ${severity}/10)\n*Reason:* ${reason}\n*Action:* ${nextStep}\n⏱ _Time: ${new Date().toLocaleTimeString()}_`;

  console.log(`[Twilio] Broadcasting failure alert to ${recipients.length} recipient(s)...`);

  const results = await Promise.allSettled(
    recipients.map(async (phone) => {
      // 1. Try WhatsApp first
      const waRes = await sendWhatsApp({ to: phone, body: text });
      if (waRes.success) {
        console.log(`[Twilio WhatsApp] ✅ Alert dispatched to ${phone} (SID: ${waRes.sid})`);
        return { phone, channel: 'whatsapp', ...waRes };
      }

      // 2. Fallback to SMS if SMS number is available
      if (smsFrom) {
        const smsRes = await sendSms({ to: phone, body: text });
        return { phone, channel: 'sms', ...smsRes };
      }

      return { phone, channel: 'whatsapp', ...waRes };
    })
  );

  return results.map((r) => (r.status === 'fulfilled' ? r.value : { error: r.reason }));
}

