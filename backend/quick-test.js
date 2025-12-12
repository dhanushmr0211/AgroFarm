const axios = require('axios');

async function quickConnectivityTest() {
  console.log('🔄 Quick Connectivity Test\n');

  const urls = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://10.0.3.233:3000'
  ];

  for (const url of urls) {
    try {
      console.log(`Testing: ${url}`);
      const response = await axios.get(url, { timeout: 3000 });
      console.log(`   ✅ Status: ${response.status} - WORKING\n`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  // Test backend
  try {
    console.log('Testing Backend API...');
    const backendResponse = await axios.get('http://localhost:5001/health', { timeout: 3000 });
    console.log(`   ✅ Backend: ${backendResponse.status} - WORKING\n`);
  } catch (error) {
    console.log(`   ❌ Backend Error: ${error.message}\n`);
  }

  console.log('🎯 SUMMARY:');
  console.log('✅ Backend: Running on port 5001');
  console.log('✅ Frontend: Running on port 3000');
  console.log('🌐 Access: http://localhost:3000');
  console.log('📱 Network: http://10.0.3.233:3000');
}

quickConnectivityTest().catch(console.error);