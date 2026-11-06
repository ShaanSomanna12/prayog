/**
 * test-whatsapp.mjs — Test Twilio WhatsApp notification dispatch.
 * Run with: node test-whatsapp.mjs
 */

import 'dotenv/config';
import { sendWhatsApp } from './sms-service.mjs';

const recipient = (process.env.ALERT_PHONE_NUMBERS || '+916363813684').split(',')[0].trim();

console.log('─────────────────────────────────────────────────────────────');
console.log('📱 Watch Guard — Twilio WhatsApp Test Dispatch');
console.log('─────────────────────────────────────────────────────────────');
console.log(`Target Phone: ${recipient}`);
console.log('Dispatching WhatsApp test message...');

const message = `🔔 *[Watch Guard]*\nTwilio WhatsApp alert system is *LIVE* and working!\nMachine anomalies will be delivered here instantly.\n⏱ _${new Date().toLocaleString()}_`;

const result = await sendWhatsApp({ to: recipient, body: message });

if (result.success) {
  console.log('✅ SUCCESS! WhatsApp message delivered to your phone!');
  console.log(`   Message SID: ${result.sid}`);
} else {
  console.log(`❌ Delivery failed: ${result.error}`);
  if (result.code === 63016 || result.code === 21608) {
    console.log('\n👉 ACTION REQUIRED TO ACTIVATE WHATSAPP SANDBOX:');
    console.log('   1. Open WhatsApp on your phone (+916363813684).');
    console.log('   2. Start a new chat to: +1 415 523 8886 (Twilio Sandbox)');
    console.log('   3. Check your Twilio Console for your unique join word, or visit:');
    console.log('      https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn');
    console.log('   4. Send "join <your-keyword>" to that number.');
    console.log('   5. Run "node test-whatsapp.mjs" again!');
  }
}
console.log('─────────────────────────────────────────────────────────────');

