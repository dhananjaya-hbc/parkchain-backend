const https = require('https');
require('dotenv').config();

async function testDidit() {
  const apiKey = process.env.DIDIT_API_KEY;
  const workflowId = process.env.WORKFLOW_ID;

  const payload = {
    workflow_id: workflowId,
    callback: 'https://example.com/callback',
    vendor_data: 'test-user-123'
  };

  console.log('Testing with API Key:', apiKey.substring(0, 5) + '...');
  console.log('Workflow:', workflowId);

  try {
    const response = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    console.log('STATUS:', response.status);
    console.log('RESPONSE:', text);
  } catch (err) {
    console.error('FETCH ERROR:', err);
  }
}

testDidit();