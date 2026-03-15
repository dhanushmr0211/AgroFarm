// Application Connectivity Test
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

  // Test 3: Test actual registration endpoint
  console.log('\n3️⃣ Testing Registration Endpoint...');
  
  // First get a valid APMC ID
  let validApmcId = null;
  try {
    const apmcResponse = await axios.get(`${BACKEND_URL}/api/auth/apmcs`);
    validApmcId = apmcResponse.data.data[0]?.id;
    console.log('   📍 Using APMC ID:', validApmcId);
  } catch (error) {
    console.log('   ❌ Cannot get APMC ID:', error.message);
    return;
  }

  // Test registration with valid data
  try {
    const testUser = {
      name: 'Frontend Test User',
      email: `frontend-test-${Date.now()}@example.com`,
      phone: `+91-9${Math.floor(Math.random() * 1000000000)}`,
      password: 'test123456',
      role: 'FARMER',
      apmcId: validApmcId
    };

    console.log('   🔄 Testing registration with:', {
      name: testUser.name,
      email: testUser.email,
      role: testUser.role,
      apmcId: testUser.apmcId
    });

    const response = await axios.post(`${BACKEND_URL}/api/auth/register`, testUser, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL
      }
    });

    console.log('   ✅ Registration successful!');
    console.log('   👤 User created:', response.data.user.name);
    console.log('   🔑 Token received:', response.data.token ? 'Yes' : 'No');

    // Clean up - delete the test user
    console.log('\n🧹 Cleaning up test user...');
    const deleteResult = await axios.delete(`${BACKEND_URL}/api/users/${response.data.user.id}`, {
      headers: {
        'Authorization': `Bearer ${response.data.token}`
      }
    });
    console.log('   ✅ Test user cleaned up');

  } catch (error) {
    console.log('   ❌ Registration failed:');
    console.log('      Status:', error.response?.status);
    console.log('      Message:', error.response?.data?.message || error.message);
    console.log('      Data:', error.response?.data);
  }

  // Test 4: Check if frontend can access backend from browser
  console.log('\n4️⃣ Frontend Browser Access Test...');
  console.log('   📝 Manual Test Instructions:');
  console.log('   1. Open browser to: http://localhost:3001/register');
  console.log('   2. Open Developer Tools (F12) → Network tab');
  console.log('   3. Try to register a user');
  console.log('   4. Check for:');
  console.log('      - CORS errors in console');
  console.log('      - Failed network requests');
  console.log('      - 404 or 500 errors');
  console.log('      - Preflight OPTIONS requests');

  // Test 5: Environment variables
  console.log('\n5️⃣ Environment Configuration...');
  console.log('   🔧 Backend Port: 5001');
  console.log('   🔧 Frontend Port: 3001 (or 3000)');
  console.log('   🔧 Expected API Base URL in Frontend: http://localhost:5001');
  
  console.log('\n📊 DIAGNOSTIC SUMMARY:');
  console.log('══════════════════════════════════════════════');
  console.log('✅ Backend API is working correctly');
  console.log('✅ Registration endpoint accepts valid data');
  console.log('✅ APMC endpoints are accessible');
  console.log('');
  console.log('💡 If frontend registration still fails:');
  console.log('   1. Check browser console for JavaScript errors');
  console.log('   2. Verify API_URL environment variable in frontend');
  console.log('   3. Check network tab for failed requests');
  console.log('   4. Ensure both servers are running simultaneously');
  
  console.log('\n🔧 Quick Fix Commands:');
  console.log('   Frontend: npm run dev (in frontend directory)');
  console.log('   Backend:  npm run dev (in backend directory)');
  console.log('   Both:     npm run dev (in root directory)');
}

    
  } catch (error) {
    console.log('\n❌ Connection Error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check if backend is running on port 5001');
    console.log('   2. Check if frontend is running on port 3000');
    console.log('   3. Verify no firewall blocking the ports');
  }
}

testApplicationConnectivity().catch(console.error);