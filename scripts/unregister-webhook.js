require('dotenv').config();
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

/**
 * Unregister webhook URL from Rentals United
 * 
 * Usage:
 * node scripts/unregister-webhook.js
 */
async function unregisterWebhook() {
  try {
    console.log('🔄 Unregistering webhook from Rentals United...');

    const response = await ruClient.unregisterWebhook();
    console.log('\n✅ Raw Response:', response);

    const parsed = xmlParser.parse(response);
    console.log('\n📋 Parsed Response:', JSON.stringify(parsed, null, 2));

    if (parsed.LNM_PutHandlerUrl_RS) {
      const result = parsed.LNM_PutHandlerUrl_RS;
      const statusId = result.Status?.['@_ID'];
      const statusText = typeof result.Status === 'string' ? result.Status : result.Status?.['#text'];

      console.log('\n📊 Unregistration Result:');
      console.log(`   Status ID: ${statusId}`);
      console.log(`   Status: ${statusText}`);
      console.log(`   Response ID: ${result.ResponseID}`);

      if (statusId === '0' || statusText === 'Success') {
        console.log('\n✅ Webhook unregistered successfully!');
        console.log('\n📝 You can remove RU_WEBHOOK_HASH from your .env file');
      } else {
        console.log('\n❌ Unregistration failed');
      }
    }

  } catch (error) {
    console.error('\n❌ Error unregistering webhook:', error.message);
    process.exit(1);
  }
}

unregisterWebhook();
