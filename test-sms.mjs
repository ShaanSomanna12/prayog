/**
 * test-sms.mjs — Test Twilio SMS notification dispatch.
 * Run with: node test-sms.mjs
 */

import 'dotenv/config';
import { sendSms, isTwilioConfigured } from './sms-service.mjs';

const recipients = (process.env.ALERT_PHONE_NUMBERS || '+916363813684,+919019146493')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

console.log('─────────────────────────────────────────────────────────────');
console.log('📡 Watch Guard — Twilio SMS Test Dispatch');
console.log('─────────────────────────────────────────────────────────────');

if (!isTwilioConfigured()) {
  console.log('❌ Twilio is not fully configured in your .env file.\n');
  console.log('To enable SMS delivery, ensure the following are filled in .env:');
  console.log('  TWILIO_ACCOUNT_SID=AC...');
  console.log('  TWILIO_AUTH_TOKEN=...');
  console.log('  TWILIO_PHONE_NUMBER=+1...');
  console.log('\nTarget phone numbers configured:');
  recipients.forEach((num) => console.log(`  • ${num}`));
  process.exit(1);
}

console.log(`Sending test notification to ${recipients.length} phone number(s):`);
recipients.forEach((num) => console.log(`  • ${num}`));
console.log('');

const testMessage = `🔔 [Watch Guard] Test Notification: Twilio automated SMS alerting is active! Time: ${new Date().toLocaleTimeString()}`;

for (const phone of recipients) {
  process.stdout.write(`Dispatching SMS to ${phone}... `);
  const result = await sendSms({ to: phone, body: testMessage });
  if (result.success) {
    console.log(`✅ SUCCESS! SID: ${result.sid}`);
  } else {
    console.log(`❌ FAILED: ${result.error}`);
    if (result.code === 21608) {
      console.log('   👉 Note: On Twilio Trial accounts, unverified numbers cannot receive SMS.');
      console.log('   👉 Add your number at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
    }
  }
}

console.log('─────────────────────────────────────────────────────────────');

