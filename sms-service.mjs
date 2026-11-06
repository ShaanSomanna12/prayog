/**
 * sms-service.mjs — Automated Twilio Messaging (SMS & WhatsApp) for Watch Guard.
 *
 * Dispatches urgent notifications and recurring reminders to designated engineer/operator numbers
 * when a machine failure or anomaly is detected.
 *
 * Features:
 * - Direct WhatsApp alert dispatch via Twilio Sandbox.
 * - Incident Reminder Manager: Periodically resends urgent reminders if an incident stays unresolved.
 * - Acknowledgment & Recovery lifecycle: Automatically silences reminders when acknowledged or recovered.
 * - Multi-recipient broadcasting (comma-separated phone numbers).
 * - SMS fallback support.
 */

import 'dotenv/config';
import twilio from 'twilio';

// Initialize credentials from environment
const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
const authToken  = (process.env.TWILIO_AUTH_TOKEN  || '').trim();
const smsFrom    = (process.env.TWILIO_PHONE_NUMBER || '').trim();

// Twilio Sandbox default WhatsApp number is +1 415 523 8886
const waFrom = (process.env.TWILIO_WHATSAPP_FROM || '+14155238886').trim();
const waJoinCode = (process.env.TWILIO_WHATSAPP_JOIN_CODE || 'join stairs-term').trim();

// Reminder configuration (default: 5 minutes = 300,000ms)
const REMINDER_INTERVAL_MS = Number(process.env.WHATSAPP_REMINDER_INTERVAL_MS || 300_000);
const MAX_REMINDERS = Number(process.env.WHATSAPP_MAX_REMINDERS || 10);

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
 * Returns whether Twilio client is ready.
 */
export function isTwilioConfigured() {
  return Boolean(client);
}

/**
 * Returns current list of recipient phone numbers.
 */
export function getRecipients() {
  return (process.env.ALERT_PHONE_NUMBERS || '+916363813684')
    .split(',')
    .map((num) => num.trim())
    .filter(Boolean);
}

/**
 * Send a message via Twilio WhatsApp Sandbox.
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
    // 63016 = Channel sandbox not joined, 21654 = ContentSid required (unjoined 24h window)
    if (error.code === 63016 || error.code === 21654) {
      friendly = `WhatsApp Sandbox opt-in required: Send "${waJoinCode}" from your WhatsApp to ${waFrom} to activate alerts.`;
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
 * Broadcasts a text message to all registered recipient numbers via WhatsApp (with SMS fallback).
 */
export async function broadcastMessage(body, recipients = getRecipients()) {
  if (!isTwilioConfigured()) {
    return [];
  }

  return Promise.allSettled(
    recipients.map(async (phone) => {
      // 1. Try WhatsApp
      const waRes = await sendWhatsApp({ to: phone, body });
      if (waRes.success) {
        return { phone, channel: 'whatsapp', ...waRes };
      }

      // 2. Fallback to SMS if SMS number is available
      if (smsFrom) {
        const smsRes = await sendSms({ to: phone, body });
        return { phone, channel: 'sms', ...smsRes };
      }

      return { phone, channel: 'whatsapp', ...waRes };
    })
  );
}

/**
 * Dispatches an urgent initial machine failure alert.
 */
export async function dispatchFailureAlert({
  cameraLabel = 'Fabrication Machine',
  failureType = 'Anomaly',
  severity = 8,
  reason = 'Sustained failure detected across 3 consecutive frames.',
  nextStep = 'Inspect the machine immediately.',
}, recipients = getRecipients()) {
  if (!isTwilioConfigured()) {
    console.log('[Twilio] Skipping alert (credentials not configured yet).');
    return [];
  }

  const cleanLabel = String(cameraLabel || 'Machine').trim();
  const cleanType = String(failureType || 'Anomaly').replace(/_/g, ' ').toUpperCase();
  const intervalMin = Math.round(REMINDER_INTERVAL_MS / 60000) || 5;

  const text = [
    `🚨 *[Watch Guard Alert]*`,
    `*Machine:* ${cleanLabel}`,
    `*Issue:* ${cleanType} (Severity: ${severity}/10)`,
    `*Reason:* ${reason}`,
    `*Action Required:* ${nextStep}`,
    `⏱ _Time: ${new Date().toLocaleTimeString()}_`,
    ``,
    `⚠️ _Automated WhatsApp reminders will fire every ${intervalMin}m until resolved or acknowledged._`,
  ].join('\n');

  console.log(`[Twilio] Broadcasting failure alert to ${recipients.length} recipient(s)...`);
  return broadcastMessage(text, recipients);
}

/**
 * IncidentReminderManager — Automated Recurring WhatsApp Reminders for Unresolved Machine Failures.
 */
class IncidentReminderManager {
  constructor() {
    this.incidents = new Map(); // cameraId -> IncidentState
    this.timer = null;
    this.intervalMs = REMINDER_INTERVAL_MS;
    this.maxReminders = MAX_REMINDERS;
    this.startLoop();
  }

  startLoop() {
    if (this.timer) clearInterval(this.timer);
    // Check every 20 seconds for overdue reminders
    this.timer = setInterval(() => this.checkOverdueReminders(), 20_000);
    if (this.timer.unref) this.timer.unref(); // Prevent blocking process exit
  }

  stopLoop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Record or update a machine failure.
   */
  recordFailure({
    cameraId = 'default',
    cameraLabel = 'Machine',
    failureType = 'Anomaly',
    severity = 8,
    reason = 'Confirmed failure detected.',
    nextStep = 'Inspect machine and clear print bed.',
    confidence = null,
  }) {
    const existing = this.incidents.get(cameraId);

    if (existing && existing.status === 'active') {
      // Update details while keeping start time and reminder count
      existing.reason = reason;
      existing.severity = severity;
      existing.nextStep = nextStep;
      existing.failureType = failureType;
      return existing;
    }

    const incident = {
      id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      cameraId,
      cameraLabel: String(cameraLabel || cameraId).trim(),
      failureType: String(failureType || 'Anomaly').replace(/_/g, ' '),
      severity: Number(severity) || 8,
      reason,
      nextStep,
      confidence: confidence ? Number(confidence) : null,
      status: 'active', // 'active' | 'acknowledged' | 'resolved'
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      startedAt: Date.now(),
      lastAlertAt: Date.now(),
      reminderCount: 0,
      remindersHistory: [],
    };

    this.incidents.set(cameraId, incident);
    console.log(`[IncidentManager] 🚨 Active incident registered for "${incident.cameraLabel}" (${cameraId}). Reminder loop armed.`);

    // Dispatch initial alert immediately
    dispatchFailureAlert({
      cameraLabel: incident.cameraLabel,
      failureType: incident.failureType,
      severity: incident.severity,
      reason: incident.reason,
      nextStep: incident.nextStep,
    }).catch((err) => console.error('[IncidentManager Alert Error]:', err?.message || err));

    return incident;
  }

  /**
   * Marks a machine incident as resolved and stops reminder notifications.
   */
  async resolveFailure(cameraId, details = {}) {
    const incident = this.incidents.get(cameraId);
    if (!incident || incident.status === 'resolved') {
      return null;
    }

    incident.status = 'resolved';
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - incident.startedAt) / 60000));
    const label = details.cameraLabel || incident.cameraLabel;

    console.log(`[IncidentManager] ✅ Machine "${label}" marked RESOLVED. Halting WhatsApp reminders.`);

    // Dispatch recovery notification via WhatsApp
    const recoveryText = [
      `✅ *[Watch Guard Resolved]*`,
      `*Machine:* ${label}`,
      `*Status:* Recovered / Nominal`,
      `*Downtime:* ${elapsedMinutes} minute(s)`,
      `*Reminders Sent:* ${incident.reminderCount}`,
      `⏱ _Resolved at: ${new Date().toLocaleTimeString()}_`,
    ].join('\n');

    await broadcastMessage(recoveryText).catch((err) =>
      console.error('[IncidentManager Recovery Msg Error]:', err?.message || err)
    );

    // Remove from active tracking
    this.incidents.delete(cameraId);
    return incident;
  }

  /**
   * Operator acknowledges the incident from the UI or command line.
   */
  async acknowledgeFailure(cameraId, acknowledgedBy = 'Operator') {
    const incident = this.incidents.get(cameraId);
    if (!incident || incident.status !== 'active') {
      return null;
    }

    incident.status = 'acknowledged';
    incident.acknowledged = true;
    incident.acknowledgedBy = acknowledgedBy;
    incident.acknowledgedAt = Date.now();

    console.log(`[IncidentManager] 👍 Incident for "${incident.cameraLabel}" acknowledged by ${acknowledgedBy}. Reminders paused.`);

    const ackText = [
      `👍 *[Watch Guard Acknowledged]*`,
      `*Machine:* ${incident.cameraLabel}`,
      `*Issue:* ${incident.failureType.toUpperCase()}`,
      `*Acknowledged By:* ${acknowledgedBy}`,
      `*Reminders:* Paused while operator inspects machine.`,
      `⏱ _Time: ${new Date().toLocaleTimeString()}_`,
    ].join('\n');

    await broadcastMessage(ackText).catch((err) =>
      console.error('[IncidentManager Ack Msg Error]:', err?.message || err)
    );

    return incident;
  }

  /**
   * Checks for overdue unresolved incidents and fires WhatsApp reminders.
   */
  async checkOverdueReminders() {
    const now = Date.now();

    for (const [cameraId, incident] of this.incidents.entries()) {
      if (incident.status !== 'active' || incident.acknowledged) {
        continue;
      }

      const timeSinceLastAlert = now - incident.lastAlertAt;
      if (timeSinceLastAlert >= this.intervalMs) {
        if (incident.reminderCount >= this.maxReminders) {
          console.log(`[IncidentManager] Max reminders (${this.maxReminders}) reached for "${incident.cameraLabel}". Halting reminders.`);
          continue;
        }

        incident.reminderCount += 1;
        incident.lastAlertAt = now;
        const elapsedMinutes = Math.max(1, Math.round((now - incident.startedAt) / 60000));

        console.log(`[IncidentManager] ⏰ Sending WhatsApp REMINDER #${incident.reminderCount} for "${incident.cameraLabel}"...`);

        const reminderText = [
          `⏰ *[Watch Guard REMINDER #${incident.reminderCount}]*`,
          `⚠️ Machine *${incident.cameraLabel}* is *STILL UNRESOLVED*!`,
          ``,
          `• *Issue:* ${incident.failureType.toUpperCase()} (Severity: ${incident.severity}/10)`,
          `• *Duration:* ${elapsedMinutes} minute(s) since failure detection`,
          `• *Action Needed:* ${incident.nextStep}`,
          `• *Reason:* ${incident.reason}`,
          ``,
          `👉 _Please inspect machine immediately or acknowledge on the dashboard._`,
          `⏱ _Time: ${new Date().toLocaleTimeString()}_`,
        ].join('\n');

        incident.remindersHistory.push({
          reminderIndex: incident.reminderCount,
          sentAt: now,
        });

        await broadcastMessage(reminderText).catch((err) =>
          console.error(`[IncidentManager Reminder #${incident.reminderCount} Error]:`, err?.message || err)
        );
      }
    }
  }

  /**
   * Forces an immediate reminder for a specific camera (useful for testing or manual ping).
   */
  async triggerImmediateReminder(cameraId) {
    const incident = this.incidents.get(cameraId);
    if (!incident) {
      throw new Error(`No active incident found for camera "${cameraId}".`);
    }

    incident.reminderCount += 1;
    incident.lastAlertAt = Date.now();
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - incident.startedAt) / 60000));

    const reminderText = [
      `⏰ *[Watch Guard REMINDER #${incident.reminderCount}]*`,
      `⚠️ Machine *${incident.cameraLabel}* is *STILL UNRESOLVED*!`,
      ``,
      `• *Issue:* ${incident.failureType.toUpperCase()} (Severity: ${incident.severity}/10)`,
      `• *Duration:* ${elapsedMinutes} minute(s) since detection`,
      `• *Action Needed:* ${incident.nextStep}`,
      `• *Reason:* ${incident.reason}`,
      ``,
      `👉 _Manual reminder triggered. Please inspect the machine._`,
      `⏱ _Time: ${new Date().toLocaleTimeString()}_`,
    ].join('\n');

    return broadcastMessage(reminderText);
  }

  /**
   * Returns current active incidents status.
   */
  getStatus() {
    return {
      configured: isTwilioConfigured(),
      reminderIntervalMs: this.intervalMs,
      reminderIntervalMinutes: Math.round(this.intervalMs / 60000),
      maxReminders: this.maxReminders,
      recipients: getRecipients(),
      activeIncidentsCount: Array.from(this.incidents.values()).filter((i) => i.status === 'active').length,
      incidents: Array.from(this.incidents.values()),
    };
  }
}

// Global Singleton Instance
export const incidentManager = new IncidentReminderManager();
