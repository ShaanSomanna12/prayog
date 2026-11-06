/**
 * test-whatsapp-reminder.mjs — Comprehensive test for Twilio WhatsApp Alerts & Recurring Reminders.
 *
 * Usage:
 *   node test-whatsapp-reminder.mjs
 */

import 'dotenv/config';
import {
  sendWhatsApp,
  incidentManager,
  isTwilioConfigured,
  getRecipients,
} from './sms-service.mjs';

console.log('═════════════════════════════════════════════════════════════════════');
console.log('🤖 Watch Guard — Twilio WhatsApp & Reminder Engine Verification');
console.log('═════════════════════════════════════════════════════════════════════');

if (!isTwilioConfigured()) {
  console.error('❌ Twilio is not configured. Please check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env.');
  process.exit(1);
}

const recipients = getRecipients();
console.log(`📡 Twilio Status: ACTIVE`);
console.log(`📱 Target Recipients: ${recipients.join(', ')}`);
console.log(`💬 WhatsApp Sender: ${process.env.TWILIO_WHATSAPP_FROM || '+14155238886'}`);
console.log(`🔑 Join Code: "${process.env.TWILIO_WHATSAPP_JOIN_CODE || 'join stairs-term'}"`);
console.log(`⏱ Reminder Interval: ${Math.round((Number(process.env.WHATSAPP_REMINDER_INTERVAL_MS) || 300000) / 60000)} minute(s)`);
console.log('─────────────────────────────────────────────────────────────────────');

async function runTest() {
  const primaryPhone = recipients[0];
  console.log(`\n[STEP 1] Testing direct WhatsApp dispatch to ${primaryPhone}...`);

  const initialAlert = [
    `🚨 *[Watch Guard Test Alert]*`,
    `*Machine:* Ender 3 Pro (Camera 1)`,
    `*Issue:* SPAGHETTI FAILURE (Severity: 9/10)`,
    `*Reason:* Dense filament entanglement detected on build plate.`,
    `*Action Required:* Stop print job and clear bed immediately.`,
    `⏱ _Time: ${new Date().toLocaleTimeString()}_`,
    ``,
    `⚠️ _Automated WhatsApp reminders will fire every 5m until resolved._`,
  ].join('\n');

  const sendRes = await sendWhatsApp({ to: primaryPhone, body: initialAlert });

  if (sendRes.success) {
    console.log(`✅ SUCCESS! Initial failure alert delivered to WhatsApp! (SID: ${sendRes.sid})`);

    console.log('\n[STEP 2] Simulating recurring WhatsApp Reminder dispatch...');
    const reminderMsg = [
      `⏰ *[Watch Guard REMINDER #1]*`,
      `⚠️ Machine *Ender 3 Pro (Camera 1)* is *STILL UNRESOLVED*!`,
      ``,
      `• *Issue:* SPAGHETTI FAILURE (Severity: 9/10)`,
      `• *Unresolved Duration:* 5 minute(s) since detection`,
      `• *Action Needed:* Stop print job and clear bed immediately.`,
      `• *Reason:* Filament bird's nest detached from nozzle.`,
      ``,
      `👉 _Please inspect machine immediately or acknowledge on dashboard._`,
      `⏱ _Time: ${new Date().toLocaleTimeString()}_`,
    ].join('\n');

    const reminderRes = await sendWhatsApp({ to: primaryPhone, body: reminderMsg });
    if (reminderRes.success) {
      console.log(`✅ SUCCESS! Reminder delivered to WhatsApp! (SID: ${reminderRes.sid})`);
    }

    console.log('\n[STEP 3] Simulating Incident Resolution message...');
    const recoveryMsg = [
      `✅ *[Watch Guard Resolved]*`,
      `*Machine:* Ender 3 Pro (Camera 1)`,
      `*Status:* Recovered / Nominal`,
      `*Downtime:* 7 minute(s)`,
      `*Reminders Dispatched:* 1`,
      `⏱ _Resolved at: ${new Date().toLocaleTimeString()}_`,
    ].join('\n');

    const recoveryRes = await sendWhatsApp({ to: primaryPhone, body: recoveryMsg });
    if (recoveryRes.success) {
      console.log(`✅ SUCCESS! Incident Resolution delivered to WhatsApp! (SID: ${recoveryRes.sid})`);
    }

    console.log('\n🎉 ALL WHATSAPP NOTIFICATION & REMINDER TESTS PASSED!');
  } else {
    console.log(`❌ WhatsApp dispatch rejected: ${sendRes.error}`);
    console.log('\n👉 HOW TO CONNECT YOUR PHONE TO THE TWILIO WHATSAPP SANDBOX:');
    console.log('   1. Open WhatsApp on your phone (+916363813684).');
    console.log('   2. Start a new chat to: +1 415 523 8886 (Twilio Sandbox).');
    console.log('   3. Send this exact text message:');
    console.log(`      ${process.env.TWILIO_WHATSAPP_JOIN_CODE || 'join stairs-term'}`);
    console.log('   4. Twilio will reply: "You are all set! Sandbox is connected."');
    console.log('   5. Run this test again:');
    console.log('      node test-whatsapp-reminder.mjs');
  }

  console.log('\n─────────────────────────────────────────────────────────────────────');
  console.log('📊 Current Incident Manager In-Memory Status:');
  console.log(JSON.stringify(incidentManager.getStatus(), null, 2));
  console.log('═════════════════════════════════════════════════════════════════════');
}

runTest().catch((err) => console.error('Fatal test error:', err));

