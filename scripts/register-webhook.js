require('dotenv').config();
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');
const path = require('path');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

/**
 * Register webhook URL with Rentals United
 * 
 * Usage:
 * node scripts/register-webhook.js https://yourdomain.com/api/webhooks/rentals-united
 * 
 * For localhost testing with ngrok:
 * node scripts/register-webhook.js https://abc123.ngrok.io/api/webhooks/rentals-united
 */
async function registerWebhook() {
  try {
    // Get webhook URL from command line or environment
    const webhookUrl = process.argv[2] || process.env.WEBHOOK_URL;

    if (!webhookUrl) {
      console.error('❌ Error: Webhook URL is required');
      console.log('\nUsage:');
      console.log('  node scripts/register-webhook.js <webhook-url>');
      console.log('\nExample:');
      console.log('  node scripts/register-webhook.js https://yourdomain.com/api/webhooks/rentals-united');
      console.log('  node scripts/register-webhook.js https://abc123.ngrok.io/api/webhooks/rentals-united');
      process.exit(1);
    }

    if (!webhookUrl.startsWith('https://')) {
      console.error('❌ Error: Webhook URL must use HTTPS');
      process.exit(1);
    }

    console.log('🔄 Registering webhook with Rentals United...');
    console.log(`📍 Webhook URL: ${webhookUrl}`);

    const response = await ruClient.registerWebhook(webhookUrl);
    console.log('\n✅ Raw Response:', response);

    const parsed = xmlParser.parse(response);
    console.log('\n📋 Parsed Response:', JSON.stringify(parsed, null, 2));

    if (parsed.LNM_PutHandlerUrl_RS) {
      const result = parsed.LNM_PutHandlerUrl_RS;
      const statusId = result.Status?.['@_ID'];
      const statusText = typeof result.Status === 'string' ? result.Status : result.Status?.['#text'];
      const hash = result.Hash;

      console.log('\n📊 Registration Result:');
      console.log(`   Status ID: ${statusId}`);
      console.log(`   Status: ${statusText}`);
      console.log(`   Response ID: ${result.ResponseID}`);
      
      if (hash) {
        console.log(`   Hash: ${hash}`);
        console.log('\n⚠️  IMPORTANT: Save this hash to your .env file:');
        console.log(`   RU_WEBHOOK_HASH=${hash}`);
        
        // Optionally append to .env file
        const envPath = path.join(__dirname, '..', '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        if (!envContent.includes('RU_WEBHOOK_HASH')) {
          fs.appendFileSync(envPath, `\n# RU Webhook Hash (for validating webhooks)\nRU_WEBHOOK_HASH=${hash}\n`);
          console.log('\n✅ Hash automatically added to .env file');
        } else {
          console.log('\n⚠️  RU_WEBHOOK_HASH already exists in .env - please update it manually');
        }
      }

      if (statusId === '0' || statusText === 'Success') {
        console.log('\n✅ Webhook registered successfully!');
        console.log('\n📝 Next steps:');
        console.log('   1. Make sure RU_WEBHOOK_HASH is in your .env file');
        console.log('   2. Restart your server');
        console.log('   3. Test by creating a booking in RU dashboard');
      } else {
        console.log('\n❌ Registration failed');
      }
    }

  } catch (error) {
    console.error('\n❌ Error registering webhook:', error.message);
    process.exit(1);
  }
}

registerWebhook();
