const axios = require('axios');

async function testApplicationConnectivity() {
  console.log('🧪 Testing Full Application Connectivity\n');

  const BACKEND_URL = 'http://localhost:5001';
  const FRONTEND_URL = 'http://localhost:3000';

  try {
    // Test Backend
    console.log('1️⃣ Testing Backend...');
    const backendResponse = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    console.log('   ✅ Backend is running on port 5001');

    // Test Frontend
    console.log('\n2️⃣ Testing Frontend...');
    const frontendResponse = await axios.get(FRONTEND_URL, { timeout: 5000 });
    console.log('   ✅ Frontend is accessible on port 3000');

    // Test API Proxy
    console.log('\n3️⃣ Testing API Proxy...');
    const proxyResponse = await axios.get(`${FRONTEND_URL}/api/health`, { timeout: 5000 });
    console.log('   ✅ API proxy is working correctly');

    console.log('\n🎉 Application Status:');
    console.log('   ✅ Backend Server: Running (port 5001)');
    console.log('   ✅ Frontend Server: Running (port 3000)');
    console.log('   ✅ API Proxy: Working');
    console.log('   ✅ Site Accessibility: OK');

    console.log('\n📱 Access the application:');
    console.log('   🌐 Local: http://localhost:3000');
    console.log('   📱 Mobile: http://10.0.3.233:3000');
    console.log('\n👤 Login credentials:');
    console.log('   📧 Email: dhanushmr0211@gmail.com');
    console.log('   🔑 Password: farmer123');
    console.log('   📋 Role: Farmer');
    
  } catch (error) {
    console.log('\n❌ Connection Error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check if backend is running on port 5001');
    console.log('   2. Check if frontend is running on port 3000');
    console.log('   3. Verify no firewall blocking the ports');
  }
}

testApplicationConnectivity().catch(console.error);